-- Display / POSM checks: one photo of a store display, what the AI saw (present, brand,
-- condition, placement) and the status Aislix decided from it. Problems become findings,
-- and the findings trigger opens a fix for each.

CREATE TABLE IF NOT EXISTS public.display_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  expected_brand text,
  expected_display text,
  status text NOT NULL CHECK (status IN ('good', 'needs_fix', 'missing', 'none_found', 'unclear')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_brand_present boolean,
  image_quality text,
  summary text,
  issues_raised integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS display_checks_org_created_idx ON public.display_checks (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS display_checks_store_idx ON public.display_checks (store_id, created_at DESC);

ALTER TABLE public.display_checks ENABLE ROW LEVEL SECURITY;

-- Same visibility as audits: admins see all, others see stores in their access or their own checks.
DROP POLICY IF EXISTS display_checks_select ON public.display_checks;
CREATE POLICY display_checks_select ON public.display_checks
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(org_id)
    AND (
      public.is_org_owner_or_admin(org_id)
      OR public.user_can_access_store(org_id, store_id, auth.uid())
      OR created_by = auth.uid()
      OR public.is_demo_org_readable(org_id)
    )
  );

-- Rows are written by the server after it checks store access; no client writes.
GRANT SELECT ON public.display_checks TO authenticated;
GRANT ALL ON public.display_checks TO service_role;

ALTER TABLE public.findings DROP CONSTRAINT IF EXISTS findings_source_type_check;
ALTER TABLE public.findings ADD CONSTRAINT findings_source_type_check CHECK (
  source_type IN ('digital_variance', 'planogram_line', 'manual', 'ai_suggested', 'expiry_check', 'ai_alert', 'ai_row', 'checklist', 'display_check')
);
