-- Org-level audit digest delivery preferences (email + WhatsApp)

CREATE TABLE IF NOT EXISTS public.audit_digest_settings (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  whatsapp_number text,
  cadence text NOT NULL DEFAULT 'daily' CHECK (cadence IN ('daily', 'weekly')),
  send_time_local text NOT NULL DEFAULT '08:00',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  include_exceptions boolean NOT NULL DEFAULT true,
  include_variance_summary boolean NOT NULL DEFAULT true,
  include_pending_approvals boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  last_status text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_digest_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_digest_settings_select ON public.audit_digest_settings
  FOR SELECT USING (
    org_id IN (SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid() AND om.status = 'active')
  );

CREATE POLICY audit_digest_settings_write ON public.audit_digest_settings
  FOR ALL USING (
    org_id IN (
      SELECT om.org_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.status = 'active' AND om.role IN ('owner', 'admin', 'manager')
    )
  );
