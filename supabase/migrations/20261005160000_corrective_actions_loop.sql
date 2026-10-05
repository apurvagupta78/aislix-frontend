-- Corrective Actions loop for AI and Digital audits:
-- Detect -> Assign -> Fix -> Evidence -> Verify (AI re-check or manager) -> Close, with escalation.

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.corrective_action_code_seq START 1001;

ALTER TABLE public.corrective_actions
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS action_type TEXT,
  ADD COLUMN IF NOT EXISTS root_cause TEXT,
  ADD COLUMN IF NOT EXISTS preventive_action TEXT,
  ADD COLUMN IF NOT EXISTS evidence_required JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS verification_method TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT,
  ADD COLUMN IF NOT EXISTS before_score NUMERIC,
  ADD COLUMN IF NOT EXISTS after_score NUMERIC,
  ADD COLUMN IF NOT EXISTS verification_scan_id UUID REFERENCES public.shelf_scans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escalation_level INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

ALTER TABLE public.corrective_actions DROP CONSTRAINT IF EXISTS corrective_actions_status_check;
ALTER TABLE public.corrective_actions ADD CONSTRAINT corrective_actions_status_check CHECK (
  status IN ('open', 'assigned', 'in_progress', 'pending_verification', 'verified', 'resolved', 'rejected', 'overdue', 'closed')
);
ALTER TABLE public.corrective_actions DROP CONSTRAINT IF EXISTS corrective_actions_source_check;
ALTER TABLE public.corrective_actions ADD CONSTRAINT corrective_actions_source_check CHECK (
  source IS NULL OR source IN ('ai', 'digital')
);
ALTER TABLE public.corrective_actions DROP CONSTRAINT IF EXISTS corrective_actions_action_type_check;
ALTER TABLE public.corrective_actions ADD CONSTRAINT corrective_actions_action_type_check CHECK (
  action_type IS NULL OR action_type IN (
    'availability', 'planogram', 'pricing', 'display', 'inventory', 'process',
    'compliance', 'documentation', 'training', 'safety', 'hygiene'
  )
);
ALTER TABLE public.corrective_actions DROP CONSTRAINT IF EXISTS corrective_actions_verification_method_check;
ALTER TABLE public.corrective_actions ADD CONSTRAINT corrective_actions_verification_method_check CHECK (
  verification_method IS NULL OR verification_method IN ('ai_rescan', 'manager_review', 'document')
);
ALTER TABLE public.corrective_actions DROP CONSTRAINT IF EXISTS corrective_actions_verification_status_check;
ALTER TABLE public.corrective_actions ADD CONSTRAINT corrective_actions_verification_status_check CHECK (
  verification_status IS NULL OR verification_status IN ('pending', 'passed', 'failed')
);

ALTER TABLE public.findings DROP CONSTRAINT IF EXISTS findings_source_type_check;
ALTER TABLE public.findings ADD CONSTRAINT findings_source_type_check CHECK (
  source_type IN ('digital_variance', 'planogram_line', 'manual', 'ai_suggested', 'expiry_check', 'ai_alert', 'ai_row', 'checklist')
);

-- One action per finding.
UPDATE public.corrective_actions ca
SET finding_id = NULL
FROM (
  SELECT id, row_number() OVER (PARTITION BY finding_id ORDER BY created_at) AS rn
  FROM public.corrective_actions
  WHERE finding_id IS NOT NULL
) dup
WHERE dup.id = ca.id AND dup.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS corrective_actions_finding_unique
  ON public.corrective_actions (finding_id) WHERE finding_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS corrective_actions_code_unique
  ON public.corrective_actions (code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS corrective_actions_verification_scan_idx
  ON public.corrective_actions (verification_scan_id) WHERE verification_scan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS corrective_actions_assigned_idx
  ON public.corrective_actions (org_id, assigned_to, status);

-- ---------------------------------------------------------------------------
-- 2. Catalog helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ca_action_type(p_finding_type TEXT, p_text TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_finding_type IN ('out_of_stock', 'missing_product') THEN 'availability'
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

CREATE OR REPLACE FUNCTION public.ca_catalog(p_action_type TEXT, p_finding_type TEXT, p_source TEXT)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'action', CASE p_finding_type
      WHEN 'out_of_stock' THEN 'Refill the shelf from backroom stock. If there is no stock, raise a replenishment order.'
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

CREATE OR REPLACE FUNCTION public.ca_signature(p_type TEXT, p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(p_type, '') || '|' || regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '', 'g')
$$;

CREATE OR REPLACE FUNCTION public.ca_legacy_finding_type(p_issue_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_issue_type
    WHEN 'missing' THEN 'missing_product'
    WHEN 'qty_mismatch' THEN 'planogram_violation'
    WHEN 'wrong_category' THEN 'wrong_placement'
    WHEN 'wrong_product' THEN 'wrong_placement'
    WHEN 'wrong_location' THEN 'wrong_placement'
    WHEN 'unexpected' THEN 'shelf_execution_issue'
    ELSE p_issue_type
  END
$$;

CREATE OR REPLACE FUNCTION public.safe_numeric(p_text TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN p_text::numeric;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Store manager first, then a manager covering the store with the fewest open actions,
-- then the auditor, then whoever ran the scan.
CREATE OR REPLACE FUNCTION public.resolve_action_owner(
  p_org_id UUID, p_store_id UUID, p_assignment_id UUID, p_scan_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner UUID;
BEGIN
  IF p_store_id IS NOT NULL THEN
    SELECT s.manager_id INTO v_owner
    FROM public.stores s
    JOIN public.organization_members om
      ON om.org_id = s.org_id AND om.user_id = s.manager_id AND om.status = 'active'
    WHERE s.id = p_store_id AND s.org_id = p_org_id;
    IF v_owner IS NOT NULL THEN RETURN v_owner; END IF;

    SELECT om.user_id INTO v_owner
    FROM public.organization_members om
    WHERE om.org_id = p_org_id
      AND om.status = 'active'
      AND om.user_id IS NOT NULL
      AND om.role::text IN ('store_manager', 'manager')
      AND p_store_id = ANY (COALESCE(om.store_ids, '{}'::uuid[]))
    ORDER BY
      (om.role::text = 'store_manager') DESC,
      (SELECT count(*) FROM public.corrective_actions ca
        WHERE ca.org_id = p_org_id AND ca.assigned_to = om.user_id
          AND ca.status IN ('open', 'assigned', 'in_progress', 'overdue', 'rejected')) ASC,
      om.created_at ASC
    LIMIT 1;
    IF v_owner IS NOT NULL THEN RETURN v_owner; END IF;
  END IF;

  IF p_assignment_id IS NOT NULL THEN
    SELECT a.assignee_id INTO v_owner
    FROM public.scan_assignments a
    JOIN public.organization_members om
      ON om.org_id = a.org_id AND om.user_id = a.assignee_id AND om.status = 'active'
    WHERE a.id = p_assignment_id;
    IF v_owner IS NOT NULL THEN RETURN v_owner; END IF;
  END IF;

  IF p_scan_id IS NOT NULL THEN
    SELECT s.created_by INTO v_owner
    FROM public.shelf_scans s
    JOIN public.organization_members om
      ON om.org_id = s.org_id AND om.user_id = s.created_by AND om.status = 'active'
    WHERE s.id = p_scan_id;
  END IF;
  RETURN v_owner;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Defaults, notification, RCA guard
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
  v_cat := public.ca_catalog(NEW.action_type, v_type, NEW.source);

  IF NEW.evidence_required IS NULL OR NEW.evidence_required = '[]'::jsonb THEN
    NEW.evidence_required := v_cat -> 'evidence';
  END IF;
  NEW.verification_method := COALESCE(NEW.verification_method, v_cat ->> 'verification');
  NEW.priority := COALESCE(NEW.priority, 'medium');
  NEW.sla_hours := COALESCE(NEW.sla_hours, public.sla_hours_for_severity(NEW.org_id, NEW.priority));
  NEW.due_at := COALESCE(
    NEW.due_at, v_f_due,
    COALESCE(NEW.created_at, now()) + make_interval(hours => NEW.sla_hours)
  );
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

DROP TRIGGER IF EXISTS corrective_actions_fill_defaults ON public.corrective_actions;
CREATE TRIGGER corrective_actions_fill_defaults
  BEFORE INSERT OR UPDATE ON public.corrective_actions
  FOR EACH ROW EXECUTE FUNCTION public.ca_fill_defaults();

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
    NEW.submitted_at := COALESCE(NEW.submitted_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS corrective_actions_guard_submission ON public.corrective_actions;
CREATE TRIGGER corrective_actions_guard_submission
  BEFORE UPDATE OF status ON public.corrective_actions
  FOR EACH ROW EXECUTE FUNCTION public.ca_guard_submission();

CREATE OR REPLACE FUNCTION public.ca_notify_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('aislix.ca_backfill', true) = 'on' THEN RETURN NEW; END IF;
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

DROP TRIGGER IF EXISTS corrective_actions_notify_owner ON public.corrective_actions;
CREATE TRIGGER corrective_actions_notify_owner
  AFTER INSERT ON public.corrective_actions
  FOR EACH ROW EXECUTE FUNCTION public.ca_notify_owner();

-- ---------------------------------------------------------------------------
-- 4. One action for every finding
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_action_for_finding(p_finding_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Products on the shelf that are not in the plan are information, not a fix.
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
      due_at = COALESCE(due_at, (SELECT due_at FROM public.corrective_actions WHERE id = v_id)),
      updated_at = now()
  WHERE id = f.id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.findings_ensure_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  BEGIN
    PERFORM public.ensure_action_for_finding(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto corrective action failed for finding %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS findings_ensure_action ON public.findings;
CREATE TRIGGER findings_ensure_action
  AFTER INSERT ON public.findings
  FOR EACH ROW EXECUTE FUNCTION public.findings_ensure_action();

-- ---------------------------------------------------------------------------
-- 5. AI findings from persisted scan results
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
      nullif(l ->> 'raw_text', ''),
      nullif(l ->> 'sku', ''),
      n.pname,
      NULL::text,
      nullif(l ->> 'expected_location', ''),
      x.expv, x.actv, false
    FROM jsonb_array_elements(v_lines) l
    CROSS JOIN LATERAL (
      SELECT nullif(concat_ws(' ', nullif(l ->> 'brand', ''), nullif(l ->> 'product_name', ''), nullif(l ->> 'variant', '')), '') AS pname
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
      SELECT nullif(concat_ws(' ', nullif(p ->> 'brand', ''), nullif(p ->> 'product_name', ''), nullif(p ->> 'variant', '')), '') AS pname
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

CREATE OR REPLACE FUNCTION public.sync_ai_findings_for_scan(p_scan_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s public.shelf_scans%ROWTYPE;
  i RECORD;
  v_n INT := 0;
  v_origin TEXT;
BEGIN
  SELECT * INTO s FROM public.shelf_scans WHERE id = p_scan_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF coalesce(s.reaudit_reason, '') LIKE 'corrective_action:%' THEN RETURN 0; END IF;
  IF coalesce(s.audit_mode, 'ai') = 'digital' OR s.status::text = 'failed' THEN RETURN 0; END IF;
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = s.org_id AND om.user_id = auth.uid() AND om.status = 'active'
  ) THEN
    RETURN 0;
  END IF;

  v_origin := CASE WHEN s.audit_mode = 'ai_assisted' THEN 'ai_assisted' ELSE 'ai' END;

  FOR i IN SELECT * FROM public.ai_scan_issues(p_scan_id) WHERE NOT from_comparison LOOP
    INSERT INTO public.findings (
      org_id, scan_id, assignment_id, store_id, source_type, source_id, audit_origin,
      finding_type, severity, confirmation_state, title, description, sku, product_name,
      category, shelf_label, expected_value, actual_value, variance_units, due_at
    )
    VALUES (
      s.org_id, p_scan_id, s.assignment_id, s.store_id,
      CASE WHEN i.issue_key LIKE 'alert:%' THEN 'ai_alert' ELSE 'ai_row' END,
      md5(p_scan_id::text || ':' || i.issue_key)::uuid,
      v_origin, i.finding_type, i.severity, 'ai_suggested', i.title, i.description, i.sku,
      i.product_name, i.category, i.shelf_label, i.expected_value, i.actual_value,
      CASE WHEN i.expected_value IS NOT NULL AND i.actual_value IS NOT NULL THEN i.actual_value - i.expected_value END,
      now() + make_interval(hours => public.sla_hours_for_severity(s.org_id, i.severity))
    )
    ON CONFLICT (org_id, source_type, source_id) DO NOTHING;
    IF FOUND THEN v_n := v_n + 1; END IF;
  END LOOP;
  RETURN v_n;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Checklist findings (Digital): failed answers, QC fails, missing evidence
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_checklist_findings(p_assignment_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  a public.scan_assignments%ROWTYPE;
  r RECORD;
  fld JSONB;
  v_scan UUID;
  v_reason TEXT;
  v_label TEXT;
  v_fail_on TEXT;
  v_answer TEXT;
  v_type TEXT;
  v_title TEXT;
  v_sev TEXT;
  v_item TEXT;
  v_origin TEXT;
  v_n INT := 0;
BEGIN
  SELECT * INTO a FROM public.scan_assignments WHERE id = p_assignment_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = a.org_id AND om.user_id = auth.uid() AND om.status = 'active'
  ) THEN
    RETURN 0;
  END IF;

  SELECT id, reaudit_reason INTO v_scan, v_reason
  FROM public.shelf_scans WHERE assignment_id = p_assignment_id
  ORDER BY created_at DESC LIMIT 1;
  IF coalesce(v_reason, '') LIKE 'corrective_action:%' THEN RETURN 0; END IF;
  v_origin := CASE WHEN a.audit_mode = 'ai' THEN 'ai' WHEN a.audit_mode = 'ai_assisted' THEN 'ai_assisted' ELSE 'digital' END;

  FOR r IN
    SELECT * FROM public.audit_responses
    WHERE assignment_id = p_assignment_id AND field_type IN ('yes_no', 'qc_status')
  LOOP
    fld := jsonb_path_query_first(
      COALESCE(a.template_snapshot, '{}'::jsonb),
      '$.** ? (@.key == $k && exists(@.label))',
      jsonb_build_object('k', r.field_key)
    );
    CONTINUE WHEN fld IS NULL;
    CONTINUE WHEN coalesce((fld ->> 'system')::boolean, false) OR coalesce((fld ->> 'calculated')::boolean, false);
    CONTINUE WHEN coalesce(fld ->> 'fieldRole', '') IN ('reference', 'calculated', 'system', 'evidence');

    v_label := coalesce(nullif(fld ->> 'label', ''), initcap(replace(r.field_key, '_', ' ')));
    v_answer := lower(coalesce(r.value #>> '{}', ''));

    IF r.field_type = 'yes_no' THEN
      v_fail_on := lower(coalesce(fld -> 'config' ->> 'failOn', fld -> 'config' ->> 'failValue', 'no'));
      IF v_fail_on IN ('yes', 'true') THEN
        CONTINUE WHEN v_answer NOT IN ('true', 'yes', 'y');
      ELSE
        CONTINUE WHEN v_answer NOT IN ('false', 'no', 'n');
      END IF;
      v_type := 'other';
      v_title := 'Check failed: ' || v_label;
      v_sev := CASE
        WHEN lower(coalesce(fld -> 'config' ->> 'severity', '')) IN ('critical', 'high', 'medium', 'low')
          THEN lower(fld -> 'config' ->> 'severity')
        WHEN public.ca_action_type('other', v_label) = 'safety' THEN 'high'
        ELSE 'medium'
      END;
      v_item := NULL;
    ELSE
      CONTINUE WHEN v_answer <> 'fail';
      SELECT x.value #>> '{}' INTO v_item
      FROM public.audit_responses x
      WHERE x.assignment_id = r.assignment_id AND x.section_key = r.section_key
        AND x.record_index IS NOT DISTINCT FROM r.record_index
        AND x.field_key IN ('item', 'item_name', 'product', 'product_name', 'sku', 'name')
        AND coalesce(x.value #>> '{}', '') <> ''
      LIMIT 1;
      SELECT lower(x.value #>> '{}') INTO v_sev
      FROM public.audit_responses x
      WHERE x.assignment_id = r.assignment_id AND x.section_key = r.section_key
        AND x.record_index IS NOT DISTINCT FROM r.record_index
        AND x.field_type = 'defect_severity'
      LIMIT 1;
      v_sev := CASE WHEN v_sev IN ('critical', 'high', 'medium', 'low') THEN v_sev ELSE 'medium' END;
      v_type := 'damaged_product';
      v_title := 'QC failed';
    END IF;

    INSERT INTO public.findings (
      org_id, scan_id, assignment_id, store_id, source_type, source_id, audit_origin,
      finding_type, severity, confirmation_state, title, description, product_name, created_by, due_at
    )
    VALUES (
      a.org_id, v_scan, a.id, a.store_id, 'checklist', r.id, v_origin,
      v_type, v_sev, 'human_confirmed', v_title,
      CASE WHEN v_item IS NOT NULL THEN v_label || ' — ' || v_item ELSE v_label END,
      v_item, a.assignee_id,
      now() + make_interval(hours => public.sla_hours_for_severity(a.org_id, v_sev))
    )
    ON CONFLICT (org_id, source_type, source_id) DO NOTHING;
    IF FOUND THEN v_n := v_n + 1; END IF;
  END LOOP;

  IF coalesce(a.audit_mode, 'digital') = 'digital' THEN
    FOR fld IN
      SELECT f FROM jsonb_path_query(
        COALESCE(a.template_snapshot, '{}'::jsonb),
        '$.** ? (exists(@.label) && @.required == true && (@.type == "multiple_images" || @.type == "image" || @.type == "photo" || @.type == "file" || @.type == "signature"))'
      ) f
    LOOP
      CONTINUE WHEN NOT EXISTS (
        SELECT 1 FROM public.audit_responses x
        WHERE x.assignment_id = p_assignment_id
          AND (fld ->> 'section' IS NULL OR x.section_key = fld ->> 'section')
      );
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM public.audit_responses x
        WHERE x.assignment_id = p_assignment_id
          AND x.field_key = fld ->> 'key'
          AND x.value IS NOT NULL
          AND x.value NOT IN ('null'::jsonb, '[]'::jsonb, '""'::jsonb, '{}'::jsonb)
      );
      v_label := coalesce(nullif(fld ->> 'label', ''), initcap(replace(fld ->> 'key', '_', ' ')));
      INSERT INTO public.findings (
        org_id, scan_id, assignment_id, store_id, source_type, source_id, audit_origin,
        finding_type, severity, confirmation_state, title, description, created_by, due_at
      )
      VALUES (
        a.org_id, v_scan, a.id, a.store_id, 'checklist',
        md5(p_assignment_id::text || ':evidence:' || coalesce(fld ->> 'key', v_label))::uuid,
        v_origin, 'other', 'medium', 'human_confirmed',
        'Required evidence missing', v_label, a.assignee_id,
        now() + make_interval(hours => public.sla_hours_for_severity(a.org_id, 'medium'))
      )
      ON CONFLICT (org_id, source_type, source_id) DO NOTHING;
      IF FOUND THEN v_n := v_n + 1; END IF;
    END LOOP;
  END IF;
  RETURN v_n;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. AI re-check verification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_action_verification(p_action_id UUID, p_scan_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ca public.corrective_actions%ROWTYPE;
  v_before INT;
BEGIN
  SELECT * INTO ca FROM public.corrective_actions WHERE id = p_action_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Corrective action not found.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = ca.org_id AND om.user_id = auth.uid() AND om.status = 'active'
  ) THEN
    RAISE EXCEPTION 'You do not have access to this corrective action.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shelf_scans WHERE id = p_scan_id AND org_id = ca.org_id) THEN
    RAISE EXCEPTION 'The re-check photo was not found.';
  END IF;

  UPDATE public.shelf_scans
  SET reaudit_reason = 'corrective_action:' || p_action_id::text,
      parent_scan_id = COALESCE(parent_scan_id, ca.scan_id)
  WHERE id = p_scan_id;

  IF ca.scan_id IS NOT NULL THEN
    SELECT count(*) INTO v_before FROM public.ai_scan_issues(ca.scan_id);
  END IF;

  UPDATE public.corrective_actions
  SET verification_scan_id = p_scan_id,
      verification_status = 'pending',
      verification_method = 'ai_rescan',
      before_score = v_before,
      after_score = NULL,
      status = 'pending_verification',
      resolved_at = now(),
      resolved_by = auth.uid(),
      rejection_reason = NULL,
      updated_at = now()
  WHERE id = p_action_id;

  INSERT INTO public.audit_activity_events (org_id, scan_id, finding_id, action_id, actor_id, event_type, summary)
  VALUES (ca.org_id, ca.scan_id, ca.finding_id, p_action_id, auth.uid(), 'ai_recheck_started', 'After photo sent for AI re-check');
END;
$$;

CREATE OR REPLACE FUNCTION public.scan_has_plan_context(p_scan_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.planogram_comparisons c
    JOIN public.planogram_comparison_lines l ON l.comparison_id = c.id
    WHERE c.scan_id = p_scan_id
  ) OR EXISTS (
    SELECT 1 FROM public.scan_results r
    WHERE r.scan_id = p_scan_id
      AND (
        jsonb_array_length(COALESCE(
          CASE WHEN jsonb_typeof(r.metrics -> 'aislix_planogram_analysis' -> 'reference_match' -> 'lines') = 'array'
            THEN r.metrics -> 'aislix_planogram_analysis' -> 'reference_match' -> 'lines' END,
          '[]'::jsonb)) > 0
        OR r.metrics -> 'aislix_planogram_analysis' ->> 'mode' = 'planogram'
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.evaluate_action_verification(p_action_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ca public.corrective_actions%ROWTYPE;
  v_sig TEXT;
  v_before INT;
  v_after INT;
  v_still BOOLEAN;
  v_scan_status TEXT;
  v_source_type TEXT;
BEGIN
  SELECT * INTO ca FROM public.corrective_actions WHERE id = p_action_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = ca.org_id AND om.user_id = auth.uid() AND om.status = 'active'
  ) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  IF ca.verification_scan_id IS NULL THEN RETURN jsonb_build_object('status', 'no_scan'); END IF;
  IF ca.verification_status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('status', ca.verification_status, 'before', ca.before_score, 'after', ca.after_score);
  END IF;

  SELECT status::text INTO v_scan_status FROM public.shelf_scans WHERE id = ca.verification_scan_id;
  IF NOT EXISTS (SELECT 1 FROM public.scan_results WHERE scan_id = ca.verification_scan_id) THEN
    RETURN jsonb_build_object('status', CASE WHEN v_scan_status = 'failed' THEN 'scan_failed' ELSE 'pending' END);
  END IF;

  IF ca.finding_id IS NOT NULL THEN
    SELECT public.ca_signature(f.finding_type, coalesce(f.product_name, f.title)), f.source_type
    INTO v_sig, v_source_type
    FROM public.findings f WHERE f.id = ca.finding_id;
  END IF;

  v_before := ca.before_score;
  IF v_before IS NULL AND ca.scan_id IS NOT NULL THEN
    SELECT count(*) INTO v_before FROM public.ai_scan_issues(ca.scan_id);
  END IF;
  SELECT count(*) INTO v_after FROM public.ai_scan_issues(ca.verification_scan_id);

  -- Plan-based issues can only be re-checked when the new photo was compared to the same plan.
  IF (v_source_type IN ('ai_row', 'planogram_line') OR ca.comparison_id IS NOT NULL)
     AND NOT public.scan_has_plan_context(ca.verification_scan_id) THEN
    UPDATE public.corrective_actions
    SET verification_method = 'manager_review',
        verification_status = NULL,
        before_score = v_before,
        after_score = v_after,
        updated_at = now()
    WHERE id = p_action_id;
    RETURN jsonb_build_object('status', 'needs_review', 'before', v_before, 'after', v_after);
  END IF;

  IF v_sig IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.ai_scan_issues(ca.verification_scan_id) i WHERE i.signature = v_sig) INTO v_still;
  ELSE
    v_still := v_after > 0 AND v_after >= coalesce(v_before, 0);
  END IF;

  UPDATE public.corrective_actions
  SET before_score = v_before,
      after_score = v_after,
      verification_status = CASE WHEN v_still THEN 'failed' ELSE 'passed' END,
      status = CASE WHEN v_still THEN 'in_progress' ELSE 'verified' END,
      verified_at = CASE WHEN v_still THEN NULL ELSE now() END,
      rejection_reason = CASE WHEN v_still THEN 'AI re-check still found this issue on the shelf.' ELSE NULL END,
      updated_at = now()
  WHERE id = p_action_id;

  IF ca.finding_id IS NOT NULL THEN
    UPDATE public.findings
    SET status = CASE WHEN v_still THEN 'in_progress' ELSE 'resolved' END,
        resolved_at = CASE WHEN v_still THEN resolved_at ELSE now() END,
        verified_at = CASE WHEN v_still THEN verified_at ELSE now() END,
        updated_at = now()
    WHERE id = ca.finding_id;
  END IF;

  INSERT INTO public.audit_activity_events (org_id, scan_id, finding_id, action_id, actor_id, event_type, summary)
  VALUES (
    ca.org_id, ca.verification_scan_id, ca.finding_id, p_action_id, auth.uid(),
    CASE WHEN v_still THEN 'ai_recheck_failed' ELSE 'ai_recheck_passed' END,
    CASE WHEN v_still THEN 'AI re-check still found the issue' ELSE 'AI re-check confirmed the fix' END
  );

  IF ca.assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, org_id, type, title, body, payload)
    VALUES (
      ca.assigned_to, ca.org_id, 'action_verification',
      CASE WHEN v_still THEN 'Fix not confirmed' ELSE 'Fix confirmed by AI' END,
      coalesce(ca.code || ' · ', '') || coalesce(ca.title, ca.suggestion),
      jsonb_build_object('action_id', ca.id, 'scan_id', ca.verification_scan_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_still THEN 'failed' ELSE 'passed' END,
    'before', v_before, 'after', v_after
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.scan_results_sync_actions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reason TEXT;
  v_action UUID;
BEGIN
  BEGIN
    SELECT reaudit_reason INTO v_reason FROM public.shelf_scans WHERE id = NEW.scan_id;
    IF coalesce(v_reason, '') LIKE 'corrective_action:%' THEN
      FOR v_action IN
        SELECT id FROM public.corrective_actions
        WHERE verification_scan_id = NEW.scan_id AND verification_status = 'pending'
      LOOP
        PERFORM public.evaluate_action_verification(v_action);
      END LOOP;
    ELSE
      PERFORM public.sync_ai_findings_for_scan(NEW.scan_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'corrective action sync failed for scan %: %', NEW.scan_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scan_results_sync_actions ON public.scan_results;
CREATE TRIGGER scan_results_sync_actions
  AFTER INSERT OR UPDATE OF metrics ON public.scan_results
  FOR EACH ROW EXECUTE FUNCTION public.scan_results_sync_actions();

CREATE OR REPLACE FUNCTION public.scan_assignments_sync_checklist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  BEGIN
    PERFORM public.sync_checklist_findings(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'checklist findings sync failed for assignment %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scan_assignments_sync_checklist ON public.scan_assignments;
CREATE TRIGGER scan_assignments_sync_checklist
  AFTER UPDATE OF status ON public.scan_assignments
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.scan_assignments_sync_checklist();

-- ---------------------------------------------------------------------------
-- 8. Escalation: owner's manager first, then admins after another SLA period
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_corrective_action_escalations(p_org_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_overdue INT := 0;
  v_l1 INT := 0;
  v_l2 INT := 0;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF p_org_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.org_id = p_org_id AND om.user_id = auth.uid() AND om.status = 'active'
    ) THEN
      RETURN jsonb_build_object('overdue', 0, 'escalated_to_manager', 0, 'escalated_to_admin', 0);
    END IF;
  END IF;

  UPDATE public.corrective_actions
  SET status = 'overdue', updated_at = now()
  WHERE (p_org_id IS NULL OR org_id = p_org_id)
    AND status IN ('open', 'assigned')
    AND due_at < now();
  GET DIAGNOSTICS v_overdue = ROW_COUNT;

  WITH cand AS (
    SELECT ca.id, ca.org_id, mgr.user_id AS manager_id
    FROM public.corrective_actions ca
    JOIN public.organization_members om ON om.org_id = ca.org_id AND om.user_id = ca.assigned_to
    JOIN public.organization_members mgr
      ON mgr.org_id = ca.org_id AND mgr.user_id = om.reports_to_user_id AND mgr.status = 'active'
    WHERE (p_org_id IS NULL OR ca.org_id = p_org_id)
      AND ca.status IN ('open', 'assigned', 'in_progress', 'overdue', 'rejected')
      AND ca.due_at < now()
      AND ca.escalation_level = 0
    LIMIT 1000
  ),
  upd AS (
    UPDATE public.corrective_actions c
    SET escalation_level = 1, escalated_at = now()
    FROM cand
    WHERE c.id = cand.id
    RETURNING c.id, c.org_id, cand.manager_id
  ),
  sent AS (
    INSERT INTO public.notifications (user_id, org_id, type, title, body, payload)
    SELECT manager_id, org_id, 'action_escalated', 'Corrective actions overdue',
      format('%s corrective action(s) owned by your team are past due.', count(*)),
      jsonb_build_object('action_ids', jsonb_agg(id), 'level', 1)
    FROM upd
    GROUP BY manager_id, org_id
    RETURNING 1
  )
  SELECT count(*) INTO v_l1 FROM upd;

  WITH cand AS (
    SELECT ca.id, ca.org_id
    FROM public.corrective_actions ca
    LEFT JOIN public.organization_members om ON om.org_id = ca.org_id AND om.user_id = ca.assigned_to
    LEFT JOIN public.organization_members mgr
      ON mgr.org_id = ca.org_id AND mgr.user_id = om.reports_to_user_id AND mgr.status = 'active'
    WHERE (p_org_id IS NULL OR ca.org_id = p_org_id)
      AND ca.status IN ('open', 'assigned', 'in_progress', 'overdue', 'rejected')
      AND ca.due_at < now()
      AND (
        (ca.escalation_level = 0 AND mgr.user_id IS NULL)
        OR (ca.escalation_level = 1 AND ca.escalated_at < now() - make_interval(hours => coalesce(ca.sla_hours, 24)))
      )
    LIMIT 1000
  ),
  upd AS (
    UPDATE public.corrective_actions c
    SET escalation_level = 2, escalated_at = now()
    FROM cand
    WHERE c.id = cand.id
    RETURNING c.id, c.org_id
  ),
  grouped AS (
    SELECT org_id, count(*) AS n, jsonb_agg(id) AS ids FROM upd GROUP BY org_id
  ),
  sent AS (
    INSERT INTO public.notifications (user_id, org_id, type, title, body, payload)
    SELECT om.user_id, g.org_id, 'action_escalated', 'Corrective actions need attention',
      format('%s overdue corrective action(s) were escalated to you.', g.n),
      jsonb_build_object('action_ids', g.ids, 'level', 2)
    FROM grouped g
    JOIN public.organization_members om
      ON om.org_id = g.org_id AND om.status = 'active' AND om.user_id IS NOT NULL
     AND om.role::text IN ('owner', 'admin')
    RETURNING 1
  )
  SELECT count(*) INTO v_l2 FROM upd;

  RETURN jsonb_build_object('overdue', v_overdue, 'escalated_to_manager', v_l1, 'escalated_to_admin', v_l2);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_assignment_reminders(p_limit integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row RECORD;
  v_hours INT;
  v_sent INT := 0;
  v_now TIMESTAMPTZ := now();
  v_tz TEXT;
  v_escalations JSONB;
BEGIN
  FOR v_row IN
    SELECT a.*,
      COALESCE(s.reminder_hours, '{24,12,4,1}'::INT[]) AS reminder_hours,
      s.escalation_user_id,
      COALESCE(sch.timezone, 'Asia/Kolkata') AS location_timezone
    FROM public.scan_assignments a
    LEFT JOIN public.org_assignment_settings s ON s.org_id = a.org_id
    LEFT JOIN public.audit_schedules sch ON sch.id = a.schedule_id
    WHERE a.status IN ('pending', 'in_progress')
      AND a.due_at IS NOT NULL
      AND a.due_at > v_now - INTERVAL '7 days'
    ORDER BY a.due_at ASC
    LIMIT p_limit
  LOOP
    v_tz := COALESCE(v_row.location_timezone, 'Asia/Kolkata');

    IF v_row.due_at < v_now THEN
      INSERT INTO public.assignment_reminder_log (assignment_id, reminder_type, reminder_hours)
      VALUES (v_row.id, 'overdue', NULL)
      ON CONFLICT DO NOTHING;
      IF FOUND THEN
        INSERT INTO public.notifications (user_id, org_id, type, title, body, payload)
        VALUES (
          v_row.assignee_id, v_row.org_id, 'scan_assigned',
          'Audit overdue',
          format('An assigned audit is past its due date (timezone: %s).', v_tz),
          jsonb_build_object('assignment_id', v_row.id, 'reminder_type', 'overdue', 'timezone', v_tz)
        );
        UPDATE public.scan_assignments SET assignment_state = 'overdue', updated_at = v_now
        WHERE id = v_row.id AND assignment_state NOT IN ('submitted', 'approved', 'cancelled');
        v_sent := v_sent + 1;

        IF v_row.escalation_user_id IS NOT NULL THEN
          INSERT INTO public.assignment_reminder_log (assignment_id, reminder_type, reminder_hours)
          VALUES (v_row.id, 'escalation', NULL)
          ON CONFLICT DO NOTHING;
          IF FOUND THEN
            INSERT INTO public.notifications (user_id, org_id, type, title, body, payload)
            VALUES (
              v_row.escalation_user_id, v_row.org_id, 'scan_assigned',
              'Overdue audit escalation',
              format('An assigned audit is overdue (timezone: %s).', v_tz),
              jsonb_build_object('assignment_id', v_row.id, 'reminder_type', 'escalation', 'timezone', v_tz)
            );
            v_sent := v_sent + 1;
          END IF;
        END IF;
      END IF;
      CONTINUE;
    END IF;

    FOREACH v_hours IN ARRAY v_row.reminder_hours
    LOOP
      IF v_row.due_at <= v_now + (v_hours * INTERVAL '1 hour')
         AND v_row.due_at > v_now + ((v_hours - 1) * INTERVAL '1 hour') THEN
        INSERT INTO public.assignment_reminder_log (assignment_id, reminder_type, reminder_hours)
        VALUES (v_row.id, 'due_soon', v_hours)
        ON CONFLICT DO NOTHING;
        IF FOUND THEN
          INSERT INTO public.notifications (user_id, org_id, type, title, body, payload)
          VALUES (
            v_row.assignee_id, v_row.org_id, 'scan_assigned',
            format('Audit due in %s hours', v_hours),
            format(
              'Complete your assigned audit before the due date (%s local schedule timezone).',
              v_tz
            ),
            jsonb_build_object(
              'assignment_id', v_row.id,
              'reminder_hours', v_hours,
              'timezone', v_tz,
              'due_at', v_row.due_at
            )
          );
          v_sent := v_sent + 1;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  BEGIN
    v_escalations := public.process_corrective_action_escalations(NULL);
  EXCEPTION WHEN OTHERS THEN
    v_escalations := jsonb_build_object('error', SQLERRM);
  END;

  RETURN jsonb_build_object('reminders_sent', v_sent, 'action_escalations', v_escalations);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. Who can audit which store (Regional / City heads cover many stores)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.member_store_coverage(p_org_id UUID)
RETURNS TABLE (user_id UUID, role TEXT, scoped BOOLEAN, store_ids UUID[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH me AS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org_id AND organization_members.user_id = auth.uid() AND status = 'active'
  ),
  active_stores AS (
    SELECT COALESCE(array_agg(s.id), '{}'::uuid[]) AS ids
    FROM public.stores s WHERE s.org_id = p_org_id AND s.status = 'active'
  ),
  members AS (
    SELECT om.user_id, om.role::text AS role, COALESCE(om.store_ids, '{}'::uuid[]) AS direct
    FROM public.organization_members om
    WHERE om.org_id = p_org_id
      AND om.user_id IS NOT NULL
      AND om.status IN ('active', 'invited')
      AND EXISTS (SELECT 1 FROM me)
  )
  SELECT
    m.user_id,
    m.role,
    CASE WHEN m.role IN ('owner', 'admin') THEN true ELSE cardinality(t.ids) > 0 END,
    CASE WHEN m.role IN ('owner', 'admin') THEN (SELECT ids FROM active_stores) ELSE t.ids END
  FROM members m
  CROSS JOIN LATERAL (
    WITH RECURSIVE team AS (
      SELECT c.user_id FROM public.organization_members c
      WHERE c.org_id = p_org_id AND c.reports_to_user_id = m.user_id AND c.status = 'active'
      UNION
      SELECT c.user_id FROM public.organization_members c
      JOIN team ON c.reports_to_user_id = team.user_id
      WHERE c.org_id = p_org_id AND c.status = 'active'
    )
    SELECT COALESCE(array_agg(DISTINCT s.id), '{}'::uuid[]) AS ids
    FROM public.stores s
    WHERE s.org_id = p_org_id
      AND s.status = 'active'
      AND (
        s.id = ANY (m.direct)
        OR s.manager_id = m.user_id
        OR s.id IN (
          SELECT unnest(COALESCE(c.store_ids, '{}'::uuid[]))
          FROM public.organization_members c
          WHERE c.org_id = p_org_id AND c.user_id IN (SELECT team.user_id FROM team)
        )
      )
  ) t
$$;

REVOKE ALL ON FUNCTION public.member_store_coverage(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_store_coverage(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.process_corrective_action_escalations(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_corrective_action_escalations(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.start_action_verification(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_action_verification(UUID, UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.evaluate_action_verification(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_action_verification(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.sync_ai_findings_for_scan(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_ai_findings_for_scan(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.sync_checklist_findings(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_checklist_findings(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_scan_issues(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_scan_issues(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.ensure_action_for_finding(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_action_owner(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10. Backfill: legacy actions, findings without actions, recent audits
-- ---------------------------------------------------------------------------
SELECT set_config('aislix.ca_backfill', 'on', false);

UPDATE public.corrective_actions SET updated_at = updated_at WHERE code IS NULL;

SELECT public.ensure_action_for_finding(f.id)
FROM public.findings f
WHERE f.status NOT IN ('resolved', 'closed')
  AND NOT EXISTS (SELECT 1 FROM public.corrective_actions ca WHERE ca.finding_id = f.id);

SELECT public.sync_ai_findings_for_scan(s.id)
FROM public.shelf_scans s
WHERE s.status::text = 'completed'
  AND s.created_at > now() - interval '14 days'
  AND coalesce(s.audit_mode, 'ai') <> 'digital';

SELECT public.sync_checklist_findings(a.id)
FROM public.scan_assignments a
WHERE a.status = 'completed'
  AND a.updated_at > now() - interval '14 days';

UPDATE public.corrective_actions
SET escalation_level = 2, escalated_at = now()
WHERE due_at < now() AND escalation_level = 0
  AND status IN ('open', 'assigned', 'in_progress', 'overdue', 'rejected');

UPDATE public.corrective_actions
SET status = 'overdue'
WHERE status IN ('open', 'assigned') AND due_at < now();

SELECT set_config('aislix.ca_backfill', 'off', false);
