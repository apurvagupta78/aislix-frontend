-- Exception records + audit templates (Wave 6 UI)

CREATE TABLE IF NOT EXISTS public.audit_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('digital_variance', 'pending_review', 'corrective_action')),
  source_id text NOT NULL,
  scan_id uuid REFERENCES public.shelf_scans(id) ON DELETE SET NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  assignment_id uuid REFERENCES public.scan_assignments(id) ON DELETE SET NULL,
  severity text NOT NULL DEFAULT 'attention' CHECK (severity IN ('critical', 'attention', 'normal')),
  lifecycle text NOT NULL DEFAULT 'open' CHECK (
    lifecycle IN ('open', 'acknowledged', 'investigating', 'action_assigned', 'awaiting_verification', 'resolved', 'reopened')
  ),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at timestamptz,
  title text NOT NULL,
  description text,
  impact_label text,
  shelf_label text,
  sku_label text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS audit_exceptions_org_lifecycle_idx ON public.audit_exceptions (org_id, lifecycle);
CREATE INDEX IF NOT EXISTS audit_exceptions_org_store_idx ON public.audit_exceptions (org_id, store_id);
CREATE INDEX IF NOT EXISTS audit_exceptions_owner_idx ON public.audit_exceptions (owner_id) WHERE owner_id IS NOT NULL;

ALTER TABLE public.audit_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_exceptions_org_select ON public.audit_exceptions
  FOR SELECT USING (
    org_id IN (SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active')
  );

CREATE POLICY audit_exceptions_org_write ON public.audit_exceptions
  FOR ALL USING (
    org_id IN (
      SELECT om.org_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.status = 'active' AND om.role IN ('owner', 'admin', 'manager')
    )
  );

CREATE TABLE IF NOT EXISTS public.audit_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  template_type text NOT NULL DEFAULT 'shelf_audit' CHECK (
    template_type IN ('shelf_audit', 'inventory_audit', 'planogram_audit', 'pricing_audit', 'checklist_audit', 'custom')
  ),
  audit_mode text NOT NULL DEFAULT 'digital' CHECK (audit_mode IN ('ai', 'digital')),
  scope_type text NOT NULL DEFAULT 'planogram',
  scope_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  instructions text,
  evidence_required boolean NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1,
  published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_templates_org_idx ON public.audit_templates (org_id, published);

ALTER TABLE public.audit_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_templates_org_select ON public.audit_templates
  FOR SELECT USING (
    org_id IN (SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active')
  );

CREATE POLICY audit_templates_org_write ON public.audit_templates
  FOR ALL USING (
    org_id IN (
      SELECT om.org_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.status = 'active' AND om.role IN ('owner', 'admin', 'manager')
    )
  );
