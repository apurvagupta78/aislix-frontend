-- How the shelf photos were captured (guided sweep path, per-photo quality, device GPS).
ALTER TABLE public.shelf_scans ADD COLUMN IF NOT EXISTS capture_meta jsonb;

COMMENT ON COLUMN public.shelf_scans.capture_meta IS
  'Capture details from the client: mode (guided_sweep), per-photo sharpness/brightness, tracking gaps, GPS. Null for plain uploads.';
