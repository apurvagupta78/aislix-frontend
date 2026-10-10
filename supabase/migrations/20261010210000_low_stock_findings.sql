-- AI low-stock items become findings in every audit mode.
--   * Identified products the AI marked low stock -> one "Low stock" finding per product
--     (none visible -> "Possible out of stock — verification required").
--   * Items the AI could not identify (no brand, "partially visible …") -> one
--     "Possible out of stock — verification required" finding per audit.
-- Rows use the 'alert:stock:' key so they sync as ai_alert findings (re-checkable without a plan).

ALTER TABLE public.findings DROP CONSTRAINT IF EXISTS findings_finding_type_check;
ALTER TABLE public.findings ADD CONSTRAINT findings_finding_type_check CHECK (
  finding_type IN (
    'inventory_shortage', 'inventory_excess', 'out_of_stock', 'low_stock', 'wrong_placement',
    'planogram_violation', 'pricing_issue', 'damaged_product', 'expired_product', 'near_expiry',
    'missing_product', 'receiving_issue', 'display_issue', 'shelf_execution_issue', 'other'
  )
);

CREATE OR REPLACE FUNCTION public.ca_action_type(p_finding_type text, p_text text DEFAULT NULL::text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_finding_type IN ('out_of_stock', 'low_stock', 'missing_product') THEN 'availability'
    WHEN p_finding_type IN ('planogram_violation', 'wrong_placement', 'shelf_execution_issue') THEN 'planogram'
    WHEN p_finding_type = 'pricing_issue' THEN 'pricing'
    WHEN p_finding_type = 'display_issue' THEN 'display'
    WHEN p_finding_type IN ('inventory_shortage', 'inventory_excess', 'damaged_product', 'near_expiry') THEN 'inventory'
    WHEN p_finding_type = 'expired_product' THEN 'compliance'
    WHEN p_finding_type = 'receiving_issue' THEN 'process'
    WHEN lower(coalesce(p_text, '')) ~ '(fire|extinguisher|safety|emergency|exit|hazard|first aid|electrical)' THEN 'safety'
    WHEN lower(coalesce(p_text, '')) ~ '(clean|hygien|pest|sanit|wash|dust|spill|garbage|waste)' THEN 'hygiene'
    WHEN lower(coalesce(p_text, '')) ~ '(temperature|log|record|register|document|certificate|licen|signature)' THEN 'documentation'
    WHEN lower(coalesce(p_text, '')) ~ 'train' THEN 'training'
    WHEN lower(coalesce(p_text, '')) ~ '(price|tag|mrp)' THEN 'pricing'
    WHEN lower(coalesce(p_text, '')) ~ '(display|promo|banner|signage|offer)' THEN 'display'
    WHEN lower(coalesce(p_text, '')) ~ '(fifo|expir|stock|inventory|count|damage)' THEN 'inventory'
    WHEN lower(coalesce(p_text, '')) ~ '(planogram|facing|shelf)' THEN 'planogram'
    WHEN lower(coalesce(p_text, '')) ~ '(sop|process|procedure|checklist)' THEN 'process'
    ELSE 'compliance'
  END
$$;

CREATE OR REPLACE FUNCTION public.ca_catalog(p_action_type text, p_finding_type text, p_source text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'action', CASE p_finding_type
      WHEN 'out_of_stock' THEN 'Refill the shelf from backroom stock. If there is no stock, raise a replenishment order.'
      WHEN 'low_stock' THEN 'Top up the shelf to full facings from backroom stock. If there is no stock, raise a replenishment order.'
      WHEN 'missing_product' THEN 'Place the missing product in its planned shelf position.'
      WHEN 'wrong_placement' THEN 'Move the product back to its planned shelf and category.'
      WHEN 'planogram_violation' THEN 'Reset the facings so the shelf matches the plan.'
      WHEN 'shelf_execution_issue' THEN 'Correct the shelf layout and facings.'
      WHEN 'pricing_issue' THEN 'Replace the shelf price tag with the correct price.'
      WHEN 'display_issue' THEN 'Fix the display or promotion so it matches the plan.'
      WHEN 'inventory_shortage' THEN 'Recount the item and reconcile the gap with system stock.'
      WHEN 'inventory_excess' THEN 'Recount the item and correct system stock or move the excess to the backroom.'
      WHEN 'damaged_product' THEN 'Remove the damaged units from the shelf and record the write-off.'
      WHEN 'expired_product' THEN 'Remove expired stock from the shelf and record the disposal.'
      WHEN 'near_expiry' THEN 'Move near-expiry stock to the front (FIFO) or mark it down.'
      WHEN 'receiving_issue' THEN 'Complete the pending receiving and update stock.'
      ELSE CASE p_action_type
        WHEN 'safety' THEN 'Fix the safety issue and confirm the area is safe.'
        WHEN 'hygiene' THEN 'Clean the area and confirm it meets the hygiene standard.'
        WHEN 'documentation' THEN 'Complete the missing record and upload a copy.'
        WHEN 'training' THEN 'Train the team on the standard and record who attended.'
        WHEN 'process' THEN 'Follow the SOP and confirm the step is done.'
        ELSE 'Fix the failed check and upload proof.'
      END
    END,
    'evidence', CASE
      WHEN p_action_type IN ('availability', 'planogram', 'pricing', 'display') THEN '["after_photo"]'::jsonb
      WHEN p_action_type = 'documentation' THEN '["document"]'::jsonb
      WHEN p_action_type = 'training' THEN '["document", "notes"]'::jsonb
      ELSE '["after_photo", "notes"]'::jsonb
    END,
    'verification', CASE
      WHEN p_source = 'ai' AND p_action_type IN ('availability', 'planogram', 'pricing', 'display') THEN 'ai_rescan'
      WHEN p_action_type = 'documentation' THEN 'document'
      ELSE 'manager_review'
    END
  )
$$;

-- True when the AI could not name the item (no brand, or a placeholder such as "partially visible packet").
CREATE OR REPLACE FUNCTION public.is_unidentified_product(p_brand text, p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(nullif(lower(btrim(p_brand)), ''), 'unknown')
           IN ('unknown', 'unidentified', 'n/a', 'na', 'none', 'null', 'unbranded', 'generic', 'other')
      OR coalesce(p_name, '') ~* '(partially visible|partly visible|not readable|unreadable|unidentified|illegible|obscured|blurred)'
      OR coalesce(p_name, '') ~* '^\s*(unknown|generic|unlabell?ed)\M'
$$;

CREATE OR REPLACE FUNCTION public.ai_scan_stock_issues(p_scan_id UUID)
RETURNS TABLE(issue_key text, signature text, finding_type text, severity text, title text, description text, sku text, product_name text, category text, shelf_label text, expected_value numeric, actual_value numeric, from_comparison boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH thr AS (
    SELECT coalesce(public.safe_numeric(r.metrics ->> 'low_stock_threshold'), 2)::int AS n
    FROM public.scan_results r
    WHERE r.scan_id = p_scan_id
    ORDER BY r.updated_at DESC
    LIMIT 1
  ),
  low AS (
    SELECT d.*, public.is_unidentified_product(d.brand, d.name) AS unidentified,
      CASE
        WHEN nullif(btrim(d.brand), '') IS NOT NULL
         AND left(regexp_replace(lower(d.name), '[^a-z0-9]+', '', 'g'),
                  length(regexp_replace(lower(d.brand), '[^a-z0-9]+', '', 'g')))
             = regexp_replace(lower(d.brand), '[^a-z0-9]+', '', 'g')
        THEN public.ca_product_label(NULL, d.name, d.variant)
        ELSE public.ca_product_label(d.brand, d.name, d.variant)
      END AS label
    FROM public.detected_products d
    WHERE d.scan_id = p_scan_id AND d.stock_status = 'low_stock'
  ),
  named AS (
    SELECT DISTINCT ON (lower(l.label))
      l.label, l.sku, l.category, l.facings, l.expected_facings
    FROM low l
    WHERE NOT l.unidentified AND l.label IS NOT NULL
    ORDER BY lower(l.label), l.facings
  ),
  unnamed AS (
    SELECT count(*) AS n,
      string_agg(DISTINCT l.name, '; ') AS names
    FROM low l
    WHERE l.unidentified OR l.label IS NULL
  )
  SELECT
    'alert:stock:' || md5(lower(n.label)),
    public.ca_signature(x.ftype, n.label),
    x.ftype,
    x.sev,
    x.ttl,
    CASE WHEN n.facings <= 0
      THEN 'AI did not count any facings of this product. Check the shelf and confirm whether it is out of stock.'
      ELSE 'AI counted ' || n.facings || ' facing' || CASE WHEN n.facings = 1 THEN '' ELSE 's' END
        || ', at or below the low-stock level of ' || (SELECT coalesce(max(t.n), 2) FROM thr t) || '.'
    END,
    nullif(n.sku, ''),
    n.label,
    nullif(n.category, ''),
    NULL::text,
    n.expected_facings::numeric,
    n.facings::numeric,
    false
  FROM named n
  CROSS JOIN LATERAL (
    SELECT
      CASE WHEN n.facings <= 0 THEN 'out_of_stock' ELSE 'low_stock' END AS ftype,
      CASE WHEN n.facings <= 0 THEN 'high' ELSE 'medium' END AS sev,
      CASE WHEN n.facings <= 0 THEN 'Possible out of stock — verification required' ELSE 'Low stock' END AS ttl
  ) x
  UNION ALL
  SELECT
    'alert:stock:unidentified',
    public.ca_signature('out_of_stock', 'Unidentified items'),
    'out_of_stock',
    'medium',
    'Possible out of stock — verification required',
    'AI flagged ' || u.n || ' item' || CASE WHEN u.n = 1 THEN '' ELSE 's' END
      || ' it could not identify as low or possibly out of stock ('
      || left(u.names, 240) || '). Check the shelf and confirm.',
    NULL::text, 'Unidentified items', NULL::text, NULL::text, NULL::numeric, u.n::numeric, false
  FROM unnamed u
  WHERE u.n > 0
$$;

DO $$
BEGIN
  IF to_regprocedure('public.ai_scan_plan_issues(uuid)') IS NULL THEN
    ALTER FUNCTION public.ai_scan_issues(UUID) RENAME TO ai_scan_plan_issues;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_scan_issues(p_scan_id UUID)
RETURNS TABLE(issue_key text, signature text, finding_type text, severity text, title text, description text, sku text, product_name text, category text, shelf_label text, expected_value numeric, actual_value numeric, from_comparison boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.ai_scan_plan_issues(p_scan_id)
  UNION ALL
  SELECT * FROM public.ai_scan_stock_issues(p_scan_id)
$$;

REVOKE ALL ON FUNCTION public.ai_scan_plan_issues(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ai_scan_stock_issues(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ai_scan_issues(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_scan_plan_issues(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_scan_stock_issues(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_scan_issues(UUID) TO service_role;

-- Backfill: audits from the last 7 days get their stock findings as open (a fix opens automatically).
INSERT INTO public.findings (
  org_id, scan_id, assignment_id, store_id, source_type, source_id, audit_origin,
  finding_type, severity, confirmation_state, title, description, sku, product_name,
  category, shelf_label, expected_value, actual_value, variance_units, due_at, created_at
)
SELECT
  s.org_id, s.id, s.assignment_id, s.store_id, 'ai_alert',
  md5(s.id::text || ':' || i.issue_key)::uuid,
  CASE WHEN s.audit_mode = 'ai_assisted' THEN 'ai_assisted' ELSE 'ai' END,
  i.finding_type, i.severity, 'ai_suggested', i.title, i.description, i.sku,
  i.product_name, i.category, i.shelf_label, i.expected_value, i.actual_value,
  CASE WHEN i.expected_value IS NOT NULL AND i.actual_value IS NOT NULL THEN i.actual_value - i.expected_value END,
  now() + make_interval(hours => public.sla_hours_for_severity(s.org_id, i.severity)),
  s.created_at
FROM public.shelf_scans s
CROSS JOIN LATERAL public.ai_scan_stock_issues(s.id) i
WHERE s.status::text = 'completed'
  AND coalesce(s.audit_mode, 'ai') <> 'digital'
  AND s.parent_scan_id IS NULL
  AND coalesce(s.reaudit_reason, '') NOT LIKE 'corrective_action:%'
  AND s.created_at >= now() - interval '7 days'
ON CONFLICT (org_id, source_type, source_id) DO NOTHING;
