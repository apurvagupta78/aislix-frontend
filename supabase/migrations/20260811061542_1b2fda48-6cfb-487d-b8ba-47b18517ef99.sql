-- 1. Private replacements for the public helpers
CREATE OR REPLACE FUNCTION private.is_org_member_current(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION private.is_org_manager_current(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
      AND lower(om.role::text) IN ('owner', 'admin', 'manager')
  );
$$;

REVOKE ALL ON FUNCTION private.is_org_member_current(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_org_manager_current(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_org_member_current(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_org_manager_current(uuid) TO authenticated, service_role;

-- 2. Repoint policies to the private helpers
DROP POLICY IF EXISTS planogram_versions_select ON public.planogram_versions;
CREATE POLICY planogram_versions_select ON public.planogram_versions
  FOR SELECT TO authenticated USING (private.is_org_member_current(org_id));

DROP POLICY IF EXISTS planogram_versions_manage ON public.planogram_versions;
CREATE POLICY planogram_versions_manage ON public.planogram_versions
  FOR ALL TO authenticated
  USING (private.is_org_manager_current(org_id))
  WITH CHECK (private.is_org_manager_current(org_id));

DROP POLICY IF EXISTS planogram_items_select ON public.planogram_items;
CREATE POLICY planogram_items_select ON public.planogram_items
  FOR SELECT TO authenticated USING (private.is_org_member_current(org_id));

DROP POLICY IF EXISTS planogram_items_manage ON public.planogram_items;
CREATE POLICY planogram_items_manage ON public.planogram_items
  FOR ALL TO authenticated
  USING (private.is_org_manager_current(org_id))
  WITH CHECK (private.is_org_manager_current(org_id));

DROP POLICY IF EXISTS scan_assignments_manager ON public.scan_assignments;
CREATE POLICY scan_assignments_manager ON public.scan_assignments
  FOR ALL TO authenticated
  USING (private.is_org_manager_current(org_id))
  WITH CHECK (private.is_org_manager_current(org_id));

DROP POLICY IF EXISTS planogram_comparisons_select ON public.planogram_comparisons;
CREATE POLICY planogram_comparisons_select ON public.planogram_comparisons
  FOR SELECT TO authenticated USING (private.is_org_member_current(org_id));

DROP POLICY IF EXISTS planogram_comparisons_insert ON public.planogram_comparisons;
CREATE POLICY planogram_comparisons_insert ON public.planogram_comparisons
  FOR INSERT TO authenticated WITH CHECK (private.is_org_member_current(org_id));

DROP POLICY IF EXISTS planogram_comparison_lines_select ON public.planogram_comparison_lines;
CREATE POLICY planogram_comparison_lines_select ON public.planogram_comparison_lines
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.planogram_comparisons c
      WHERE c.id = planogram_comparison_lines.comparison_id
        AND private.is_org_member_current(c.org_id)
    )
  );

DROP POLICY IF EXISTS planogram_comparison_lines_insert ON public.planogram_comparison_lines;
CREATE POLICY planogram_comparison_lines_insert ON public.planogram_comparison_lines
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.planogram_comparisons c
      WHERE c.id = planogram_comparison_lines.comparison_id
        AND private.is_org_member_current(c.org_id)
    )
  );

DROP POLICY IF EXISTS corrective_actions_select ON public.corrective_actions;
CREATE POLICY corrective_actions_select ON public.corrective_actions
  FOR SELECT TO authenticated USING (private.is_org_member_current(org_id));

DROP POLICY IF EXISTS corrective_actions_insert ON public.corrective_actions;
CREATE POLICY corrective_actions_insert ON public.corrective_actions
  FOR INSERT TO authenticated WITH CHECK (private.is_org_member_current(org_id));

DROP POLICY IF EXISTS corrective_actions_update ON public.corrective_actions;
CREATE POLICY corrective_actions_update ON public.corrective_actions
  FOR UPDATE TO authenticated
  USING (private.is_org_member_current(org_id))
  WITH CHECK (private.is_org_member_current(org_id));

-- 3. Remove the publicly callable helpers from the exposed API schema
DROP FUNCTION IF EXISTS public.is_org_member(uuid);
DROP FUNCTION IF EXISTS public.is_org_manager(uuid);