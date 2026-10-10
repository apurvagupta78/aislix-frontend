-- Quick checks for store managers, run without any audit setup:
--   shelf_csv_checks  one shelf photo -> the AI shelf count (brand, product, variant, facings, units) as a table
--   fnv_checks        one produce photo -> sellable / not sellable / check manually
--   hygiene_checks    one shelf photo -> hygiene passed / failed with what to fix
-- Not-sellable produce and failed hygiene become findings, and the findings trigger opens a fix.

CREATE TABLE IF NOT EXISTS public.shelf_csv_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  shelf_label text,
  products jsonb NOT NULL DEFAULT '[]'::jsonb,
  products_count integer NOT NULL DEFAULT 0,
  brands_count integer NOT NULL DEFAULT 0,
  facings_total integer NOT NULL DEFAULT 0,
  units_total integer NOT NULL DEFAULT 0,
  image_quality text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fnv_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  item_hint text,
  product text,
  verdict text NOT NULL CHECK (verdict IN ('sellable', 'not_sellable', 'check_manually')),
  confidence numeric,
  units_visible integer,
  units_not_sellable integer,
  defects jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason text,
  action text,
  image_quality text,
  issues_raised integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hygiene_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  area text,
  verdict text NOT NULL CHECK (verdict IN ('passed', 'failed', 'check_manually')),
  confidence numeric,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  image_quality text,
  issues_raised integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shelf_csv_checks_org_created_idx ON public.shelf_csv_checks (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fnv_checks_org_created_idx ON public.fnv_checks (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hygiene_checks_org_created_idx ON public.hygiene_checks (org_id, created_at DESC);

ALTER TABLE public.shelf_csv_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fnv_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hygiene_checks ENABLE ROW LEVEL SECURITY;

-- Same visibility as audits: admins see all, others see stores in their access or their own checks.
DROP POLICY IF EXISTS shelf_csv_checks_select ON public.shelf_csv_checks;
CREATE POLICY shelf_csv_checks_select ON public.shelf_csv_checks
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

DROP POLICY IF EXISTS fnv_checks_select ON public.fnv_checks;
CREATE POLICY fnv_checks_select ON public.fnv_checks
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

DROP POLICY IF EXISTS hygiene_checks_select ON public.hygiene_checks;
CREATE POLICY hygiene_checks_select ON public.hygiene_checks
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
GRANT SELECT ON public.shelf_csv_checks, public.fnv_checks, public.hygiene_checks TO authenticated;
GRANT ALL ON public.shelf_csv_checks, public.fnv_checks, public.hygiene_checks TO service_role;

ALTER TABLE public.findings DROP CONSTRAINT IF EXISTS findings_source_type_check;
ALTER TABLE public.findings ADD CONSTRAINT findings_source_type_check CHECK (
  source_type IN ('digital_variance', 'planogram_line', 'manual', 'ai_suggested', 'expiry_check', 'ai_alert', 'ai_row', 'checklist', 'display_check', 'rack_check', 'fnv_check', 'hygiene_check')
);
