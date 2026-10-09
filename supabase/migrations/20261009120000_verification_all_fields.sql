-- Human verification for every AI field (presence, brand, product, facings, units, location,
-- price, promotion), keyed per product row so planned-but-not-found products can be verified.
-- A verification that disproves an AI finding moves its corrective action to
-- pending_verification ("Resolved by verification") for manager approval; clearing the
-- verification puts the action back where it was.

ALTER TABLE public.scan_field_verifications
  ADD COLUMN IF NOT EXISTS row_key TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS variant TEXT,
  ADD COLUMN IF NOT EXISTS ai_text TEXT,
  ADD COLUMN IF NOT EXISTS verified_text TEXT;

UPDATE public.scan_field_verifications
SET row_key = 'dp:' || detected_product_id::text
WHERE row_key IS NULL AND detected_product_id IS NOT NULL;

DELETE FROM public.scan_field_verifications WHERE row_key IS NULL;

CREATE OR REPLACE FUNCTION public.sfv_fill_row_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.row_key IS NULL AND NEW.detected_product_id IS NOT NULL THEN
    NEW.row_key := 'dp:' || NEW.detected_product_id::text;
  END IF;
  IF NEW.row_key IS NULL THEN
    RAISE EXCEPTION 'Verification row needs a product row key.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scan_field_verifications_row_key ON public.scan_field_verifications;
CREATE TRIGGER scan_field_verifications_row_key
  BEFORE INSERT OR UPDATE ON public.scan_field_verifications
  FOR EACH ROW EXECUTE FUNCTION public.sfv_fill_row_key();

ALTER TABLE public.scan_field_verifications ALTER COLUMN row_key SET NOT NULL;

ALTER TABLE public.scan_field_verifications DROP CONSTRAINT IF EXISTS scan_field_verifications_field_key_check;
ALTER TABLE public.scan_field_verifications ADD CONSTRAINT scan_field_verifications_field_key_check CHECK (
  field_key IN ('present', 'brand', 'product', 'facings', 'visible_units', 'location', 'price', 'promotion')
);

CREATE UNIQUE INDEX IF NOT EXISTS scan_field_verifications_row_field_uniq
  ON public.scan_field_verifications (scan_id, row_key, field_key);

ALTER TABLE public.corrective_actions
  ADD COLUMN IF NOT EXISTS resolved_by_verification BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pre_verification JSONB;

-- ---------------------------------------------------------------------------
-- AI findings: also raise wrong-location (only when the expected label was read in the photo,
-- see location_status) and promotion-not-seen; accept every facing range status key.
-- ---------------------------------------------------------------------------
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
      coalesce(x.descr, nullif(l ->> 'raw_text', '')),
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
         'high', 'Missing product', public.safe_numeric(l ->> 'invoice_qty'), 0::numeric, NULL::text),
        (CASE WHEN l ->> 'qty_status' = 'BELOW_DOCUMENT' THEN 'planogram_violation' END,
         'medium', 'Below planned quantity', public.safe_numeric(l ->> 'invoice_qty'), public.safe_numeric(l ->> 'shelf_units'), NULL::text),
        (CASE WHEN l ->> 'price_status' = 'MISMATCH' THEN 'pricing_issue' END,
         'high', 'Price mismatch', public.safe_numeric(l ->> 'expected_price'), public.safe_numeric(l ->> 'visible_price'), NULL::text),
        (CASE WHEN upper(coalesce(l ->> 'promo_status', '')) IN ('PROMO_NOT_SEEN', 'MISSING', 'MISMATCH', 'NOT_FOUND') THEN 'display_issue' END,
         'medium', 'Promotion missing', NULL::numeric, NULL::numeric,
         nullif('Expected offer: ' || coalesce(l ->> 'expected_promo', ''), 'Expected offer: ')),
        (CASE WHEN upper(coalesce(l ->> 'location_status', '')) = 'WRONG_LOCATION' THEN 'wrong_placement' END,
         'high', 'Wrong location', NULL::numeric, NULL::numeric,
         'Expected at ' || coalesce(l ->> 'expected_location', '?') || ', AI read ' || coalesce(l ->> 'shelf_location_label', 'no label'))
      ) v(ftype, sev, ttl, expv, actv, descr)
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
      coalesce(x.descr, nullif(p ->> 'location', '')),
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
         'high', 'Missing product', public.safe_numeric(p ->> 'expected_facings'), 0::numeric, NULL::text),
        (CASE WHEN coalesce(p ->> 'min_max_facing_status', p ->> 'facing_range_status', p ->> 'facings_range_status', '') LIKE 'BELOW%' THEN 'planogram_violation' END,
         'medium', 'Fewer facings than planned', public.safe_numeric(p ->> 'expected_facings'), public.safe_numeric(p ->> 'actual_facings'), NULL::text),
        (CASE WHEN p ->> 'price_status' = 'MISMATCH' THEN 'pricing_issue' END,
         'high', 'Price mismatch', public.safe_numeric(p ->> 'expected_mrp_inr'), public.safe_numeric(p ->> 'visible_price'), NULL::text),
        (CASE WHEN upper(coalesce(p ->> 'location_status', '')) = 'WRONG_LOCATION' THEN 'wrong_placement' END,
         'high', 'Wrong location', NULL::numeric, NULL::numeric,
         'Expected at ' || coalesce(p ->> 'expected_location', p ->> 'location', '?') || ', AI read ' || coalesce(p ->> 'actual_location_label', 'no label'))
      ) v(ftype, sev, ttl, expv, actv, descr)
      WHERE v.ftype IS NOT NULL
    ) x
    WHERE jsonb_typeof(p) = 'object';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Verification → corrective actions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verification_name_keys(p_brand TEXT, p_product TEXT, p_variant TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT array_remove(ARRAY[
    nullif(public.ca_signature('', public.ca_product_label(p_brand, p_product, p_variant)), '|'),
    nullif(public.ca_signature('', public.ca_product_label(NULL, p_product, p_variant)), '|')
  ], NULL)
$$;

CREATE OR REPLACE FUNCTION public.verification_norm_label(p TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(regexp_replace(upper(coalesce(p, '')), '[^A-Z0-9]+', '', 'g'), '')
$$;

/** Text explaining why the human verification disproves the finding, or NULL when it does not. */
CREATE OR REPLACE FUNCTION public.verification_disproves(
  p_type TEXT, p_title TEXT, p_description TEXT, p_expected NUMERIC, p_shelf_label TEXT,
  p_present NUMERIC, p_facings NUMERIC, p_units NUMERIC, p_price NUMERIC,
  p_location TEXT, p_promotion TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_type IN ('missing_product', 'out_of_stock')
         AND (p_present = 1 OR p_facings > 0 OR p_units > 0)
      THEN 'Human verification: the product is on the shelf'
           || CASE WHEN p_facings > 0 THEN ' (' || p_facings::text || ' facings).' ELSE '.' END
    WHEN p_type = 'planogram_violation' AND coalesce(p_title, '') ILIKE '%quantity%'
         AND p_expected IS NOT NULL AND p_units >= p_expected
      THEN 'Human verification: ' || p_units::text || ' units on the shelf meet the planned ' || p_expected::text || '.'
    WHEN p_type = 'planogram_violation' AND coalesce(p_title, '') NOT ILIKE '%quantity%'
         AND coalesce(p_description, '') NOT ILIKE 'Expected sub-category%'
         AND p_expected IS NOT NULL AND p_facings >= p_expected
      THEN 'Human verification: ' || p_facings::text || ' facings meet the planned ' || p_expected::text || '.'
    WHEN p_type = 'pricing_issue' AND p_expected IS NOT NULL AND p_price IS NOT NULL
         AND round(p_price, 2) = round(p_expected, 2)
      THEN 'Human verification: the shelf price ₹' || p_price::text || ' matches the planned price.'
    WHEN p_type = 'display_issue' AND coalesce(p_title, '') ILIKE 'Promotion%'
         AND nullif(btrim(coalesce(p_promotion, '')), '') IS NOT NULL
      THEN 'Human verification: the promotion is on the shelf ("' || btrim(p_promotion) || '").'
    WHEN p_type = 'wrong_placement' AND public.verification_norm_label(p_shelf_label) IS NOT NULL
         AND public.verification_norm_label(p_location) = public.verification_norm_label(p_shelf_label)
      THEN 'Human verification: the product is at the planned location ' || p_shelf_label || '.'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.apply_scan_verifications(p_scan_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_n INTEGER := 0;
BEGIN
  FOR r IN
    WITH vrows AS (
      SELECT
        v.row_key,
        public.verification_name_keys(max(v.brand), max(v.product_name), max(v.variant)) AS keys,
        max(v.verified_value) FILTER (WHERE v.field_key = 'present') AS present,
        max(v.verified_value) FILTER (WHERE v.field_key = 'facings') AS facings,
        max(v.verified_value) FILTER (WHERE v.field_key = 'visible_units') AS units,
        max(v.verified_value) FILTER (WHERE v.field_key = 'price') AS price,
        max(v.verified_text) FILTER (WHERE v.field_key = 'location') AS location,
        max(v.verified_text) FILTER (WHERE v.field_key = 'promotion') AS promotion
      FROM public.scan_field_verifications v
      WHERE v.scan_id = p_scan_id
      GROUP BY v.row_key
    ),
    cands AS (
      SELECT f.id AS finding_id, ca.id AS action_id, ca.status, ca.resolved_by_verification,
        ca.pre_verification, ca.root_cause, ca.preventive_action, ca.resolution_notes, f.status AS finding_status,
        (
          SELECT public.verification_disproves(
            f.finding_type, f.title, f.description, f.expected_value, f.shelf_label,
            vr.present, vr.facings, vr.units, vr.price, vr.location, vr.promotion)
          FROM vrows vr
          WHERE public.ca_signature('', f.product_name) = ANY (vr.keys)
          ORDER BY 1 NULLS LAST
          LIMIT 1
        ) AS reason
      FROM public.findings f
      JOIN public.corrective_actions ca ON ca.finding_id = f.id
      WHERE f.scan_id = p_scan_id
        AND f.source_type IN ('ai_row', 'ai_alert', 'planogram_line')
        AND coalesce(f.product_name, '') <> ''
    )
    SELECT * FROM cands
  LOOP
    IF r.reason IS NOT NULL
       AND r.status IN ('open', 'assigned', 'in_progress', 'overdue', 'rejected') THEN
      UPDATE public.corrective_actions SET
        pre_verification = jsonb_build_object(
          'status', r.status,
          'root_cause', r.root_cause,
          'preventive_action', r.preventive_action,
          'resolution_notes', r.resolution_notes,
          'finding_status', r.finding_status
        ),
        resolved_by_verification = true,
        root_cause = coalesce(nullif(btrim(r.root_cause), ''), 'AI count corrected by human verification.'),
        preventive_action = coalesce(nullif(btrim(r.preventive_action), ''), 'No shelf correction needed.'),
        resolution_notes = r.reason,
        verification_method = 'manager_review',
        status = 'pending_verification',
        updated_at = now()
      WHERE id = r.action_id;
      UPDATE public.findings SET status = 'pending_verification', rca_code = 'counting_error',
        rca_notes = r.reason, updated_at = now()
      WHERE id = r.finding_id;
      INSERT INTO public.audit_activity_events (org_id, scan_id, finding_id, action_id, actor_id, event_type, summary)
      SELECT ca.org_id, p_scan_id, r.finding_id, r.action_id, auth.uid(), 'resolved_by_verification', r.reason
      FROM public.corrective_actions ca WHERE ca.id = r.action_id;
      v_n := v_n + 1;
    ELSIF r.reason IS NULL AND r.resolved_by_verification AND r.status = 'pending_verification' THEN
      UPDATE public.corrective_actions SET
        status = coalesce(r.pre_verification ->> 'status', 'open'),
        root_cause = r.pre_verification ->> 'root_cause',
        preventive_action = r.pre_verification ->> 'preventive_action',
        resolution_notes = r.pre_verification ->> 'resolution_notes',
        submitted_at = NULL,
        resolved_by_verification = false,
        pre_verification = NULL,
        updated_at = now()
      WHERE id = r.action_id;
      UPDATE public.findings SET status = coalesce(r.pre_verification ->> 'finding_status', 'open'),
        rca_code = NULL, rca_notes = NULL, updated_at = now()
      WHERE id = r.finding_id;
      INSERT INTO public.audit_activity_events (org_id, scan_id, finding_id, action_id, actor_id, event_type, summary)
      SELECT ca.org_id, p_scan_id, r.finding_id, r.action_id, auth.uid(), 'verification_reverted',
        'Human verification changed; the AI finding is open again.'
      FROM public.corrective_actions ca WHERE ca.id = r.action_id;
      v_n := v_n + 1;
    END IF;
  END LOOP;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.scan_field_verifications_apply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.apply_scan_verifications(coalesce(NEW.scan_id, OLD.scan_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS scan_field_verifications_apply ON public.scan_field_verifications;
CREATE TRIGGER scan_field_verifications_apply
  AFTER INSERT OR UPDATE OR DELETE ON public.scan_field_verifications
  FOR EACH ROW EXECUTE FUNCTION public.scan_field_verifications_apply();

-- Findings created after a verification was saved still get the verification applied.
CREATE OR REPLACE FUNCTION public.findings_apply_verifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.scan_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.scan_field_verifications v WHERE v.scan_id = NEW.scan_id
  ) THEN
    PERFORM public.apply_scan_verifications(NEW.scan_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS corrective_actions_apply_verifications ON public.corrective_actions;
CREATE TRIGGER corrective_actions_apply_verifications
  AFTER INSERT ON public.corrective_actions
  FOR EACH ROW EXECUTE FUNCTION public.findings_apply_verifications();
