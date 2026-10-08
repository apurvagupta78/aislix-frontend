-- Finding / corrective-action product names: do not repeat the brand or variant when the
-- product name already contains it ("Texas" + "Texas Mixed Drops" -> "Texas Mixed Drops").

CREATE OR REPLACE FUNCTION public.ca_product_label(p_brand TEXT, p_product TEXT, p_variant TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  WITH v AS (
    SELECT nullif(btrim(p_brand), '') AS b,
           nullif(btrim(p_product), '') AS p,
           nullif(btrim(p_variant), '') AS va
  )
  SELECT nullif(concat_ws(' ',
    CASE
      WHEN v.b IS NOT NULL AND v.p IS NOT NULL
       AND (lower(v.p) = lower(v.b) OR left(lower(v.p), length(v.b) + 1) = lower(v.b) || ' ')
      THEN NULL
      ELSE v.b
    END,
    v.p,
    CASE
      WHEN v.va IS NOT NULL AND v.p IS NOT NULL AND strpos(lower(v.p), lower(v.va)) > 0 THEN NULL
      ELSE v.va
    END
  ), '')
  FROM v
$$;

-- Older findings were stored as "Texas Texas Mixed Drops"; collapse a repeated leading word
-- (4+ letters, so names like "Bon Bon" stay distinct) so re-check scans still match them.
CREATE OR REPLACE FUNCTION public.ca_signature(p_type TEXT, p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(p_type, '') || '|' || regexp_replace(
    regexp_replace(lower(coalesce(p_name, '')), '^\s*(\S{4,})\s+\1(\s|$)', '\1\2'),
    '[^a-z0-9]+', '', 'g'
  )
$$;

CREATE OR REPLACE FUNCTION public.ai_scan_issues(p_scan_id UUID)
RETURNS TABLE (
  issue_key TEXT,
  signature TEXT,
  finding_type TEXT,
  severity TEXT,
  title TEXT,
  description TEXT,
  sku TEXT,
  product_name TEXT,
  category TEXT,
  shelf_label TEXT,
  expected_value NUMERIC,
  actual_value NUMERIC,
  from_comparison BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  m JSONB;
  v_lines JSONB;
  v_products JSONB;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.planogram_comparison_lines l
    JOIN public.planogram_comparisons c ON c.id = l.comparison_id
    WHERE c.scan_id = p_scan_id
      AND l.issue_type NOT IN ('correct', 'ok', 'unexpected')
  ) THEN
    RETURN QUERY
    SELECT
      'cmp:' || x.id::text,
      public.ca_signature(x.ftype, x.pname),
      x.ftype,
      x.sev,
      initcap(replace(x.ftype, '_', ' ')),
      x.detail,
      NULL::text,
      x.pname,
      NULL::text,
      NULL::text,
      x.expected_qty::numeric,
      x.actual_qty::numeric,
      true
    FROM (
      SELECT l.id, l.detail, l.expected_qty, l.actual_qty,
        COALESCE(l.expected_product, l.actual_product) AS pname,
        CASE l.issue_type
          WHEN 'missing' THEN 'missing_product'
          WHEN 'wrong_product' THEN 'wrong_placement'
          WHEN 'wrong_location' THEN 'wrong_placement'
          WHEN 'wrong_category' THEN 'planogram_violation'
          WHEN 'qty_mismatch' THEN CASE WHEN COALESCE(l.actual_qty, 0) = 0 THEN 'out_of_stock' ELSE 'planogram_violation' END
          ELSE 'shelf_execution_issue'
        END AS ftype,
        CASE COALESCE(l.severity, 'warning') WHEN 'critical' THEN 'critical' WHEN 'warning' THEN 'high' ELSE 'medium' END AS sev
      FROM public.planogram_comparison_lines l
      JOIN public.planogram_comparisons c ON c.id = l.comparison_id
      WHERE c.scan_id = p_scan_id
        AND l.issue_type NOT IN ('correct', 'ok', 'unexpected')
    ) x;
    RETURN;
  END IF;

  SELECT r.metrics INTO m
  FROM public.scan_results r
  WHERE r.scan_id = p_scan_id
  ORDER BY r.updated_at DESC
  LIMIT 1;
  IF m IS NULL OR jsonb_typeof(m) <> 'object' THEN RETURN; END IF;

  IF jsonb_typeof(m -> 'compliance_alerts') = 'array' THEN
    RETURN QUERY
    SELECT
      'alert:' || md5(coalesce(a ->> 'id', '') || '|' || coalesce(a ->> 'title', '') || '|' || coalesce(a ->> 'detail', '')),
      public.ca_signature(x.ftype, a ->> 'title'),
      x.ftype,
      CASE lower(coalesce(a ->> 'severity', ''))
        WHEN 'critical' THEN 'critical' WHEN 'high' THEN 'high'
        WHEN 'low' THEN 'low' WHEN 'info' THEN 'low' ELSE 'medium'
      END,
      coalesce(nullif(a ->> 'title', ''), 'Shelf issue'),
      nullif(a ->> 'detail', ''),
      NULL::text, NULL::text,
      nullif(a ->> 'category', ''),
      NULL::text, NULL::numeric, NULL::numeric, false
    FROM jsonb_array_elements(m -> 'compliance_alerts') a
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN coalesce(a ->> 'id', '') ~* '(category|misplac|location)' THEN 'wrong_placement'
        WHEN coalesce(a ->> 'id', '') || coalesce(a ->> 'category', '') ~* 'pric' THEN 'pricing_issue'
        WHEN coalesce(a ->> 'id', '') ~* '(stock|oos|empty|gap)' THEN 'out_of_stock'
        WHEN coalesce(a ->> 'id', '') ~* '(promo|display)' THEN 'display_issue'
        WHEN coalesce(a ->> 'id', '') ~* 'damag' THEN 'damaged_product'
        WHEN coalesce(a ->> 'id', '') ~* 'expir' THEN 'expired_product'
        ELSE 'shelf_execution_issue'
      END AS ftype
    ) x
    WHERE jsonb_typeof(a) = 'object';
  END IF;

  v_lines := m -> 'aislix_planogram_analysis' -> 'reference_match' -> 'lines';
  IF jsonb_typeof(v_lines) = 'array' AND jsonb_array_length(v_lines) > 0 THEN
    RETURN QUERY
    SELECT
      'ref:' || coalesce(l ->> 'line_no', md5(l::text)) || ':' || x.ftype,
      public.ca_signature(x.ftype, n.pname),
      x.ftype, x.sev, x.ttl,
      nullif(l ->> 'raw_text', ''),
      nullif(l ->> 'sku', ''),
      n.pname,
      NULL::text,
      nullif(l ->> 'expected_location', ''),
      x.expv, x.actv, false
    FROM jsonb_array_elements(v_lines) l
    CROSS JOIN LATERAL (
      SELECT public.ca_product_label(l ->> 'brand', l ->> 'product_name', l ->> 'variant') AS pname
    ) n
    CROSS JOIN LATERAL (
      SELECT * FROM (VALUES
        (CASE WHEN l ->> 'presence_status' = 'MISSING' OR l ->> 'qty_status' = 'NOT_ON_SHELF' THEN 'missing_product' END,
         'high', 'Missing product', public.safe_numeric(l ->> 'invoice_qty'), 0::numeric),
        (CASE WHEN l ->> 'qty_status' = 'BELOW_DOCUMENT' THEN 'planogram_violation' END,
         'medium', 'Below planned quantity', public.safe_numeric(l ->> 'invoice_qty'), public.safe_numeric(l ->> 'shelf_units')),
        (CASE WHEN l ->> 'price_status' = 'MISMATCH' THEN 'pricing_issue' END,
         'high', 'Price mismatch', public.safe_numeric(l ->> 'expected_price'), public.safe_numeric(l ->> 'visible_price')),
        (CASE WHEN l ->> 'promo_status' IN ('MISSING', 'MISMATCH', 'NOT_FOUND') THEN 'display_issue' END,
         'medium', 'Promotion missing', NULL::numeric, NULL::numeric)
      ) v(ftype, sev, ttl, expv, actv)
      WHERE v.ftype IS NOT NULL
    ) x
    WHERE jsonb_typeof(l) = 'object';
    RETURN;
  END IF;

  v_products := m -> 'aislix_planogram_analysis' -> 'products';
  IF coalesce(m -> 'aislix_planogram_analysis' ->> 'mode', '') = 'planogram'
     AND jsonb_typeof(v_products) = 'array' THEN
    RETURN QUERY
    SELECT
      'row:' || md5(coalesce(p ->> 'brand', '') || '|' || coalesce(p ->> 'product_name', '') || '|' || coalesce(p ->> 'variant', '') || '|' || coalesce(p ->> 'location', '')) || ':' || x.ftype,
      public.ca_signature(x.ftype, n.pname),
      x.ftype, x.sev, x.ttl,
      nullif(p ->> 'location', ''),
      nullif(p ->> 'sku', ''),
      n.pname,
      nullif(p ->> 'category', ''),
      nullif(coalesce(p ->> 'expected_location', p ->> 'location'), ''),
      x.expv, x.actv, false
    FROM jsonb_array_elements(v_products) p
    CROSS JOIN LATERAL (
      SELECT public.ca_product_label(p ->> 'brand', p ->> 'product_name', p ->> 'variant') AS pname
    ) n
    CROSS JOIN LATERAL (
      SELECT * FROM (VALUES
        (CASE WHEN p ->> 'match_status' = 'NOT_FOUND' THEN 'missing_product' END,
         'high', 'Missing product', public.safe_numeric(p ->> 'expected_facings'), 0::numeric),
        (CASE WHEN coalesce(p ->> 'min_max_facing_status', '') LIKE 'BELOW%' THEN 'planogram_violation' END,
         'medium', 'Fewer facings than planned', public.safe_numeric(p ->> 'expected_facings'), public.safe_numeric(p ->> 'actual_facings')),
        (CASE WHEN p ->> 'price_status' = 'MISMATCH' THEN 'pricing_issue' END,
         'high', 'Price mismatch', public.safe_numeric(p ->> 'expected_mrp_inr'), public.safe_numeric(p ->> 'visible_price'))
      ) v(ftype, sev, ttl, expv, actv)
      WHERE v.ftype IS NOT NULL
    ) x
    WHERE jsonb_typeof(p) = 'object';
  END IF;
END;
$$;
