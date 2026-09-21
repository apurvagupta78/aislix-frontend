-- FNV QC disposition fields on digital audit lines (visual QC from Astra).

ALTER TABLE public.digital_audit_lines
  ADD COLUMN IF NOT EXISTS qc_disposition text
    CHECK (qc_disposition IS NULL OR qc_disposition IN ('SELLABLE', 'DAMAGED', 'HUMAN_REVIEW')),
  ADD COLUMN IF NOT EXISTS qc_defect_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS qc_confidence numeric NULL,
  ADD COLUMN IF NOT EXISTS qc_notes text NULL,
  ADD COLUMN IF NOT EXISTS qc_analyzed_at timestamptz NULL;
