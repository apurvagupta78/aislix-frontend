ALTER TABLE public.detected_products ADD COLUMN IF NOT EXISTS variant text;

WITH payload AS (
  SELECT r.scan_id,
         item.ord,
         NULLIF(trim(item.value->>'variant'), '') AS variant,
         item.value->>'brand' AS brand,
         item.value->>'product_name' AS product_name,
         (item.value->>'facings')::numeric AS facings
  FROM public.scan_results r
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(r.raw_payload::jsonb -> 'inventory') = 'array'
         THEN r.raw_payload::jsonb -> 'inventory' ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS item(value, ord)
),
ranked_payload AS (
  SELECT *, row_number() OVER (PARTITION BY scan_id, lower(coalesce(brand,'')), lower(coalesce(product_name,'')), facings ORDER BY ord) AS rn
  FROM payload
  WHERE variant IS NOT NULL
),
ranked_products AS (
  SELECT id, scan_id, lower(coalesce(brand,'')) AS b, lower(coalesce(name,'')) AS n, facings::numeric AS f,
         row_number() OVER (PARTITION BY scan_id, lower(coalesce(brand,'')), lower(coalesce(name,'')), facings ORDER BY position_index, id) AS rn
  FROM public.detected_products
  WHERE variant IS NULL
)
UPDATE public.detected_products dp
SET variant = rp.variant
FROM ranked_products p
JOIN ranked_payload rp
  ON rp.scan_id = p.scan_id
 AND lower(coalesce(rp.brand,'')) = p.b
 AND lower(coalesce(rp.product_name,'')) = p.n
 AND rp.facings = p.f
 AND rp.rn = p.rn
WHERE dp.id = p.id;