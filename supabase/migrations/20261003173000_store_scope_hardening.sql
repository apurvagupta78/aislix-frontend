-- Store-scoped reads for audit data, and lock down privileged functions.
--
-- Rule: owner/admin see the whole org. Everyone else sees rows for stores in
-- effective_store_ids(), scans they created/finalized/were assigned, and
-- org-level rows that belong to no store or scan. Demo org stays readable.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_read_scan(p_scan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shelf_scans s
    WHERE s.id = p_scan_id
      AND CASE
        WHEN public.is_demo_org_readable(s.org_id) THEN true
        WHEN NOT public.is_org_member(s.org_id) THEN false
        WHEN public.is_org_owner_or_admin(s.org_id) THEN true
        WHEN s.created_by = auth.uid() OR s.finalized_by = auth.uid() THEN true
        WHEN s.store_id IS NOT NULL
          AND s.store_id = ANY (public.effective_store_ids(s.org_id, auth.uid())) THEN true
        ELSE EXISTS (
          SELECT 1 FROM public.scan_assignments sa
          WHERE sa.id = s.assignment_id
            AND (sa.assignee_id = auth.uid() OR sa.assigner_id = auth.uid())
        )
      END
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_org_row(p_org_id uuid, p_store_id uuid, p_scan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_org_id IS NULL THEN false
    WHEN public.is_demo_org_readable(p_org_id) THEN true
    WHEN NOT public.is_org_member(p_org_id) THEN false
    WHEN public.is_org_owner_or_admin(p_org_id) THEN true
    WHEN p_scan_id IS NOT NULL AND public.can_read_scan(p_scan_id) THEN true
    WHEN p_store_id IS NOT NULL
      THEN p_store_id = ANY (public.effective_store_ids(p_org_id, auth.uid()))
    ELSE p_scan_id IS NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.can_read_scan(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_org_row(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_scan(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_org_row(uuid, uuid, uuid) TO authenticated, service_role;

-- effective_store_ids: callers may only resolve their own scope unless they are org owner/admin.
CREATE OR REPLACE FUNCTION public.effective_store_ids(p_org_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS uuid[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role TEXT;
  v_status TEXT;
  v_direct UUID[];
  v_result UUID[];
BEGIN
  IF p_org_id IS NULL OR p_user_id IS NULL THEN
    RETURN '{}';
  END IF;

  IF auth.uid() IS NOT NULL
     AND p_user_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_org_owner_or_admin(p_org_id) THEN
    RETURN '{}';
  END IF;

  SELECT role::text, status::text, COALESCE(store_ids, '{}'::uuid[])
  INTO v_role, v_status, v_direct
  FROM public.organization_members
  WHERE org_id = p_org_id AND user_id = p_user_id
  LIMIT 1;

  IF v_status IS DISTINCT FROM 'active' THEN
    RETURN '{}';
  END IF;

  IF v_role IN ('owner', 'admin') THEN
    SELECT COALESCE(array_agg(s.id), '{}'::uuid[])
    INTO v_result
    FROM public.stores s
    WHERE s.org_id = p_org_id AND s.status = 'active';
    RETURN COALESCE(v_result, '{}'::uuid[]);
  END IF;

  WITH RECURSIVE descendants AS (
    SELECT om.user_id
    FROM public.organization_members om
    WHERE om.org_id = p_org_id
      AND om.reports_to_user_id = p_user_id
      AND om.status = 'active'
    UNION
    SELECT child.user_id
    FROM public.organization_members child
    JOIN descendants d ON child.reports_to_user_id = d.user_id
    WHERE child.org_id = p_org_id
      AND child.status = 'active'
  ),
  scoped AS (
    SELECT UNNEST(COALESCE(v_direct, '{}'::uuid[])) AS store_id
    UNION
    SELECT UNNEST(COALESCE(m.store_ids, '{}'::uuid[])) AS store_id
    FROM public.organization_members m
    WHERE m.org_id = p_org_id
      AND m.user_id IN (SELECT user_id FROM descendants)
    UNION
    SELECT sa.store_id
    FROM public.scan_assignments sa
    WHERE sa.org_id = p_org_id
      AND sa.store_id IS NOT NULL
      AND (sa.assignee_id = p_user_id OR sa.assigner_id = p_user_id)
  )
  SELECT COALESCE(array_agg(DISTINCT s.id), '{}'::uuid[])
  INTO v_result
  FROM public.stores s
  JOIN scoped sc ON sc.store_id = s.id
  WHERE s.org_id = p_org_id
    AND s.status = 'active';

  RETURN COALESCE(v_result, '{}'::uuid[]);
END;
$function$;

-- ---------------------------------------------------------------------------
-- Scan children: visible when the parent scan is visible
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS scan_results_select ON public.scan_results;
CREATE POLICY scan_results_select ON public.scan_results
  FOR SELECT TO authenticated USING (public.can_read_scan(scan_id));

DROP POLICY IF EXISTS detected_products_select ON public.detected_products;
CREATE POLICY detected_products_select ON public.detected_products
  FOR SELECT TO authenticated USING (public.can_read_scan(scan_id));

DROP POLICY IF EXISTS scan_images_select ON public.scan_images;
CREATE POLICY scan_images_select ON public.scan_images
  FOR SELECT TO authenticated USING (public.can_read_scan(scan_id));

DROP POLICY IF EXISTS "Members can view org corrections" ON public.scan_corrections;
-- scan_corrections.scan_id is text; non-uuid ids resolve to a scan that never exists.
DROP POLICY IF EXISTS scan_corrections_select ON public.scan_corrections;
CREATE POLICY scan_corrections_select ON public.scan_corrections
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.can_read_org_row(
      org_id,
      NULL,
      CASE
        WHEN scan_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN scan_id::uuid
        ELSE '00000000-0000-0000-0000-000000000000'::uuid
      END
    )
  );

DROP POLICY IF EXISTS scan_field_verifications_select ON public.scan_field_verifications;
DROP POLICY IF EXISTS scan_field_verifications_write ON public.scan_field_verifications;
CREATE POLICY scan_field_verifications_select ON public.scan_field_verifications
  FOR SELECT TO authenticated USING (public.can_read_org_row(org_id, NULL, scan_id));
DROP POLICY IF EXISTS scan_field_verifications_insert ON public.scan_field_verifications;
CREATE POLICY scan_field_verifications_insert ON public.scan_field_verifications
  FOR INSERT TO authenticated WITH CHECK (public.can_read_org_row(org_id, NULL, scan_id));
DROP POLICY IF EXISTS scan_field_verifications_update ON public.scan_field_verifications;
CREATE POLICY scan_field_verifications_update ON public.scan_field_verifications
  FOR UPDATE TO authenticated
  USING (public.can_read_org_row(org_id, NULL, scan_id))
  WITH CHECK (public.can_read_org_row(org_id, NULL, scan_id));
DROP POLICY IF EXISTS scan_field_verifications_delete ON public.scan_field_verifications;
CREATE POLICY scan_field_verifications_delete ON public.scan_field_verifications
  FOR DELETE TO authenticated USING (public.can_read_org_row(org_id, NULL, scan_id));

DROP POLICY IF EXISTS audit_evidence_select ON public.audit_evidence;
CREATE POLICY audit_evidence_select ON public.audit_evidence
  FOR SELECT TO authenticated USING (public.can_read_org_row(org_id, NULL, scan_id));

DROP POLICY IF EXISTS audit_responses_select ON public.audit_responses;
CREATE POLICY audit_responses_select ON public.audit_responses
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.can_read_org_row(org_id, NULL, scan_id));

DROP POLICY IF EXISTS audit_approvals_select ON public.audit_approvals;
CREATE POLICY audit_approvals_select ON public.audit_approvals
  FOR SELECT TO authenticated USING (public.can_read_org_row(org_id, NULL, scan_id));

DROP POLICY IF EXISTS execution_actions_select ON public.execution_actions;
CREATE POLICY execution_actions_select ON public.execution_actions
  FOR SELECT TO authenticated USING (public.can_read_org_row(org_id, NULL, scan_id));

DROP POLICY IF EXISTS audit_activity_select ON public.audit_activity_events;
CREATE POLICY audit_activity_select ON public.audit_activity_events
  FOR SELECT TO authenticated USING (public.can_read_org_row(org_id, NULL, scan_id));

-- ---------------------------------------------------------------------------
-- Store-level rows
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS findings_select ON public.findings;
CREATE POLICY findings_select ON public.findings
  FOR SELECT TO authenticated
  USING (
    (public.is_org_member(org_id) AND (assigned_to = auth.uid() OR created_by = auth.uid()))
    OR public.can_read_org_row(org_id, store_id, scan_id)
  );

DROP POLICY IF EXISTS corrective_actions_select ON public.corrective_actions;
CREATE POLICY corrective_actions_select ON public.corrective_actions
  FOR SELECT TO authenticated
  USING (
    (public.is_org_member(org_id) AND (assigned_to = auth.uid() OR created_by = auth.uid()))
    OR public.can_read_org_row(org_id, store_id, scan_id)
  );

DROP POLICY IF EXISTS digital_audit_lines_select ON public.digital_audit_lines;
CREATE POLICY digital_audit_lines_select ON public.digital_audit_lines
  FOR SELECT TO authenticated USING (public.can_read_org_row(org_id, store_id, scan_id));

DROP POLICY IF EXISTS execution_opportunities_select ON public.execution_opportunities;
CREATE POLICY execution_opportunities_select ON public.execution_opportunities
  FOR SELECT TO authenticated USING (public.can_read_org_row(org_id, store_id, scan_id));

DROP POLICY IF EXISTS planogram_comparisons_select ON public.planogram_comparisons;
CREATE POLICY planogram_comparisons_select ON public.planogram_comparisons
  FOR SELECT TO authenticated USING (public.can_read_org_row(org_id, store_id, scan_id));

DROP POLICY IF EXISTS planogram_comparison_lines_select ON public.planogram_comparison_lines;
CREATE POLICY planogram_comparison_lines_select ON public.planogram_comparison_lines
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.planogram_comparisons c WHERE c.id = comparison_id));

DROP POLICY IF EXISTS analytics_select_members ON public.shelf_analytics;
CREATE POLICY analytics_select_members ON public.shelf_analytics
  FOR SELECT TO authenticated USING (public.can_read_org_row(org_id, store_id, NULL));

-- audit_exceptions: FOR ALL policies also granted org-wide reads.
DROP POLICY IF EXISTS audit_exceptions_org_select ON public.audit_exceptions;
DROP POLICY IF EXISTS audit_exceptions_org_write ON public.audit_exceptions;
DROP POLICY IF EXISTS audit_exceptions_select ON public.audit_exceptions;
DROP POLICY IF EXISTS audit_exceptions_write ON public.audit_exceptions;
CREATE POLICY audit_exceptions_select ON public.audit_exceptions
  FOR SELECT TO authenticated USING (public.can_read_org_row(org_id, store_id, scan_id));
DROP POLICY IF EXISTS audit_exceptions_insert ON public.audit_exceptions;
CREATE POLICY audit_exceptions_insert ON public.audit_exceptions
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS audit_exceptions_update ON public.audit_exceptions;
CREATE POLICY audit_exceptions_update ON public.audit_exceptions
  FOR UPDATE TO authenticated
  USING (public.can_read_org_row(org_id, store_id, scan_id))
  WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS audit_exceptions_delete ON public.audit_exceptions;
CREATE POLICY audit_exceptions_delete ON public.audit_exceptions
  FOR DELETE TO authenticated USING (public.is_org_manager(org_id));

-- resolution_evidence follows its finding.
DROP POLICY IF EXISTS resolution_evidence_select ON public.resolution_evidence;
DROP POLICY IF EXISTS resolution_evidence_write ON public.resolution_evidence;
CREATE POLICY resolution_evidence_select ON public.resolution_evidence
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(org_id)
    AND (finding_id IS NULL OR EXISTS (SELECT 1 FROM public.findings f WHERE f.id = finding_id))
  );
DROP POLICY IF EXISTS resolution_evidence_insert ON public.resolution_evidence;
CREATE POLICY resolution_evidence_insert ON public.resolution_evidence
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS resolution_evidence_update ON public.resolution_evidence;
CREATE POLICY resolution_evidence_update ON public.resolution_evidence
  FOR UPDATE TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS resolution_evidence_delete ON public.resolution_evidence;
CREATE POLICY resolution_evidence_delete ON public.resolution_evidence
  FOR DELETE TO authenticated USING (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Privileged functions
-- ---------------------------------------------------------------------------

-- Demo/bootstrap seeders: service role only.
REVOKE EXECUTE ON FUNCTION public.seed_demo_completed_audit(uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_aislix_demo_environment(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_demo_people_hierarchy() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_hierarchy_profiles_bootstrap(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_completed_audit(uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_aislix_demo_environment(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_demo_people_hierarchy() TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_hierarchy_profiles_bootstrap(uuid) TO service_role;

-- Signed-in only (never anonymous).
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.can_org_add_master_setup(uuid)',
    'public.count_org_master_setups(uuid)',
    'public.direct_store_ids(uuid, uuid)',
    'public.effective_store_ids(uuid, uuid)',
    'public.inherited_store_ids(uuid, uuid)',
    'public.is_demo_org_readable(uuid)',
    'public.org_has_real_audit_activity(uuid)',
    'public.process_assignment_reminders(integer)',
    'public.process_due_audit_schedules(integer)',
    'public.resolve_hierarchy_assignees(uuid, uuid, uuid, text)',
    'public.resolve_hierarchy_outlet_stores(uuid, uuid, uuid)',
    'public.share_audit_template_with_org(uuid)',
    'public.update_assignment_grid_row(uuid, uuid, timestamptz, text, text)',
    'public.user_can_access_store(uuid, uuid, uuid)',
    'public.validate_audit_completion(uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;
