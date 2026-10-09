-- Corrective action issue types: Quantity issue is split into Less / More quantity, and the
-- shelf-condition and fix types are added. Mirrored in src/lib/corrective-action-catalog.ts.

ALTER TABLE public.corrective_actions DROP CONSTRAINT IF EXISTS corrective_actions_issue_category_check;

-- ---------------------------------------------------------------------------
-- 1. Classification for actions raised by the AI or older flows
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.ca_issue_category(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.ca_issue_category(
  p_issue_type TEXT,
  p_action_type TEXT,
  p_title TEXT,
  p_suggestion TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN t ~ 'facing' THEN 'facing'
    WHEN t ~ '(rotten|spoil|mould|mold)' THEN 'rotten'
    WHEN t ~ 'expir' THEN 'expired'
    WHEN t ~ 'damage' THEN 'damaged'
    WHEN t ~ '(hygien|dirty|unclean|spill)' THEN 'hygiene'
    WHEN t ~ 'quality' THEN 'quality'
    WHEN t ~ '(placement|location|wrong_category|unexpected|misplac|wrong_aisle)' THEN 'location'
    WHEN t ~ 'planogram' THEN 'planogram'
    WHEN t ~ '(excess|overstock|surplus)' THEN 'more_quantity'
    WHEN t ~ '(qty|quantity|shortage|missing|out_of_stock|oos|low_stock|empty|gap|refill|replenish)' THEN
      CASE WHEN h ~ '(extra|excess|overstock|too many)' THEN 'more_quantity' ELSE 'less_quantity' END
    WHEN t ~ '(brand|display|wrong_product|variant|promo)' THEN 'branding'
    WHEN t ~ 'pric' THEN 'other'
    WHEN h ~ 'facing' THEN 'facing'
    WHEN h ~ '(location|placement|aisle|misplaced)' THEN 'location'
    WHEN h ~ 'expir' THEN 'expired'
    WHEN h ~ 'damage' THEN 'damaged'
    WHEN a = 'hygiene' THEN 'hygiene'
    WHEN a IN ('availability', 'inventory') THEN 'less_quantity'
    WHEN a = 'display' THEN 'branding'
    WHEN a = 'planogram' THEN 'planogram'
    ELSE 'other'
  END
  FROM (
    SELECT lower(coalesce(p_issue_type, '')) AS t,
           lower(coalesce(p_title, '') || ' ' || coalesce(p_suggestion, '')) AS h,
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
    public.ca_issue_category(NEW.issue_type, NEW.action_type, NEW.title, NEW.suggestion)
  );
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Re-classify existing actions (manual picks are kept, except the retired Quantity issue)
-- ---------------------------------------------------------------------------
UPDATE public.corrective_actions
SET issue_category = public.ca_issue_category(issue_type, action_type, title, suggestion)
WHERE raised_manually = false OR issue_category IS NULL OR issue_category = 'quantity';

ALTER TABLE public.corrective_actions ADD CONSTRAINT corrective_actions_issue_category_check CHECK (
  issue_category IS NULL OR issue_category IN (
    'location', 'facing', 'branding', 'planogram', 'hygiene', 'quality', 'damaged', 'expired',
    'rotten', 'less_quantity', 'more_quantity', 'remove_item', 'refill_item', 'other'
  )
);

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
    IF v_cat IS NULL OR v_cat NOT IN (
      'location', 'facing', 'branding', 'planogram', 'hygiene', 'quality', 'damaged', 'expired',
      'rotten', 'less_quantity', 'more_quantity', 'remove_item', 'refill_item', 'other'
    ) THEN
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
      CASE
        WHEN v_cat IN ('location', 'facing', 'planogram') THEN 'planogram'
        WHEN v_cat = 'branding' THEN 'display'
        WHEN v_cat = 'hygiene' THEN 'hygiene'
        WHEN v_cat IN ('quality', 'damaged', 'expired', 'rotten') THEN 'compliance'
        WHEN v_cat IN ('less_quantity', 'more_quantity', 'remove_item', 'refill_item') THEN 'inventory'
        ELSE 'process'
      END,
      CASE
        WHEN v_cat IN ('less_quantity', 'refill_item') THEN 'replenishment'
        WHEN v_cat IN ('damaged', 'expired', 'rotten') THEN 'expiry_damage'
        WHEN v_cat IN ('hygiene', 'quality', 'other') THEN 'issue_resolution'
        ELSE 'corrective_action'
      END,
      CASE v_cat
        WHEN 'location' THEN 'Location issue'
        WHEN 'facing' THEN 'Product facing issue'
        WHEN 'branding' THEN 'Branding issue'
        WHEN 'planogram' THEN 'Planogram compliance'
        WHEN 'hygiene' THEN 'Hygiene'
        WHEN 'quality' THEN 'Quality'
        WHEN 'damaged' THEN 'Damaged'
        WHEN 'expired' THEN 'Expired'
        WHEN 'rotten' THEN 'Rotten'
        WHEN 'less_quantity' THEN 'Less quantity'
        WHEN 'more_quantity' THEN 'More quantity'
        WHEN 'remove_item' THEN 'Remove the item'
        WHEN 'refill_item' THEN 'Refill the item'
        ELSE 'Other issue'
      END || COALESCE(' · ' || v_product, ''),
      CASE v_cat
        WHEN 'location' THEN 'Move ' || v_subject || ' to its planned location.'
        WHEN 'facing' THEN 'Correct the facings of ' || v_subject || ' to match the plan.'
        WHEN 'branding' THEN 'Fix the branding and display of ' || v_subject || '.'
        WHEN 'planogram' THEN 'Set up ' || v_subject || ' exactly as the planogram shows.'
        WHEN 'hygiene' THEN 'Clean the shelf area around ' || v_subject || '.'
        WHEN 'quality' THEN 'Check the quality of ' || v_subject || ' and replace any poor units.'
        WHEN 'damaged' THEN 'Remove damaged units of ' || v_subject || ' and replace them.'
        WHEN 'expired' THEN 'Remove expired units of ' || v_subject || ' from the shelf.'
        WHEN 'rotten' THEN 'Remove rotten units of ' || v_subject || ' and clean the shelf.'
        WHEN 'less_quantity' THEN 'Restock ' || v_subject || ' to the planned quantity.'
        WHEN 'more_quantity' THEN 'Reduce ' || v_subject || ' to the planned quantity and return the extra stock.'
        WHEN 'remove_item' THEN 'Remove ' || v_subject || ' from the shelf.'
        WHEN 'refill_item' THEN 'Refill ' || v_subject || ' on the shelf.'
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
