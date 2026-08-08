ALTER TABLE public.learned_skus
  ADD COLUMN IF NOT EXISTS embedding jsonb,
  ADD COLUMN IF NOT EXISTS source_scan_id uuid REFERENCES public.shelf_scans(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS learned_skus_org_sku_key
  ON public.learned_skus (org_id, sku)
  WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS learned_skus_source_scan_idx
  ON public.learned_skus (source_scan_id);