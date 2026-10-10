-- Completed AI audits from before automatic AI findings (2026-10-05) never got findings, so the
-- Findings register was missing them. Add their detected issues as closed, historical findings:
-- dated to the audit, no SLA, and (because they are closed) no corrective action is opened.

INSERT INTO public.findings (
  org_id, scan_id, assignment_id, store_id, comparison_line_id,
  source_type, source_id, audit_origin, finding_type, severity, confirmation_state,
  title, description, sku, product_name, category, shelf_label,
  expected_value, actual_value, variance_units,
  status, created_at, updated_at, closed_at
)
SELECT
  s.org_id, s.id, s.assignment_id, s.store_id,
  CASE WHEN i.from_comparison THEN substr(i.issue_key, 5)::uuid END,
  CASE
    WHEN i.from_comparison THEN 'planogram_line'
    WHEN i.issue_key LIKE 'alert:%' THEN 'ai_alert'
    ELSE 'ai_row'
  END,
  CASE
    WHEN i.from_comparison THEN substr(i.issue_key, 5)::uuid
    ELSE md5(s.id::text || ':' || i.issue_key)::uuid
  END,
  CASE WHEN s.audit_mode = 'ai_assisted' THEN 'ai_assisted' ELSE 'ai' END,
  i.finding_type, i.severity, 'ai_suggested',
  CASE
    WHEN NOT i.from_comparison THEN i.title
    WHEN i.finding_type = 'missing_product' THEN 'Missing product'
    WHEN i.finding_type = 'wrong_placement' THEN 'Wrong placement'
    WHEN i.finding_type = 'out_of_stock' THEN 'Out of stock'
    WHEN i.finding_type = 'planogram_violation' THEN 'Planogram violation'
    ELSE 'Shelf execution issue'
  END,
  i.description, i.sku, i.product_name, i.category, i.shelf_label,
  i.expected_value, i.actual_value,
  CASE WHEN i.expected_value IS NOT NULL AND i.actual_value IS NOT NULL THEN i.actual_value - i.expected_value END,
  'closed', s.created_at, now(), s.created_at
FROM public.shelf_scans s
CROSS JOIN LATERAL public.ai_scan_issues(s.id) i
WHERE s.status::text = 'completed'
  AND coalesce(s.audit_mode, 'ai') <> 'digital'
  AND coalesce(s.reaudit_reason, '') NOT LIKE 'corrective_action:%'
  AND NOT EXISTS (SELECT 1 FROM public.findings f WHERE f.scan_id = s.id)
ON CONFLICT (org_id, source_type, source_id) DO NOTHING;
