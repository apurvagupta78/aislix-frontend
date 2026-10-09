-- Fixes found by an audit start as "proposed". The auditor or a manager reviews them on the
-- scan results: approve (becomes a corrective action with an owner and SLA deadline), reject
-- (dismissed), or request a re-audit (all proposed fixes dismissed; a re-audit task is assigned).

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------
ALTER TABLE public.corrective_actions DROP CONSTRAINT IF EXISTS corrective_actions_status_check;
ALTER TABLE public.corrective_actions ADD CONSTRAINT corrective_actions_status_check CHECK (
  status IN ('proposed', 'dismissed', 'open', 'assigned', 'in_progress', 'pending_verification',
             'verified', 'resolved', 'rejected', 'overdue', 'closed')
);

ALTER TABLE public.findings DROP CONSTRAINT IF EXISTS findings_status_check;
ALTER TABLE public.findings ADD CONSTRAINT findings_status_check CHECK (
  status IN ('open', 'assigned', 'in_progress', 'pending_verification', 'resolved', 'rejected', 'closed', 'dismissed')
);

ALTER TABLE public.corrective_actions
  ADD COLUMN IF NOT EXISTS proposed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS review_note TEXT;

CREATE INDEX IF NOT EXISTS corrective_actions_proposed_scan_idx
  ON public.corrective_actions (scan_id) WHERE status = 'proposed';

-- ---------------------------------------------------------------------------
-- 2. Defaults: a proposed fix has an SLA type and target, but no owner or deadline yet
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ca_fill_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_f_type TEXT;
  v_f_title TEXT;
  v_f_origin TEXT;
  v_f_assignment UUID;
  v_f_due TIMESTAMPTZ;
  v_f_owner UUID;
  v_f_scan UUID;
  v_f_store UUID;
  v_f_sku TEXT;
  v_cmp_scan UUID;
  v_cmp_store UUID;
  v_cmp_assignment UUID;
  v_scan_store UUID;
  v_scan_mode TEXT;
  v_scan_assignment UUID;
  v_type TEXT;
  v_cat JSONB;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.finding_id IS NOT NULL THEN
    SELECT f.finding_type, f.title, f.audit_origin, f.assignment_id, f.due_at, f.assigned_to, f.scan_id, f.store_id, f.sku
    INTO v_f_type, v_f_title, v_f_origin, v_f_assignment, v_f_due, v_f_owner, v_f_scan, v_f_store, v_f_sku
    FROM public.findings f WHERE f.id = NEW.finding_id;
  END IF;

  IF NEW.comparison_id IS NOT NULL THEN
    SELECT c.scan_id, c.store_id, c.assignment_id
    INTO v_cmp_scan, v_cmp_store, v_cmp_assignment
    FROM public.planogram_comparisons c WHERE c.id = NEW.comparison_id;
  END IF;

  NEW.scan_id := COALESCE(NEW.scan_id, v_f_scan, v_cmp_scan);

  IF NEW.scan_id IS NOT NULL THEN
    SELECT s.store_id, s.audit_mode, s.assignment_id
    INTO v_scan_store, v_scan_mode, v_scan_assignment
    FROM public.shelf_scans s WHERE s.id = NEW.scan_id;
  END IF;

  NEW.store_id := COALESCE(NEW.store_id, v_f_store, v_cmp_store, v_scan_store);
  NEW.sku := COALESCE(NEW.sku, v_f_sku);
  NEW.source := COALESCE(
    NEW.source,
    CASE WHEN v_f_origin = 'digital' THEN 'digital' WHEN v_f_origin IS NOT NULL THEN 'ai' END,
    CASE WHEN v_scan_mode = 'digital' THEN 'digital' WHEN v_scan_mode IS NOT NULL THEN 'ai' END,
    'ai'
  );

  v_type := COALESCE(v_f_type, public.ca_legacy_finding_type(NEW.issue_type));
  NEW.action_type := COALESCE(
    NEW.action_type,
    public.ca_action_type(v_type, concat_ws(' ', NEW.title, NEW.suggestion, v_f_title))
  );
  NEW.sla_type := COALESCE(
    NEW.sla_type,
    public.ca_sla_type(v_type, NEW.issue_type, NEW.action_type, concat_ws(' ', NEW.title, v_f_title))
  );
  v_cat := public.ca_catalog(NEW.action_type, v_type, NEW.source);

  IF NEW.evidence_required IS NULL OR NEW.evidence_required = '[]'::jsonb THEN
    NEW.evidence_required := v_cat -> 'evidence';
  END IF;
  NEW.verification_method := COALESCE(NEW.verification_method, v_cat ->> 'verification');
  NEW.priority := COALESCE(NEW.priority, 'medium');
  NEW.sla_minutes := COALESCE(NEW.sla_minutes, public.sla_target_minutes(NEW.org_id, NEW.store_id, NEW.sla_type));
  NEW.sla_hours := GREATEST(1, ceil(NEW.sla_minutes / 60.0)::int);
  NEW.code := COALESCE(NEW.code, 'CA-' || nextval('public.corrective_action_code_seq'));

  IF NEW.status IN ('proposed', 'dismissed') THEN
    NEW.proposed_at := COALESCE(NEW.proposed_at, NEW.created_at, now());
    NEW.due_at := NULL;
    NEW.assigned_to := NULL;
    RETURN NEW;
  END IF;

  -- A due time copied from the finding is replaced by the SLA target; an explicit one is kept.
  IF NEW.due_at IS NULL OR NEW.due_at IS NOT DISTINCT FROM v_f_due THEN
    NEW.due_at := COALESCE(NEW.created_at, now()) + make_interval(mins => NEW.sla_minutes);
  END IF;
  NEW.start_at := COALESCE(NEW.start_at, NEW.created_at, now());
  NEW.assigned_to := COALESCE(
    NEW.assigned_to, v_f_owner,
    public.resolve_action_owner(
      NEW.org_id, NEW.store_id,
      COALESCE(v_f_assignment, v_cmp_assignment, v_scan_assignment),
      NEW.scan_id
    )
  );
  IF NEW.status = 'open' AND NEW.assigned_to IS NOT NULL THEN
    NEW.status := 'assigned';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ca_notify_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('aislix.ca_backfill', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.status IN ('proposed', 'dismissed') THEN RETURN NEW; END IF;
  IF NEW.assigned_to IS NULL OR NEW.assigned_to IS NOT DISTINCT FROM auth.uid() THEN RETURN NEW; END IF;
  IF NEW.scan_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = NEW.assigned_to
      AND n.type = 'action_assigned'
      AND n.payload ->> 'scan_id' = NEW.scan_id::text
      AND n.created_at > now() - interval '30 minutes'
  ) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, org_id, type, title, body, payload)
  VALUES (
    NEW.assigned_to, NEW.org_id, 'action_assigned',
    'Corrective action assigned',
    coalesce(NEW.code || ' · ', '') || coalesce(NEW.title, NEW.suggestion),
    jsonb_build_object('action_id', NEW.id, 'finding_id', NEW.finding_id, 'scan_id', NEW.scan_id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'corrective action notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Audit findings create proposed fixes (not live actions)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_action_for_finding(p_finding_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  f public.findings%ROWTYPE;
  v_id UUID;
  v_owner UUID;
  v_reason TEXT;
  v_type TEXT;
  v_source TEXT;
  v_cat JSONB;
BEGIN
  SELECT * INTO f FROM public.findings WHERE id = p_finding_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT id INTO v_id FROM public.corrective_actions WHERE finding_id = f.id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF f.status IN ('resolved', 'closed', 'dismissed') THEN RETURN NULL; END IF;

  IF f.scan_id IS NOT NULL THEN
    SELECT reaudit_reason INTO v_reason FROM public.shelf_scans WHERE id = f.scan_id;
    IF coalesce(v_reason, '') LIKE 'corrective_action:%' THEN RETURN NULL; END IF;
  END IF;

  IF f.comparison_line_id IS NOT NULL THEN
    UPDATE public.corrective_actions
    SET finding_id = f.id,
        priority = f.severity,
        title = COALESCE(title, f.title),
        store_id = COALESCE(store_id, f.store_id),
        scan_id = COALESCE(scan_id, f.scan_id),
        updated_at = now()
    WHERE id = (
      SELECT id FROM public.corrective_actions
      WHERE comparison_line_id = f.comparison_line_id AND finding_id IS NULL
      ORDER BY created_at LIMIT 1
    )
    RETURNING id, assigned_to INTO v_id, v_owner;
  END IF;

  IF v_id IS NULL AND f.comparison_line_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.planogram_comparison_lines l
    WHERE l.id = f.comparison_line_id AND l.issue_type = 'unexpected'
  ) THEN
    RETURN NULL;
  END IF;

  IF v_id IS NULL THEN
    v_source := CASE WHEN f.audit_origin = 'digital' THEN 'digital' ELSE 'ai' END;
    v_type := public.ca_action_type(f.finding_type, concat_ws(' ', f.title, f.description));
    v_cat := public.ca_catalog(v_type, f.finding_type, v_source);
    INSERT INTO public.corrective_actions (
      org_id, finding_id, scan_id, store_id, issue_type, suggestion, title, description,
      priority, status, sku, created_by, source, action_type
    )
    VALUES (
      f.org_id, f.id, f.scan_id, f.store_id, f.finding_type, v_cat ->> 'action',
      f.title || coalesce(' — ' || coalesce(nullif(f.product_name, ''), nullif(f.sku, '')), ''),
      f.description, f.severity, 'proposed', f.sku, f.created_by, v_source, v_type
    )
    RETURNING id, assigned_to INTO v_id, v_owner;
  END IF;

  IF v_owner IS NOT NULL THEN
    UPDATE public.findings
    SET status = CASE WHEN status = 'open' THEN 'assigned' ELSE status END,
        assigned_to = COALESCE(assigned_to, v_owner),
        due_at = COALESCE((SELECT due_at FROM public.corrective_actions WHERE id = v_id), due_at),
        updated_at = now()
    WHERE id = f.id;
  END IF;
  RETURN v_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Human verification that disproves a finding dismisses its proposed fix (and restores it)
-- ---------------------------------------------------------------------------
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
    IF r.reason IS NOT NULL AND r.status = 'proposed' THEN
      UPDATE public.corrective_actions SET
        pre_verification = jsonb_build_object('status', 'proposed', 'finding_status', r.finding_status),
        resolved_by_verification = true,
        status = 'dismissed',
        review_note = r.reason,
        reviewed_at = now(),
        updated_at = now()
      WHERE id = r.action_id;
      UPDATE public.findings SET status = 'dismissed', rca_code = 'counting_error',
        rca_notes = r.reason, updated_at = now()
      WHERE id = r.finding_id;
      INSERT INTO public.audit_activity_events (org_id, scan_id, finding_id, action_id, actor_id, event_type, summary)
      SELECT ca.org_id, p_scan_id, r.finding_id, r.action_id, auth.uid(), 'resolved_by_verification', r.reason
      FROM public.corrective_actions ca WHERE ca.id = r.action_id;
      v_n := v_n + 1;
    ELSIF r.reason IS NOT NULL
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
    ELSIF r.reason IS NULL AND r.resolved_by_verification AND r.status = 'dismissed'
       AND r.pre_verification ->> 'status' = 'proposed' THEN
      UPDATE public.corrective_actions SET
        status = 'proposed',
        resolved_by_verification = false,
        pre_verification = NULL,
        review_note = NULL,
        reviewed_at = NULL,
        updated_at = now()
      WHERE id = r.action_id;
      UPDATE public.findings SET status = coalesce(r.pre_verification ->> 'finding_status', 'open'),
        rca_code = NULL, rca_notes = NULL, updated_at = now()
      WHERE id = r.finding_id;
      INSERT INTO public.audit_activity_events (org_id, scan_id, finding_id, action_id, actor_id, event_type, summary)
      SELECT ca.org_id, p_scan_id, r.finding_id, r.action_id, auth.uid(), 'verification_reverted',
        'Human verification changed; the proposed fix is back for review.'
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

-- ---------------------------------------------------------------------------
-- 5. Review: approve / reject proposed fixes, or dismiss them all for a re-audit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_review_scan_actions(p_scan_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shelf_scans s
    LEFT JOIN public.scan_assignments a ON a.id = s.assignment_id
    WHERE s.id = p_scan_id
      AND public.is_org_member(s.org_id)
      AND (
        s.created_by = auth.uid()
        OR a.assignee_id = auth.uid()
        OR a.assigner_id = auth.uid()
        OR a.reviewer_id = auth.uid()
        OR public.is_org_manager(s.org_id)
      )
  )
$$;
GRANT EXECUTE ON FUNCTION public.can_review_scan_actions(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_scan_actions(
  p_scan_id UUID,
  p_approve UUID[] DEFAULT '{}',
  p_reject UUID[] DEFAULT '{}',
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s RECORD;
  ca RECORD;
  v_owner UUID;
  v_now TIMESTAMPTZ := now();
  v_approved INT := 0;
  v_rejected INT := 0;
  v_note TEXT := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  IF NOT public.can_review_scan_actions(p_scan_id) THEN
    RAISE EXCEPTION 'Only the auditor or a manager can review the fixes for this audit.' USING ERRCODE = '42501';
  END IF;
  SELECT id, org_id, store_id, assignment_id INTO s FROM public.shelf_scans WHERE id = p_scan_id;

  FOR ca IN
    SELECT * FROM public.corrective_actions
    WHERE scan_id = p_scan_id AND status = 'proposed' AND id = ANY (coalesce(p_approve, '{}'))
    FOR UPDATE
  LOOP
    v_owner := COALESCE(
      (SELECT f.assigned_to FROM public.findings f WHERE f.id = ca.finding_id),
      public.resolve_action_owner(ca.org_id, COALESCE(ca.store_id, s.store_id), s.assignment_id, p_scan_id)
    );
    UPDATE public.corrective_actions SET
      status = CASE WHEN v_owner IS NOT NULL THEN 'assigned' ELSE 'open' END,
      assigned_to = v_owner,
      proposed_at = COALESCE(proposed_at, created_at),
      created_at = v_now,
      start_at = v_now,
      due_at = v_now + make_interval(mins => COALESCE(sla_minutes, COALESCE(sla_hours, 48) * 60)),
      reviewed_at = v_now,
      reviewed_by = auth.uid(),
      review_note = v_note,
      escalation_level = 0,
      escalated_at = NULL,
      due_soon_notified_at = NULL,
      breach_notified_at = NULL,
      updated_at = v_now
    WHERE id = ca.id;
    UPDATE public.findings SET
      status = CASE WHEN status IN ('open', 'dismissed') THEN CASE WHEN v_owner IS NOT NULL THEN 'assigned' ELSE 'open' END ELSE status END,
      assigned_to = COALESCE(assigned_to, v_owner),
      due_at = (SELECT due_at FROM public.corrective_actions WHERE id = ca.id),
      updated_at = v_now
    WHERE id = ca.finding_id;
    INSERT INTO public.audit_activity_events (org_id, scan_id, finding_id, action_id, actor_id, event_type, summary)
    VALUES (ca.org_id, p_scan_id, ca.finding_id, ca.id, auth.uid(), 'action_approved',
      'Fix approved: ' || coalesce(ca.title, ca.suggestion, 'corrective action'));
    v_approved := v_approved + 1;
  END LOOP;

  INSERT INTO public.notifications (user_id, org_id, type, title, body, payload)
  SELECT c.assigned_to, c.org_id, 'action_assigned', 'Corrective action assigned',
    CASE WHEN count(*) = 1
      THEN min(coalesce(c.code || ' · ', '') || coalesce(c.title, c.suggestion))
      ELSE count(*) || ' corrective actions from an audit were assigned to you.'
    END,
    jsonb_build_object('action_id', (array_agg(c.id))[1], 'action_ids', to_jsonb(array_agg(c.id)), 'scan_id', p_scan_id)
  FROM public.corrective_actions c
  WHERE c.scan_id = p_scan_id
    AND c.id = ANY (coalesce(p_approve, '{}'))
    AND c.reviewed_at = v_now
    AND c.assigned_to IS NOT NULL
    AND c.assigned_to IS DISTINCT FROM auth.uid()
  GROUP BY c.assigned_to, c.org_id;

  FOR ca IN
    SELECT * FROM public.corrective_actions
    WHERE scan_id = p_scan_id AND status = 'proposed' AND id = ANY (coalesce(p_reject, '{}'))
    FOR UPDATE
  LOOP
    UPDATE public.corrective_actions SET
      status = 'dismissed',
      reviewed_at = v_now,
      reviewed_by = auth.uid(),
      review_note = v_note,
      updated_at = v_now
    WHERE id = ca.id;
    UPDATE public.findings SET status = 'dismissed', updated_at = v_now
    WHERE id = ca.finding_id AND status IN ('open', 'assigned');
    INSERT INTO public.audit_activity_events (org_id, scan_id, finding_id, action_id, actor_id, event_type, summary)
    VALUES (ca.org_id, p_scan_id, ca.finding_id, ca.id, auth.uid(), 'action_dismissed',
      'Fix rejected: ' || coalesce(ca.title, ca.suggestion, 'corrective action') || coalesce(' — ' || v_note, ''));
    v_rejected := v_rejected + 1;
  END LOOP;

  RETURN jsonb_build_object('approved', v_approved, 'rejected', v_rejected);
END;
$$;
REVOKE ALL ON FUNCTION public.review_scan_actions(UUID, UUID[], UUID[], TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_scan_actions(UUID, UUID[], UUID[], TEXT) TO authenticated;

-- Dismiss every proposed fix of an audit because a re-audit was requested.
CREATE OR REPLACE FUNCTION public.dismiss_scan_actions_for_reaudit(p_scan_id UUID, p_note TEXT DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ids UUID[];
BEGIN
  IF NOT public.can_review_scan_actions(p_scan_id) THEN
    RAISE EXCEPTION 'Only the auditor or a manager can request a re-audit.' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(array_agg(id), '{}') INTO v_ids
  FROM public.corrective_actions WHERE scan_id = p_scan_id AND status = 'proposed';
  PERFORM public.review_scan_actions(
    p_scan_id, '{}', v_ids,
    'Re-audit requested' || coalesce(': ' || nullif(btrim(coalesce(p_note, '')), ''), '')
  );
  RETURN coalesce(array_length(v_ids, 1), 0);
END;
$$;
REVOKE ALL ON FUNCTION public.dismiss_scan_actions_for_reaudit(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_scan_actions_for_reaudit(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Existing actions nobody has started go back to review (demo orgs keep their sample data)
-- ---------------------------------------------------------------------------
SELECT set_config('aislix.ca_backfill', 'on', true);

WITH moved AS (
  UPDATE public.corrective_actions ca SET
    status = 'proposed',
    proposed_at = COALESCE(ca.proposed_at, ca.created_at),
    due_at = NULL,
    assigned_to = NULL,
    escalation_level = 0,
    escalated_at = NULL,
    due_soon_notified_at = NULL,
    breach_notified_at = NULL,
    updated_at = now()
  WHERE ca.status IN ('open', 'assigned', 'overdue')
    AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = ca.org_id AND o.is_demo)
  RETURNING ca.finding_id
)
UPDATE public.findings f SET
  status = 'open',
  due_at = NULL,
  updated_at = now()
FROM moved
WHERE f.id = moved.finding_id AND f.status IN ('open', 'assigned');

SELECT set_config('aislix.ca_backfill', 'off', false);
