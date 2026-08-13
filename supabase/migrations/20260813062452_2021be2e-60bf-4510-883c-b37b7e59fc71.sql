ALTER TABLE public.planogram_items ADD COLUMN IF NOT EXISTS variant text;

UPDATE public.planogram_items
SET location = COALESCE(NULLIF(btrim(location), ''), NULLIF(btrim(COALESCE(aisle, '')), ''), 'UNSPECIFIED')
WHERE location IS NULL OR btrim(location) = '';

UPDATE public.planogram_items
SET sub_category = 'General'
WHERE sub_category IS NULL OR btrim(sub_category) = '';

ALTER TABLE public.planogram_items ALTER COLUMN location SET NOT NULL;
ALTER TABLE public.planogram_items ALTER COLUMN sub_category SET NOT NULL;

ALTER TABLE public.shelf_scans ADD COLUMN IF NOT EXISTS adhoc_planogram jsonb;