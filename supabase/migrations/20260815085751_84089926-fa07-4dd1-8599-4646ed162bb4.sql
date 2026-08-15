CREATE TABLE IF NOT EXISTS public.scan_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scan_id text NOT NULL,
  x1 int, y1 int, x2 int, y2 int,
  corrected_brand text,
  corrected_product text,
  corrected_variant text,
  corrected_ocr_label text,
  predicted_brand text,
  predicted_product text,
  pack_text text,
  category text,
  sub_category text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scan_corrections_org_idx ON public.scan_corrections (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scan_corrections_scan_idx ON public.scan_corrections (scan_id);

GRANT SELECT, INSERT, DELETE ON public.scan_corrections TO authenticated;
GRANT ALL ON public.scan_corrections TO service_role;

ALTER TABLE public.scan_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org corrections"
ON public.scan_corrections FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.org_id = scan_corrections.org_id
    AND om.user_id = auth.uid()
    AND om.status = 'active'
));

CREATE POLICY "Members can add corrections"
ON public.scan_corrections FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = scan_corrections.org_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
  )
);

CREATE POLICY "Admins can delete corrections"
ON public.scan_corrections FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.org_id = scan_corrections.org_id
    AND om.user_id = auth.uid()
    AND om.status = 'active'
    AND om.role IN ('owner'::app_role, 'admin'::app_role)
));