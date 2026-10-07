-- Restock / reorder list: what to refill or move back, per store, from each store's latest completed AI audit.
-- SECURITY INVOKER so row-level security decides which scans and stores the caller sees.

CREATE OR REPLACE FUNCTION public.restock_list(
  p_org_id uuid,
  p_from timestamptz DEFAULT now() - interval '30 days',
  p_to timestamptz DEFAULT now(),
  p_store_ids uuid[] DEFAULT NULL,
  p_limit integer DEFAULT 400
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH latest AS (
  SELECT DISTINCT ON (s.store_id)
    s.id AS scan_id,
    s.store_id,
    s.created_at,
    s.created_by,
    COALESCE(s.sub_category_label, s.category, s.shelf_label) AS category,
    s.low_stock_count,
    s.misplaced_count,
    COALESCE(aislix_jsonb_num(r.metrics -> 'shelf_gap_count'), s.out_of_stock_count::numeric) AS gaps
  FROM shelf_scans s
  LEFT JOIN LATERAL (
    SELECT sr.metrics FROM scan_results sr WHERE sr.scan_id = s.id ORDER BY sr.created_at DESC LIMIT 1
  ) r ON true
  WHERE s.org_id = p_org_id
    AND s.audit_mode = 'ai'
    AND s.status = 'completed'
    AND s.created_at >= p_from
    AND s.created_at < p_to
    AND (p_store_ids IS NULL OR s.store_id = ANY (p_store_ids))
  ORDER BY s.store_id, s.created_at DESC
),
lines AS (
  SELECT
    l.store_id,
    l.scan_id,
    btrim(d.name) AS name,
    CASE
      WHEN lower(regexp_replace(COALESCE(d.brand, ''), '[^[:alnum:]]', '', 'g'))
        IN ('', 'unknown', 'unbranded', 'unidentified', 'generic', 'na', 'none') THEN NULL
      ELSE btrim(d.brand)
    END AS brand,
    NULLIF(btrim(d.variant), '') AS variant,
    d.sku,
    d.facings,
    d.expected_facings,
    d.stock_status::text AS status,
    d.confidence,
    COALESCE(NULLIF(btrim(d.category), ''), l.category) AS category,
    CASE d.stock_status::text WHEN 'out_of_stock' THEN 0 WHEN 'low_stock' THEN 1 ELSE 2 END AS status_rank
  FROM latest l
  JOIN detected_products d ON d.scan_id = l.scan_id
  WHERE d.stock_status::text IN ('out_of_stock', 'low_stock', 'misplaced')
    AND COALESCE(btrim(d.name), '') <> ''
),
stores_j AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'store_id', l.store_id,
    'store_name', COALESCE(st.name, 'Unnamed store'),
    'store_type', st.store_type,
    'city', st.city,
    'scan_id', l.scan_id,
    'audited_at', l.created_at,
    'captured_by', COALESCE(NULLIF(btrim(pr.full_name), ''), pr.email, 'Team member'),
    'category', l.category,
    'gaps', l.gaps,
    'low_stock', l.low_stock_count,
    'misplaced', l.misplaced_count,
    'lines', (SELECT count(*) FROM lines x WHERE x.scan_id = l.scan_id)
  ) ORDER BY l.gaps DESC NULLS LAST, st.name), '[]'::jsonb) AS j
  FROM latest l
  LEFT JOIN stores st ON st.id = l.store_id
  LEFT JOIN profiles pr ON pr.id = l.created_by
),
lines_j AS (
  SELECT COALESCE(jsonb_agg(to_jsonb(x) - 'status_rank' ORDER BY x.store_name, x.status_rank, x.confidence DESC NULLS LAST, x.name), '[]'::jsonb) AS j
  FROM (
    SELECT ln.*, COALESCE(st.name, 'Unnamed store') AS store_name
    FROM lines ln
    LEFT JOIN stores st ON st.id = ln.store_id
    ORDER BY ln.status_rank, ln.confidence DESC NULLS LAST
    LIMIT GREATEST(COALESCE(p_limit, 400), 1)
  ) x
)
SELECT jsonb_build_object(
  'from', p_from,
  'to', p_to,
  'totals', jsonb_build_object(
    'stores', (SELECT count(*) FROM latest),
    'gaps', (SELECT sum(gaps) FROM latest),
    'out_of_stock', (SELECT count(*) FROM lines WHERE status = 'out_of_stock'),
    'low_stock', (SELECT count(*) FROM lines WHERE status = 'low_stock'),
    'misplaced', (SELECT count(*) FROM lines WHERE status = 'misplaced'),
    'lines', (SELECT count(*) FROM lines)
  ),
  'stores', (SELECT j FROM stores_j),
  'lines', (SELECT j FROM lines_j)
);
$$;

GRANT EXECUTE ON FUNCTION public.restock_list(uuid, timestamptz, timestamptz, uuid[], integer) TO authenticated;

COMMENT ON FUNCTION public.restock_list(uuid, timestamptz, timestamptz, uuid[], integer) IS
  'Per store, the latest completed AI audit in the period: empty gaps plus the products read as out of stock, low or misplaced.';
