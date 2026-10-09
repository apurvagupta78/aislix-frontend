-- At the end of every AI / Digital audit the auditor (or a manager) picks a corrective action and
-- an SLA for each product with a problem, assigns them to one person and submits. With no issues
-- they submit for closure instead. Every action carries one of five issue types.

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------
ALTER TABLE public.corrective_actions
  ADD COLUMN IF NOT EXISTS issue_category TEXT,
  ADD COLUMN IF NOT EXISTS issue_detail TEXT,
  ADD COLUMN IF NOT EXISTS raised_manually BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.corrective_actions DROP CONSTRAINT IF EXISTS corrective_actions_issue_category_check;
ALTER TABLE public.corrective_actions ADD CONSTRAINT corrective_actions_issue_category_check CHECK (
  issue_category IS NULL OR issue_category IN ('location', 'quantity', 'facing', 'branding', 'other')
);

ALTER TABLE public.shelf_scans
  ADD COLUMN IF NOT EXISTS action_review_status TEXT,
  ADD COLUMN IF NOT EXISTS action_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS action_reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS action_review_note TEXT;

ALTER TABLE public.shelf_scans DROP CONSTRAINT IF EXISTS shelf_scans_action_review_status_check;
ALTER TABLE public.shelf_scans ADD CONSTRAINT shelf_scans_action_review_status_check CHECK (
  action_review_status IS NULL OR action_review_status IN ('actions_assigned', 'closed_no_issue')
);

-- ---------------------------------------------------------------------------
-- 2. Issue type for actions raised by the AI or older flows (mirrored in corrective-action-catalog.ts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ca_issue_category(p_issue_type TEXT, p_action_type TEXT, p_title TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN t ~ 'facing' THEN 'facing'
    WHEN t ~ '(placement|location|wrong_category|unexpected|misplac|planogram_violation|wrong_aisle)' THEN 'location'
    WHEN t ~ '(qty|quantity|shortage|excess|missing|out_of_stock|oos|low_stock|empty|gap)' THEN 'quantity'
    WHEN t ~ '(brand|display|wrong_product|variant|promo)' THEN 'branding'
    WHEN t ~ '(damage|expir|pric)' THEN 'other'
    WHEN h ~ 'facing' THEN 'facing'
    WHEN h ~ '(location|placement|aisle|misplaced)' THEN 'location'
    WHEN a IN ('availability', 'inventory') THEN 'quantity'
    WHEN a = 'display' THEN 'branding'
    WHEN a = 'planogram' THEN 'location'
    ELSE 'other'
  END
  FROM (
    SELECT lower(coalesce(p_issue_type, '')) AS t,
           lower(coalesce(p_title, '')) AS h,
           lower(coalesce(p_action_type, '')) AS a
  ) x;
$$;

CREATE OR REPLACE FUNCTION public.ca_fill_issue_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.issue_category := COALESCE(
    NEW.issue_category,
    public.ca_issue_category(NEW.issue_type, NEW.action_type, NEW.title)
  );
  RETURN NEW;
END;
$$;

-- Runs after corrective_actions_fill_defaults (alphabetical), so action_type is already set.
DROP TRIGGER IF EXISTS corrective_actions_fill_issue_category ON public.corrective_actions;
CREATE TRIGGER corrective_actions_fill_issue_category
  BEFORE INSERT OR UPDATE ON public.corrective_actions
  FOR EACH ROW EXECUTE FUNCTION public.ca_fill_issue_category();

-- ---------------------------------------------------------------------------
-- 3. Submit the audit's corrective actions (or close it with no issues)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_audit_actions(
  p_scan_id UUID,
  p_items JSONB,
  p_assignee UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_now TIMESTAMPTZ := now();
  v_org UUID;
  v_store UUID;
  v_mode TEXT;
  v_status TEXT;
  v_owner UUID;
  v_items JSONB := COALESCE(p_items, '[]'::jsonb);
  v_item JSONB;
  v_cat TEXT;
  v_detail TEXT;
  v_product TEXT;
  v_sku TEXT;
  v_mins INT;
  v_subject TEXT;
  v_id UUID;
  v_ids UUID[] := '{}';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to submit this audit.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_review_scan_actions(p_scan_id) THEN
    RAISE EXCEPTION 'Only the auditor or a manager can submit corrective actions for this audit.'
      USING ERRCODE = '42501';
  END IF;

  SELECT s.org_id, s.store_id, s.audit_mode, s.action_review_status
  INTO v_org, v_store, v_mode, v_status
  FROM public.shelf_scans s WHERE s.id = p_scan_id
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Audit not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_status IS NOT NULL THEN
    RAISE EXCEPTION 'Corrective actions for this audit were already submitted.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) > 300 THEN
    RAISE EXCEPTION 'Too many corrective actions in one audit.' USING ERRCODE = '22023';
  END IF;

  v_owner := COALESCE(p_assignee, v_uid);
  IF jsonb_array_length(v_items) > 0 AND NOT private.is_org_member(v_org, v_owner) THEN
    RAISE EXCEPTION 'The person you picked is not in this workspace.' USING ERRCODE = '42501';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
    v_cat := v_item ->> 'category';
    IF v_cat IS NULL OR v_cat NOT IN ('location', 'quantity', 'facing', 'branding', 'other') THEN
      RAISE EXCEPTION 'Pick a corrective action for every issue.' USING ERRCODE = '22023';
    END IF;
    v_detail := NULLIF(btrim(left(v_item ->> 'detail', 500)), '');
    IF v_cat = 'other' AND v_detail IS NULL THEN
      RAISE EXCEPTION 'Describe the issue for every "Other" corrective action.' USING ERRCODE = '22023';
    END IF;
    v_product := NULLIF(btrim(left(v_item ->> 'product', 200)), '');
    v_sku := NULLIF(btrim(left(v_item ->> 'sku', 100)), '');
    v_mins := NULLIF(v_item ->> 'sla_minutes', '')::INT;
    IF v_mins IS NULL OR v_mins < 15 OR v_mins > 43200 THEN
      RAISE EXCEPTION 'Pick a deadline between 15 minutes and 30 days for every issue.' USING ERRCODE = '22023';
    END IF;
    v_subject := COALESCE(v_product, 'the product');

    INSERT INTO public.corrective_actions (
      org_id, scan_id, store_id, source, issue_type, issue_category, issue_detail, action_type, sla_type,
      title, suggestion, description, sku, priority, status, assigned_to, sla_minutes, due_at, start_at,
      created_at, created_by, reviewed_at, reviewed_by, raised_manually
    ) VALUES (
      v_org, p_scan_id, v_store,
      CASE WHEN v_mode = 'digital' THEN 'digital' ELSE 'ai' END,
      'manual_' || v_cat, v_cat, v_detail,
      CASE v_cat WHEN 'quantity' THEN 'inventory' WHEN 'branding' THEN 'display'
                 WHEN 'other' THEN 'process' ELSE 'planogram' END,
      CASE v_cat WHEN 'quantity' THEN 'replenishment' WHEN 'other' THEN 'issue_resolution'
                 ELSE 'corrective_action' END,
      CASE v_cat WHEN 'location' THEN 'Location issue' WHEN 'quantity' THEN 'Quantity issue'
                 WHEN 'facing' THEN 'Product facing issue' WHEN 'branding' THEN 'Branding issue'
                 ELSE 'Other issue' END || COALESCE(' · ' || v_product, ''),
      CASE v_cat
        WHEN 'location' THEN 'Move ' || v_subject || ' to its planned location.'
        WHEN 'quantity' THEN 'Restock ' || v_subject || ' to the planned quantity.'
        WHEN 'facing' THEN 'Correct the facings of ' || v_subject || ' to match the plan.'
        WHEN 'branding' THEN 'Fix the branding and display of ' || v_subject || '.'
        ELSE v_detail
      END,
      v_detail, v_sku,
      CASE WHEN v_mins <= 60 THEN 'critical' WHEN v_mins <= 720 THEN 'high'
           WHEN v_mins <= 1440 THEN 'medium' ELSE 'low' END,
      'assigned', v_owner, v_mins, v_now + make_interval(mins => v_mins), v_now,
      v_now, v_uid, v_now, v_uid, true
    )
    RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END LOOP;

  UPDATE public.shelf_scans SET
    action_review_status = CASE WHEN cardinality(v_ids) > 0 THEN 'actions_assigned' ELSE 'closed_no_issue' END,
    action_reviewed_at = v_now,
    action_reviewed_by = v_uid,
    action_review_note = NULLIF(btrim(left(p_note, 2000)), '')
  WHERE id = p_scan_id;

  RETURN jsonb_build_object('created', cardinality(v_ids), 'ids', to_jsonb(v_ids), 'assignee', v_owner);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_audit_actions(UUID, JSONB, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_audit_actions(UUID, JSONB, UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Backfill issue types for existing actions
-- ---------------------------------------------------------------------------
UPDATE public.corrective_actions
SET issue_category = public.ca_issue_category(issue_type, action_type, title)
WHERE issue_category IS NULL;
