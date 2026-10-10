-- AI planogram generator: AI-suggested shelf layouts, approved into store planograms, plus one
-- shelf-space record (with a QR token) per location so staff can scan a label and see what belongs there.

ALTER TABLE public.planogram_versions DROP CONSTRAINT IF EXISTS planogram_versions_source_type_check;
ALTER TABLE public.planogram_versions
  ADD CONSTRAINT planogram_versions_source_type_check CHECK (source_type IN ('csv', 'manual', 'mixed', 'ai'));

CREATE TABLE IF NOT EXISTS public.planogram_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  store_type text,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  photo_paths text[] NOT NULL DEFAULT '{}',
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  planogram_version_ids uuid[] NOT NULL DEFAULT '{}',
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planogram_generations_org_created_idx
  ON public.planogram_generations (org_id, created_at DESC);

ALTER TABLE public.planogram_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS planogram_generations_select ON public.planogram_generations;
CREATE POLICY planogram_generations_select ON public.planogram_generations
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT my_member_org_ids())
    AND (is_org_owner_or_admin(org_id) OR store_id IN (SELECT my_readable_store_ids()))
  );

-- Members edit the suggested layout while it is a draft; approval happens server-side.
DROP POLICY IF EXISTS planogram_generations_update_draft ON public.planogram_generations;
CREATE POLICY planogram_generations_update_draft ON public.planogram_generations
  FOR UPDATE TO authenticated
  USING (
    status = 'draft'
    AND org_id IN (SELECT my_member_org_ids())
    AND (is_org_owner_or_admin(org_id) OR store_id IN (SELECT my_readable_store_ids()))
  )
  WITH CHECK (
    status = 'draft'
    AND org_id IN (SELECT my_member_org_ids())
    AND (is_org_owner_or_admin(org_id) OR store_id IN (SELECT my_readable_store_ids()))
  );

CREATE TABLE IF NOT EXISTS public.shelf_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  generation_id uuid NOT NULL REFERENCES public.planogram_generations(id) ON DELETE CASCADE,
  planogram_version_id uuid REFERENCES public.planogram_versions(id) ON DELETE SET NULL,
  location_code text NOT NULL,
  rack_number int NOT NULL,
  shelf_number int NOT NULL,
  space_number int NOT NULL,
  physical_position text NOT NULL,
  products jsonb NOT NULL DEFAULT '[]'::jsonb,
  instructions text,
  qr_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'replaced')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shelf_spaces_active_location_idx
  ON public.shelf_spaces (store_id, location_code) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS shelf_spaces_generation_idx ON public.shelf_spaces (generation_id);

ALTER TABLE public.shelf_spaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shelf_spaces_select ON public.shelf_spaces;
CREATE POLICY shelf_spaces_select ON public.shelf_spaces
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT my_member_org_ids())
    AND (is_org_owner_or_admin(org_id) OR store_id IN (SELECT my_readable_store_ids()))
  );
