-- Segment dashboards and reports: one read-only summary of completed AI audits.
-- SECURITY INVOKER so row-level security decides which scans, stores and actions the caller sees.

CREATE OR REPLACE FUNCTION public.aislix_jsonb_num(j jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN j IS NULL THEN NULL
    WHEN jsonb_typeof(j) = 'number' THEN (j #>> '{}')::numeric
    WHEN jsonb_typeof(j) = 'string' AND (j #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (j #>> '{}')::numeric
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.segment_dashboard(
  p_org_id uuid,
  p_from timestamptz DEFAULT now() - interval '30 days',
  p_to timestamptz DEFAULT now(),
  p_store_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH bounds AS (
  SELECT p_from AS cur_from, p_to AS cur_to, p_from - (p_to - p_from) AS prev_from
),
scans AS (
  SELECT
    s.id,
    s.store_id,
    s.created_at,
    s.created_at >= b.cur_from AS current_period,
    s.osa_percent::numeric AS osa,
    s.share_of_shelf_percent::numeric AS sos,
    s.shelf_health_score::numeric AS health,
    s.planogram_compliance_percent::numeric AS planogram,
    sr_read.shelf_read,
    CASE WHEN sr_read.shelf_read THEN
      COALESCE(aislix_jsonb_num(r.metrics -> 'shelf_gap_count'), s.out_of_stock_count::numeric)
    END AS gaps,
    CASE WHEN sr_read.shelf_read THEN s.low_stock_count::numeric END AS low_stock,
    CASE WHEN sr_read.shelf_read THEN s.misplaced_count::numeric END AS misplaced,
    CASE WHEN sr_read.shelf_read THEN
      COALESCE(aislix_jsonb_num(r.metrics -> 'total_facings'), aislix_jsonb_num(r.metrics -> 'total_actual_facings'))
    END AS facings,
    aislix_jsonb_num(r.metrics -> 'financial_impact' -> 'at_risk_sku_count') AS at_risk_skus,
    CASE WHEN r.metrics -> 'financial_impact' ->> 'estimate_status' = 'estimated' THEN
      COALESCE(
        aislix_jsonb_num(r.metrics -> 'financial_impact' -> 'potential_inventory_value_gap_inr'),
        aislix_jsonb_num(r.metrics -> 'financial_impact' -> 'estimated_daily_lost_sales_inr')
      )
    END AS value_gap,
    jsonb_typeof(s.capture_meta -> 'gps') = 'object' AS has_gps,
    COALESCE(s.capture_meta ->> 'mode' = 'guided_sweep', false) AS swept,
    r.brand_share
  FROM shelf_scans s
  CROSS JOIN bounds b
  LEFT JOIN LATERAL (
    SELECT sr.metrics, sr.brand_share
    FROM scan_results sr
    WHERE sr.scan_id = s.id
    ORDER BY sr.created_at DESC
    LIMIT 1
  ) r ON true
  -- Count columns default to 0; only trust them when the AI actually read the shelf.
  CROSS JOIN LATERAL (
    SELECT (
      s.osa_percent IS NOT NULL
      OR COALESCE(s.total_products, 0) > 0
      OR COALESCE(r.metrics ? 'shelf_gap_count', false)
    ) AS shelf_read
  ) sr_read
  WHERE s.org_id = p_org_id
    AND s.audit_mode = 'ai'
    AND s.status = 'completed'
    AND s.created_at >= b.prev_from
    AND s.created_at < b.cur_to
    AND (p_store_ids IS NULL OR s.store_id = ANY (p_store_ids))
),
cur AS (SELECT * FROM scans WHERE current_period),
prev AS (SELECT * FROM scans WHERE NOT current_period),
totals AS (
  SELECT jsonb_build_object(
    'audits', count(*),
    'stores', count(DISTINCT store_id),
    'shelf_read_audits', count(*) FILTER (WHERE shelf_read),
    'avg_osa', round(avg(osa), 1),
    'avg_sos', round(avg(sos), 1),
    'avg_health', round(avg(health), 1),
    'avg_planogram', round(avg(planogram), 1),
    'planogram_audits', count(planogram),
    'facings', sum(facings),
    'gaps', sum(gaps),
    'low_stock', sum(low_stock),
    'misplaced', sum(misplaced),
    'at_risk_skus', sum(at_risk_skus),
    'value_gap_inr', CASE WHEN count(value_gap) > 0 THEN round(sum(value_gap), 0) END,
    'priced_audits', count(value_gap),
    'gps_audits', count(*) FILTER (WHERE has_gps),
    'sweep_audits', count(*) FILTER (WHERE swept)
  ) AS j
  FROM cur
),
previous AS (
  SELECT jsonb_build_object(
    'audits', count(*),
    'stores', count(DISTINCT store_id),
    'avg_osa', round(avg(osa), 1),
    'avg_sos', round(avg(sos), 1),
    'avg_health', round(avg(health), 1),
    'gaps', sum(gaps),
    'low_stock', sum(low_stock),
    'misplaced', sum(misplaced)
  ) AS j
  FROM prev
),
trend AS (
  SELECT COALESCE(jsonb_agg(t ORDER BY t.week), '[]'::jsonb) AS j
  FROM (
    SELECT
      date_trunc('week', created_at)::date AS week,
      count(*) AS audits,
      round(avg(osa), 1) AS avg_osa,
      round(avg(sos), 1) AS avg_sos,
      round(avg(health), 1) AS avg_health,
      sum(gaps) AS gaps,
      sum(low_stock) AS low_stock
    FROM cur
    GROUP BY 1
  ) t
),
per_store AS (
  SELECT COALESCE(jsonb_agg(t ORDER BY t.audits DESC, t.store_name), '[]'::jsonb) AS j
  FROM (
    SELECT
      c.store_id,
      COALESCE(st.name, 'Unassigned store') AS store_name,
      st.store_type,
      st.city,
      count(*) AS audits,
      max(c.created_at) AS last_audit,
      round(avg(c.osa), 1) AS avg_osa,
      round(avg(c.sos), 1) AS avg_sos,
      round(avg(c.health), 1) AS avg_health,
      sum(c.gaps) AS gaps,
      sum(c.low_stock) AS low_stock,
      sum(c.misplaced) AS misplaced,
      CASE WHEN count(c.value_gap) > 0 THEN round(sum(c.value_gap), 0) END AS value_gap_inr,
      count(*) FILTER (WHERE c.has_gps) AS gps_audits
    FROM cur c
    LEFT JOIN stores st ON st.id = c.store_id
    GROUP BY c.store_id, st.name, st.store_type, st.city
  ) t
),
brand_rows AS (
  SELECT *
  FROM (
    SELECT
      c.id AS scan_id,
      btrim(e ->> 'brand') AS brand,
      lower(regexp_replace(COALESCE(e ->> 'brand', ''), '[^[:alnum:]]', '', 'g')) AS brand_key,
      aislix_jsonb_num(e -> 'share') AS share
    FROM cur c
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(c.brand_share) = 'array' THEN c.brand_share ELSE '[]'::jsonb END
    ) e
  ) x
  WHERE brand_key NOT IN ('', 'unknown', 'unbranded', 'unidentified', 'generic', 'na', 'none', 'other', 'others')
),
brand_audits AS (
  SELECT count(*) AS n
  FROM cur
  WHERE jsonb_typeof(brand_share) = 'array' AND jsonb_array_length(brand_share) > 0
),
brands AS (
  SELECT COALESCE(jsonb_agg(t ORDER BY t.avg_share DESC), '[]'::jsonb) AS j
  FROM (
    SELECT
      mode() WITHIN GROUP (ORDER BY br.brand) AS brand,
      round(sum(br.share) / NULLIF((SELECT n FROM brand_audits), 0), 1) AS avg_share,
      count(DISTINCT br.scan_id) AS audits_seen
    FROM brand_rows br
    GROUP BY br.brand_key
    ORDER BY 2 DESC NULLS LAST
    LIMIT 10
  ) t
),
actions AS (
  SELECT jsonb_build_object(
    'open', count(*) FILTER (WHERE ca.status NOT IN ('closed', 'resolved', 'verified', 'cancelled')),
    'overdue', count(*) FILTER (
      WHERE ca.status NOT IN ('closed', 'resolved', 'verified', 'cancelled')
        AND (ca.status = 'overdue' OR ca.due_at < now())
    ),
    'critical_open', count(*) FILTER (
      WHERE ca.status NOT IN ('closed', 'resolved', 'verified', 'cancelled') AND ca.priority = 'critical'
    ),
    'created_in_period', count(*) FILTER (WHERE ca.created_at >= p_from AND ca.created_at < p_to),
    'closed_in_period', count(*) FILTER (WHERE ca.closed_at >= p_from AND ca.closed_at < p_to)
  ) AS j
  FROM corrective_actions ca
  WHERE ca.org_id = p_org_id
    AND (p_store_ids IS NULL OR ca.store_id = ANY (p_store_ids))
)
SELECT jsonb_build_object(
  'from', p_from,
  'to', p_to,
  'totals', (SELECT j FROM totals),
  'previous', (SELECT j FROM previous),
  'trend', (SELECT j FROM trend),
  'stores', (SELECT j FROM per_store),
  'brands', (SELECT j FROM brands),
  'brand_audits', (SELECT n FROM brand_audits),
  'actions', (SELECT j FROM actions)
);
$$;

GRANT EXECUTE ON FUNCTION public.aislix_jsonb_num(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.segment_dashboard(uuid, timestamptz, timestamptz, uuid[]) TO authenticated;

COMMENT ON FUNCTION public.segment_dashboard(uuid, timestamptz, timestamptz, uuid[]) IS
  'Completed AI audits only: period totals vs previous period, weekly trend, per-store, top brands and corrective actions. Value at risk only from priced audits (null otherwise).';
