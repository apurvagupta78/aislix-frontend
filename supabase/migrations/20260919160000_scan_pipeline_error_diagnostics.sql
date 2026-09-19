-- Ops-only failure diagnostics for AI Audit pipeline.
-- Customer-facing error_message stays sanitized; these fields are for debug/admin.

ALTER TABLE public.shelf_scans
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS error_detail TEXT;

COMMENT ON COLUMN public.shelf_scans.error_code IS
  'Stable machine code for failed scans (vision_http_502, openai_timeout, etc.). Not shown to customers.';
COMMENT ON COLUMN public.shelf_scans.error_detail IS
  'Truncated internal failure detail for ops/debug. Not shown on the processing UI.';

CREATE INDEX IF NOT EXISTS idx_shelf_scans_error_code
  ON public.shelf_scans (error_code)
  WHERE error_code IS NOT NULL;
