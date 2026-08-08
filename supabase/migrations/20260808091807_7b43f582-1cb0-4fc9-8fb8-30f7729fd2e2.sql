CREATE TABLE public.learned_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text,
  category text,
  variant text,
  sku text,
  barcode text,
  expected_facings integer,
  avg_price_inr numeric,
  features_path text,
  times_seen integer NOT NULL DEFAULT 1,
  confidence numeric,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX learned_skus_org_identity_idx
  ON public.learned_skus (org_id, lower(brand), lower(name), lower(coalesce(variant, '')));
CREATE INDEX learned_skus_org_idx ON public.learned_skus (org_id);
CREATE INDEX learned_skus_barcode_idx ON public.learned_skus (org_id, barcode);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learned_skus TO authenticated;
GRANT ALL ON public.learned_skus TO service_role;

ALTER TABLE public.learned_skus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view learned skus"
  ON public.learned_skus FOR SELECT TO authenticated
  USING (private.is_org_member(org_id, auth.uid()));

CREATE POLICY "Managers can add learned skus"
  ON public.learned_skus FOR INSERT TO authenticated
  WITH CHECK (private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin','store_manager']::app_role[]));

CREATE POLICY "Managers can update learned skus"
  ON public.learned_skus FOR UPDATE TO authenticated
  USING (private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin','store_manager']::app_role[]))
  WITH CHECK (private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin','store_manager']::app_role[]));

CREATE POLICY "Admins can delete learned skus"
  ON public.learned_skus FOR DELETE TO authenticated
  USING (private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

CREATE TRIGGER learned_skus_updated_at
  BEFORE UPDATE ON public.learned_skus
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Org members can read catalog data"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'catalog-data' AND private.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));

CREATE POLICY "Org members can upload catalog data"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'catalog-data' AND private.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));

CREATE POLICY "Org members can update catalog data"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'catalog-data' AND private.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()))
  WITH CHECK (bucket_id = 'catalog-data' AND private.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));

CREATE POLICY "Org members can delete catalog data"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'catalog-data' AND private.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));