ALTER TABLE public.scan_assignments
  DROP CONSTRAINT IF EXISTS scan_assignments_scope_type_check;

ALTER TABLE public.scan_assignments
  ADD CONSTRAINT scan_assignments_scope_type_check
  CHECK (scope_type IN ('category', 'sub_category', 'location', 'planogram'));