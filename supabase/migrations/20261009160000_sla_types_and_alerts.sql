-- SLA types with minute targets (org default + per-store override), delay reasons,
-- and due-soon / missed alerts for every corrective action (AI and Digital audits).

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------
ALTER TABLE public.corrective_actions
  ADD COLUMN IF NOT EXISTS sla_type TEXT,
  ADD COLUMN IF NOT EXISTS sla_minutes INT,
  ADD COLUMN IF NOT EXISTS delay_reason TEXT,
  ADD COLUMN IF NOT EXISTS due_soon_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS breach_notified_at TIMESTAMPTZ;

ALTER TABLE public.corrective_actions DROP CONSTRAINT IF EXISTS corrective_actions_sla_type_check;
ALTER TABLE public.corrective_actions ADD CONSTRAINT corrective_actions_sla_type_check CHECK (
  sla_type IS NULL OR sla_type IN ('replenishment', 'expiry_damage', 'issue_resolution', 'corrective_action')
);

CREATE INDEX IF NOT EXISTS corrective_actions_open_due_idx
  ON public.corrective_actions (due_at)
  WHERE status IN ('open', 'assigned', 'in_progress', 'overdue', 'rejected');

CREATE TABLE IF NOT EXISTS public.org_sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  scope_key TEXT GENERATED ALWAYS AS (COALESCE(store_id::text, 'org')) STORED,
  sla_type TEXT NOT NULL CHECK (sla_type IN ('replenishment', 'expiry_damage', 'issue_resolution', 'corrective_action')),
  target_minutes INT NOT NULL CHECK (target_minutes BETWEEN 1 AND 43200),
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_sla_policies_scope_unique UNIQUE (org_id, scope_key, sla_type)
);

ALTER TABLE public.org_sla_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_sla_policies_select ON public.org_sla_policies;
CREATE POLICY org_sla_policies_select ON public.org_sla_policies
  FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_sla_policies_manage ON public.org_sla_policies;
CREATE POLICY org_sla_policies_manage ON public.org_sla_policies
  FOR ALL USING (public.is_org_manager(org_id)) WITH CHECK (public.is_org_manager(org_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_sla_policies TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Classification and targets
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ca_sla_type(
  p_finding_type TEXT, p_issue_type TEXT, p_action_type TEXT, p_text TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_finding_type, '') IN ('damaged_product', 'expired_product', 'near_expiry')
      OR lower(coalesce(p_issue_type, '')) ~ '(expir|damage)'
      OR lower(coalesce(p_text, '')) ~ '(expired|expiry|damaged)' THEN 'expiry_damage'
    WHEN coalesce(p_finding_type, '') IN ('out_of_stock', 'missing_product')
      OR lower(coalesce(p_issue_type, '')) ~ '(^missing|out_of_stock|^oos|empty|low_stock)'
      OR p_action_type = 'availability' THEN 'replenishment'
    WHEN p_action_type IN ('safety', 'hygiene', 'process', 'documentation', 'training', 'compliance') THEN 'issue_resolution'
    ELSE 'corrective_action'
  END
$$;

CREATE OR REPLACE FUNCTION public.sla_target_minutes(p_org_id UUID, p_store_id UUID, p_sla_type TEXT)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT target_minutes FROM public.org_sla_policies
      WHERE org_id = p_org_id AND store_id = p_store_id AND sla_type = p_sla_type),
    (SELECT target_minutes FROM public.org_sla_policies
      WHERE org_id = p_org_id AND store_id IS NULL AND sla_type = p_sla_type),
    CASE p_sla_type
      WHEN 'replenishment' THEN 15
      WHEN 'expiry_damage' THEN 60
      WHEN 'issue_resolution' THEN 1440
      ELSE 2880
    END
  )
$$;
GRANT EXECUTE ON FUNCTION public.sla_target_minutes(UUID, UUID, TEXT) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Defaults trigger: SLA type + target decide the due time
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
  NEW.code := COALESCE(NEW.code, 'CA-' || nextval('public.corrective_action_code_seq'));
  RETURN NEW;
END;
$$;

-- Each submission restarts the measured time; a rejected fix keeps the SLA clock running.
CREATE OR REPLACE FUNCTION public.ca_guard_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'pending_verification' AND OLD.status IS DISTINCT FROM 'pending_verification' THEN
    IF NEW.priority IN ('critical', 'high')
       AND (coalesce(btrim(NEW.root_cause), '') = '' OR coalesce(btrim(NEW.preventive_action), '') = '') THEN
      RAISE EXCEPTION 'Add the root cause and preventive action before submitting a % priority action.', NEW.priority
        USING ERRCODE = 'P0001';
    END IF;
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END;
$$;

-- Findings show the same due time as their action.
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
  IF f.status IN ('resolved', 'closed') THEN RETURN NULL; END IF;

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
      priority, status, due_at, sku, created_by, source, action_type
    )
    VALUES (
      f.org_id, f.id, f.scan_id, f.store_id, f.finding_type, v_cat ->> 'action',
      f.title || coalesce(' — ' || coalesce(nullif(f.product_name, ''), nullif(f.sku, '')), ''),
      f.description, f.severity, 'open', f.due_at, f.sku, f.created_by, v_source, v_type
    )
    RETURNING id, assigned_to INTO v_id, v_owner;
  END IF;

  UPDATE public.findings
  SET status = CASE WHEN status = 'open' AND v_owner IS NOT NULL THEN 'assigned' ELSE status END,
      assigned_to = COALESCE(assigned_to, v_owner),
      due_at = COALESCE((SELECT due_at FROM public.corrective_actions WHERE id = v_id), due_at),
      updated_at = now()
  WHERE id = f.id;
  RETURN v_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Backfill existing actions (keeps their original due time)
-- ---------------------------------------------------------------------------
SELECT set_config('aislix.ca_backfill', 'on', true);
UPDATE public.corrective_actions ca
SET sla_type = public.ca_sla_type(
      (SELECT f.finding_type FROM public.findings f WHERE f.id = ca.finding_id),
      ca.issue_type, ca.action_type, ca.title
    ),
    sla_minutes = COALESCE(
      ca.sla_minutes,
      CASE WHEN ca.due_at IS NOT NULL AND ca.due_at > ca.created_at
        THEN GREATEST(1, round(extract(epoch FROM (ca.due_at - ca.created_at)) / 60)::int) END,
      COALESCE(ca.sla_hours, 24) * 60
    )
WHERE ca.sla_type IS NULL OR ca.sla_minutes IS NULL;

-- Actions already late or near their deadline before alerts existed are not announced again.
UPDATE public.corrective_actions
SET breach_notified_at = now()
WHERE due_at < now() AND breach_notified_at IS NULL;
UPDATE public.corrective_actions
SET due_soon_notified_at = now()
WHERE due_at < now() + interval '1 day' AND due_soon_notified_at IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Alerts: due soon (80% of the target used) and missed, then escalation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sla_left_text(p_due TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN extract(epoch FROM (p_due - now())) < 7200
      THEN GREATEST(1, ceil(extract(epoch FROM (p_due - now())) / 60))::int || ' min'
    ELSE round(extract(epoch FROM (p_due - now())) / 3600)::int || ' h'
  END
$$;

CREATE OR REPLACE FUNCTION public.process_sla_alerts(p_org_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_soon INT := 0;
  v_missed INT := 0;
  v_esc JSONB;
BEGIN
  IF auth.uid() IS NOT NULL AND (p_org_id IS NULL OR NOT public.is_org_member(p_org_id)) THEN
    RETURN jsonb_build_object('due_soon', 0, 'missed', 0);
  END IF;

  WITH cand AS (
    SELECT ca.id
    FROM public.corrective_actions ca
    WHERE (p_org_id IS NULL OR ca.org_id = p_org_id)
      AND ca.status IN ('open', 'assigned', 'in_progress', 'rejected')
      AND ca.assigned_to IS NOT NULL
      AND ca.due_at IS NOT NULL
      AND ca.due_soon_notified_at IS NULL
      AND ca.due_at > now()
      AND now() >= ca.due_at - make_interval(secs => GREATEST(60, 0.2 * extract(epoch FROM (ca.due_at - ca.created_at))))
    LIMIT 2000
  ),
  upd AS (
    UPDATE public.corrective_actions c
    SET due_soon_notified_at = now()
    FROM cand
    WHERE c.id = cand.id
    RETURNING c.id, c.org_id, c.assigned_to, c.code, c.title, c.due_at
  ),
  grouped AS (
    SELECT assigned_to, org_id, count(*) AS n, jsonb_agg(id) AS ids,
      min(coalesce(code || ' · ', '') || coalesce(title, 'Corrective action')) AS first_title,
      min(due_at) AS first_due
    FROM upd GROUP BY assigned_to, org_id
  ),
  sent AS (
    INSERT INTO public.notifications (user_id, org_id, type, title, body, payload)
    SELECT assigned_to, org_id, 'action_due_soon', 'Corrective action due soon',
      CASE WHEN n = 1
        THEN format('%s is due in %s.', first_title, public.sla_left_text(first_due))
        ELSE format('%s corrective actions are due soon. The first is due in %s.', n, public.sla_left_text(first_due))
      END,
      jsonb_build_object('action_ids', ids, 'action_id', ids -> 0)
    FROM grouped
    RETURNING 1
  )
  SELECT count(*) INTO v_soon FROM upd;

  WITH cand AS (
    SELECT ca.id
    FROM public.corrective_actions ca
    WHERE (p_org_id IS NULL OR ca.org_id = p_org_id)
      AND ca.status IN ('open', 'assigned', 'in_progress', 'overdue', 'rejected')
      AND ca.due_at IS NOT NULL
      AND ca.due_at < now()
      AND ca.breach_notified_at IS NULL
      AND ca.created_at > now() - interval '30 days'
    LIMIT 2000
  ),
  upd AS (
    UPDATE public.corrective_actions c
    SET breach_notified_at = now()
    FROM cand
    WHERE c.id = cand.id
    RETURNING c.id, c.org_id, c.assigned_to, c.code, c.title
  ),
  recipients AS (
    SELECT u.assigned_to AS user_id, u.org_id, u.id, u.code, u.title FROM upd u WHERE u.assigned_to IS NOT NULL
    UNION
    SELECT om.reports_to_user_id, u.org_id, u.id, u.code, u.title
    FROM upd u
    JOIN public.organization_members om ON om.org_id = u.org_id AND om.user_id = u.assigned_to
    JOIN public.organization_members mgr
      ON mgr.org_id = u.org_id AND mgr.user_id = om.reports_to_user_id AND mgr.status = 'active'
  ),
  grouped AS (
    SELECT user_id, org_id, count(*) AS n, jsonb_agg(id) AS ids,
      min(coalesce(code || ' · ', '') || coalesce(title, 'Corrective action')) AS first_title
    FROM recipients GROUP BY user_id, org_id
  ),
  sent AS (
    INSERT INTO public.notifications (user_id, org_id, type, title, body, payload)
    SELECT user_id, org_id, 'action_sla_missed', 'SLA missed',
      CASE WHEN n = 1
        THEN format('%s missed its SLA deadline.', first_title)
        ELSE format('%s corrective actions missed their SLA deadline.', n)
      END,
      jsonb_build_object('action_ids', ids, 'action_id', ids -> 0)
    FROM grouped
    RETURNING 1
  )
  SELECT count(*) INTO v_missed FROM upd;

  v_esc := public.process_corrective_action_escalations(p_org_id);
  RETURN jsonb_build_object('due_soon', v_soon, 'missed', v_missed) || coalesce(v_esc, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.process_sla_alerts(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_sla_alerts(UUID) TO authenticated, service_role;
