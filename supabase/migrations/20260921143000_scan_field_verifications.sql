-- Human verification of AI numeric fields (facings / visible units).
-- Preserves immutable AI values; verified values used for downstream calc when present.

CREATE TABLE IF NOT EXISTS public.scan_field_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL REFERENCES public.shelf_scans(id) ON DELETE CASCADE,
  detected_product_id uuid NULL REFERENCES public.detected_products(id) ON DELETE CASCADE,
  field_key text NOT NULL CHECK (field_key IN ('facings', 'visible_units')),
  ai_value numeric NULL,
  verified_value numeric NULL,
  verified_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scan_id, detected_product_id, field_key)
);

CREATE INDEX IF NOT EXISTS scan_field_verifications_scan_id_idx
  ON public.scan_field_verifications (scan_id);

CREATE INDEX IF NOT EXISTS scan_field_verifications_org_id_idx
  ON public.scan_field_verifications (org_id);

ALTER TABLE public.scan_field_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scan_field_verifications_select ON public.scan_field_verifications;
CREATE POLICY scan_field_verifications_select ON public.scan_field_verifications
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS scan_field_verifications_write ON public.scan_field_verifications;
CREATE POLICY scan_field_verifications_write ON public.scan_field_verifications
  FOR ALL TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_field_verifications TO authenticated;
GRANT ALL ON public.scan_field_verifications TO service_role;
