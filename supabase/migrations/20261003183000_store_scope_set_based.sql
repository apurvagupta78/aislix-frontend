-- Same access rules as 20261003173000/20261003180000, but each policy checks
-- membership in a set computed once per query instead of calling per-row helpers.

CREATE OR REPLACE FUNCTION public.my_full_access_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT om.org_id
  FROM public.organization_members om
  WHERE om.user_id = auth.uid()
    AND om.status = 'active'
    AND lower(om.role::text) IN ('owner', 'admin')
  UNION
  SELECT o.id
  FROM public.organizations o
  WHERE o.id = public.aislix_demo_org_id() AND o.is_demo = true;
$$;

CREATE OR REPLACE FUNCTION public.my_member_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT om.org_id
  FROM public.organization_members om
  WHERE om.user_id = auth.uid() AND om.status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.my_readable_store_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id
  FROM public.stores s
  WHERE s.org_id IN (SELECT public.my_full_access_org_ids())
  UNION
  SELECT unnest(public.effective_store_ids(om.org_id, auth.uid()))
  FROM public.organization_members om
  WHERE om.user_id = auth.uid()
    AND om.status = 'active'
    AND lower(om.role::text) NOT IN ('owner', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.my_readable_scan_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id
  FROM public.shelf_scans s
  WHERE s.org_id IN (SELECT public.my_full_access_org_ids())
  UNION
  SELECT s.id
  FROM public.shelf_scans s
  WHERE s.org_id IN (SELECT public.my_member_org_ids())
    AND (
      s.created_by = auth.uid()
      OR s.finalized_by = auth.uid()
      OR s.store_id IN (SELECT public.my_readable_store_ids())
      OR EXISTS (
        SELECT 1 FROM public.scan_assignments sa
        WHERE sa.id = s.assignment_id
          AND (sa.assignee_id = auth.uid() OR sa.assigner_id = auth.uid())
      )
    );
$$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.my_full_access_org_ids()',
    'public.my_member_org_ids()',
    'public.my_readable_store_ids()',
    'public.my_readable_scan_ids()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Scan children
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS scan_results_select ON public.scan_results;
CREATE POLICY scan_results_select ON public.scan_results
  FOR SELECT TO authenticated USING (scan_id IN (SELECT public.my_readable_scan_ids()));

DROP POLICY IF EXISTS detected_products_select ON public.detected_products;
CREATE POLICY detected_products_select ON public.detected_products
  FOR SELECT TO authenticated USING (scan_id IN (SELECT public.my_readable_scan_ids()));

DROP POLICY IF EXISTS scan_images_select ON public.scan_images;
CREATE POLICY scan_images_select ON public.scan_images
  FOR SELECT TO authenticated USING (scan_id IN (SELECT public.my_readable_scan_ids()));

-- ---------------------------------------------------------------------------
-- Org rows keyed by scan only (no store column)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS scan_corrections_select ON public.scan_corrections;
CREATE POLICY scan_corrections_select ON public.scan_corrections
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id IN (SELECT public.my_full_access_org_ids())
    OR (
      org_id IN (SELECT public.my_member_org_ids())
      AND (scan_id IS NULL OR scan_id IN (SELECT x::text FROM public.my_readable_scan_ids() x))
    )
  );

DROP POLICY IF EXISTS scan_field_verifications_select ON public.scan_field_verifications;
DROP POLICY IF EXISTS scan_field_verifications_insert ON public.scan_field_verifications;
DROP POLICY IF EXISTS scan_field_verifications_update ON public.scan_field_verifications;
DROP POLICY IF EXISTS scan_field_verifications_delete ON public.scan_field_verifications;
CREATE POLICY scan_field_verifications_select ON public.scan_field_verifications
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.my_full_access_org_ids())
    OR (org_id IN (SELECT public.my_member_org_ids())
        AND (scan_id IS NULL OR scan_id IN (SELECT public.my_readable_scan_ids())))
  );
CREATE POLICY scan_field_verifications_insert ON public.scan_field_verifications
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT public.my_member_org_ids())
    AND (scan_id IS NULL OR scan_id IN (SELECT public.my_readable_scan_ids()))
  );
CREATE POLICY scan_field_verifications_update ON public.scan_field_verifications
  FOR UPDATE TO authenticated
  USING (
    org_id IN (SELECT public.my_member_org_ids())
    AND (scan_id IS NULL OR scan_id IN (SELECT public.my_readable_scan_ids()))
  )
  WITH CHECK (
    org_id IN (SELECT public.my_member_org_ids())
    AND (scan_id IS NULL OR scan_id IN (SELECT public.my_readable_scan_ids()))
  );
CREATE POLICY scan_field_verifications_delete ON public.scan_field_verifications
  FOR DELETE TO authenticated
  USING (
    org_id IN (SELECT public.my_member_org_ids())
    AND (scan_id IS NULL OR scan_id IN (SELECT public.my_readable_scan_ids()))
  );

DROP POLICY IF EXISTS audit_evidence_select ON public.audit_evidence;
CREATE POLICY audit_evidence_select ON public.audit_evidence
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.my_full_access_org_ids())
    OR (org_id IN (SELECT public.my_member_org_ids())
        AND (scan_id IS NULL OR scan_id IN (SELECT public.my_readable_scan_ids())))
  );

DROP POLICY IF EXISTS audit_responses_select ON public.audit_responses;
CREATE POLICY audit_responses_select ON public.audit_responses
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id IN (SELECT public.my_full_access_org_ids())
    OR (org_id IN (SELECT public.my_member_org_ids())
        AND (scan_id IS NULL OR scan_id IN (SELECT public.my_readable_scan_ids())))
  );

DROP POLICY IF EXISTS audit_approvals_select ON public.audit_approvals;
CREATE POLICY audit_approvals_select ON public.audit_approvals
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.my_full_access_org_ids())
    OR (org_id IN (SELECT public.my_member_org_ids())
        AND (scan_id IS NULL OR scan_id IN (SELECT public.my_readable_scan_ids())))
  );

DROP POLICY IF EXISTS execution_actions_select ON public.execution_actions;
CREATE POLICY execution_actions_select ON public.execution_actions
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.my_full_access_org_ids())
    OR (org_id IN (SELECT public.my_member_org_ids())
        AND (scan_id IS NULL OR scan_id IN (SELECT public.my_readable_scan_ids())))
  );

DROP POLICY IF EXISTS audit_activity_select ON public.audit_activity_events;
CREATE POLICY audit_activity_select ON public.audit_activity_events
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.my_full_access_org_ids())
    OR (org_id IN (SELECT public.my_member_org_ids())
        AND (scan_id IS NULL OR scan_id IN (SELECT public.my_readable_scan_ids())))
  );

-- ---------------------------------------------------------------------------
-- Org rows keyed by store and scan
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS findings_select ON public.findings;
CREATE POLICY findings_select ON public.findings
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.my_full_access_org_ids())
    OR (
      org_id IN (SELECT public.my_member_org_ids())
      AND (
        assigned_to = auth.uid()
        OR created_by = auth.uid()
        OR (scan_id IS NOT NULL AND scan_id IN (SELECT public.my_readable_scan_ids()))
        OR (store_id IS NOT NULL AND store_id IN (SELECT public.my_readable_store_ids()))
        OR (store_id IS NULL AND scan_id IS NULL)
      )
    )
  );

DROP POLICY IF EXISTS planogram_comparisons_select ON public.planogram_comparisons;
CREATE POLICY planogram_comparisons_select ON public.planogram_comparisons
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.my_full_access_org_ids())
    OR (
      org_id IN (SELECT public.my_member_org_ids())
      AND (
        (scan_id IS NOT NULL AND scan_id IN (SELECT public.my_readable_scan_ids()))
        OR (store_id IS NOT NULL AND store_id IN (SELECT public.my_readable_store_ids()))
        OR (store_id IS NULL AND scan_id IS NULL)
      )
    )
  );

DROP POLICY IF EXISTS planogram_comparison_lines_select ON public.planogram_comparison_lines;
CREATE POLICY planogram_comparison_lines_select ON public.planogram_comparison_lines
  FOR SELECT TO authenticated
  USING (comparison_id IN (SELECT c.id FROM public.planogram_comparisons c));

DROP POLICY IF EXISTS corrective_actions_select ON public.corrective_actions;
CREATE POLICY corrective_actions_select ON public.corrective_actions
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.my_full_access_org_ids())
    OR (
      org_id IN (SELECT public.my_member_org_ids())
      AND (
        assigned_to = auth.uid()
        OR created_by = auth.uid()
        OR (scan_id IS NOT NULL AND scan_id IN (SELECT public.my_readable_scan_ids()))
        OR (store_id IS NOT NULL AND store_id IN (SELECT public.my_readable_store_ids()))
        OR (
          store_id IS NULL AND scan_id IS NULL
          AND (
            (comparison_id IS NULL AND finding_id IS NULL)
            OR comparison_id IN (SELECT c.id FROM public.planogram_comparisons c)
            OR finding_id IN (SELECT f.id FROM public.findings f)
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS digital_audit_lines_select ON public.digital_audit_lines;
CREATE POLICY digital_audit_lines_select ON public.digital_audit_lines
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.my_full_access_org_ids())
    OR (
      org_id IN (SELECT public.my_member_org_ids())
      AND (
        (scan_id IS NOT NULL AND scan_id IN (SELECT public.my_readable_scan_ids()))
        OR (store_id IS NOT NULL AND store_id IN (SELECT public.my_readable_store_ids()))
        OR (store_id IS NULL AND scan_id IS NULL)
      )
    )
  );

DROP POLICY IF EXISTS execution_opportunities_select ON public.execution_opportunities;
CREATE POLICY execution_opportunities_select ON public.execution_opportunities
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.my_full_access_org_ids())
    OR (
      org_id IN (SELECT public.my_member_org_ids())
      AND (
        (scan_id IS NOT NULL AND scan_id IN (SELECT public.my_readable_scan_ids()))
        OR (store_id IS NOT NULL AND store_id IN (SELECT public.my_readable_store_ids()))
        OR (store_id IS NULL AND scan_id IS NULL)
      )
    )
  );

DROP POLICY IF EXISTS analytics_select_members ON public.shelf_analytics;
CREATE POLICY analytics_select_members ON public.shelf_analytics
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.my_full_access_org_ids())
    OR (org_id IN (SELECT public.my_member_org_ids())
        AND (store_id IS NULL OR store_id IN (SELECT public.my_readable_store_ids())))
  );

DROP POLICY IF EXISTS audit_exceptions_select ON public.audit_exceptions;
DROP POLICY IF EXISTS audit_exceptions_update ON public.audit_exceptions;
CREATE POLICY audit_exceptions_select ON public.audit_exceptions
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.my_full_access_org_ids())
    OR (
      org_id IN (SELECT public.my_member_org_ids())
      AND (
        (scan_id IS NOT NULL AND scan_id IN (SELECT public.my_readable_scan_ids()))
        OR (store_id IS NOT NULL AND store_id IN (SELECT public.my_readable_store_ids()))
        OR (
          store_id IS NULL AND scan_id IS NULL
          AND CASE
            WHEN assignment_id IS NOT NULL
              THEN assignment_id IN (SELECT a.id FROM public.scan_assignments a)
            WHEN source_type = 'corrective_action'
              THEN source_id IN (SELECT ca.id::text FROM public.corrective_actions ca)
            WHEN source_type = 'finding'
              THEN source_id IN (SELECT f.id::text FROM public.findings f)
            ELSE true
          END
        )
      )
    )
  );
CREATE POLICY audit_exceptions_update ON public.audit_exceptions
  FOR UPDATE TO authenticated
  USING (
    org_id IN (SELECT public.my_full_access_org_ids())
    OR (
      org_id IN (SELECT public.my_member_org_ids())
      AND (
        (scan_id IS NOT NULL AND scan_id IN (SELECT public.my_readable_scan_ids()))
        OR (store_id IS NOT NULL AND store_id IN (SELECT public.my_readable_store_ids()))
        OR (
          store_id IS NULL AND scan_id IS NULL
          AND CASE
            WHEN assignment_id IS NOT NULL
              THEN assignment_id IN (SELECT a.id FROM public.scan_assignments a)
            WHEN source_type = 'corrective_action'
              THEN source_id IN (SELECT ca.id::text FROM public.corrective_actions ca)
            WHEN source_type = 'finding'
              THEN source_id IN (SELECT f.id::text FROM public.findings f)
            ELSE true
          END
        )
      )
    )
  )
  WITH CHECK (org_id IN (SELECT public.my_member_org_ids()));

DROP POLICY IF EXISTS resolution_evidence_select ON public.resolution_evidence;
CREATE POLICY resolution_evidence_select ON public.resolution_evidence
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.my_member_org_ids())
    AND (finding_id IS NULL OR finding_id IN (SELECT f.id FROM public.findings f))
  );

DROP FUNCTION IF EXISTS public.can_read_audit_exception(uuid, uuid, uuid, uuid, text, text);
