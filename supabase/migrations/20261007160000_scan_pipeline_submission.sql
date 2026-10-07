-- Records when an AI scan was handed to the vision backend so a reopened or
-- resumed scan polls the existing job instead of submitting a second one.
alter table public.shelf_scans
  add column if not exists pipeline_submitted_at timestamptz,
  add column if not exists pipeline_job_id text;
