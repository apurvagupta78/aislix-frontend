-- Rows without their own store/scan inherit visibility from the row they link to
-- (corrective action -> planogram comparison / finding, exception -> source row / assignment).

DROP POLICY IF EXISTS corrective_actions_select ON public.corrective_actions;
CREATE POLICY corrective_actions_select ON public.corrective_actions
  FOR SELECT TO authenticated
  USING (
    (public.is_org_member(org_id) AND (assigned_to = auth.uid() OR created_by = auth.uid()))
    OR CASE
      WHEN store_id IS NULL AND scan_id IS NULL AND (comparison_id IS NOT NULL OR finding_id IS NOT NULL) THEN
        public.is_org_member(org_id)
        AND (
          EXISTS (SELECT 1 FROM public.planogram_comparisons c WHERE c.id = comparison_id)
          OR EXISTS (SELECT 1 FROM public.findings f WHERE f.id = finding_id)
        )
      ELSE public.can_read_org_row(org_id, store_id, scan_id)
    END
  );

CREATE OR REPLACE FUNCTION public.can_read_audit_exception(
  p_org_id uuid,
  p_store_id uuid,
  p_scan_id uuid,
  p_assignment_id uuid,
  p_source_type text,
  p_source_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_store_id IS NOT NULL OR p_scan_id IS NOT NULL
      THEN public.can_read_org_row(p_org_id, p_store_id, p_scan_id)
    WHEN NOT public.is_org_member(p_org_id) THEN public.is_demo_org_readable(p_org_id)
    WHEN public.is_org_owner_or_admin(p_org_id) THEN true
    WHEN p_assignment_id IS NOT NULL
      THEN EXISTS (SELECT 1 FROM public.scan_assignments a WHERE a.id = p_assignment_id)
    WHEN p_source_type = 'corrective_action'
      THEN EXISTS (SELECT 1 FROM public.corrective_actions ca WHERE ca.id::text = p_source_id)
    WHEN p_source_type = 'finding'
      THEN EXISTS (SELECT 1 FROM public.findings f WHERE f.id::text = p_source_id)
    ELSE true
  END;
$$;

REVOKE ALL ON FUNCTION public.can_read_audit_exception(uuid, uuid, uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_audit_exception(uuid, uuid, uuid, uuid, text, text) TO authenticated, service_role;

DROP POLICY IF EXISTS audit_exceptions_select ON public.audit_exceptions;
CREATE POLICY audit_exceptions_select ON public.audit_exceptions
  FOR SELECT TO authenticated
  USING (public.can_read_audit_exception(org_id, store_id, scan_id, assignment_id, source_type, source_id));

DROP POLICY IF EXISTS audit_exceptions_update ON public.audit_exceptions;
CREATE POLICY audit_exceptions_update ON public.audit_exceptions
  FOR UPDATE TO authenticated
  USING (public.can_read_audit_exception(org_id, store_id, scan_id, assignment_id, source_type, source_id))
  WITH CHECK (public.is_org_member(org_id));
