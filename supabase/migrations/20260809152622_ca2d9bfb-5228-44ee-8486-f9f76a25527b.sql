ALTER TABLE public.shelf_scans
  ADD COLUMN IF NOT EXISTS sub_category text,
  ADD COLUMN IF NOT EXISTS sub_category_label text,
  ADD COLUMN IF NOT EXISTS sub_category_custom text;