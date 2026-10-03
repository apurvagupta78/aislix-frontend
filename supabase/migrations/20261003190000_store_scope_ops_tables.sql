-- Store scope for share links, assignments, schedules, planograms and Ask Aislix logs.
-- Managers and store managers are limited to their effective stores; owner/admin stay org-wide.

-- Share links/events: only for scans the caller can read (tokens open a public report).
DROP POLICY IF EXISTS scan_share_links_manage ON public.scan_share_links;
CREATE POLICY scan_share_links_manage ON public.scan_share_links
  FOR ALL TO authenticated
  USING (
    org_id IN (SELECT public.my_member_org_ids())
    AND scan_id IN (SELECT public.my_readable_scan_ids())
  )
  WITH CHECK (
    org_id IN (SELECT public.my_member_org_ids())
    AND scan_id IN (SELECT public.my_readable_scan_ids())
  );

DROP POLICY IF EXISTS scan_share_events_select ON public.scan_share_events;
DROP POLICY IF EXISTS scan_share_events_insert ON public.scan_share_events;
CREATE POLICY scan_share_events_select ON public.scan_share_events
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.my_member_org_ids())
    AND (created_by = auth.uid() OR scan_id IN (SELECT public.my_readable_scan_ids()))
  );
CREATE POLICY scan_share_events_insert ON public.scan_share_events
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT public.my_member_org_ids())
    AND scan_id IN (SELECT public.my_readable_scan_ids())
  );

-- Assignments: managers see/manage assignments for their stores (assignee/assigner policies unchanged).
DROP POLICY IF EXISTS scan_assignments_manager ON public.scan_assignments;
CREATE POLICY scan_assignments_manager ON public.scan_assignments
  FOR ALL TO authenticated
  USING (
    private.is_org_manager_current(org_id)
    AND (
      public.is_org_owner_or_admin(org_id)
      OR store_id IS NULL
      OR store_id IN (SELECT public.my_readable_store_ids())
    )
  )
  WITH CHECK (
    private.is_org_manager_current(org_id)
    AND (
      public.is_org_owner_or_admin(org_id)
      OR store_id IS NULL
      OR store_id IN (SELECT public.my_readable_store_ids())
    )
  );

-- Schedules
DROP POLICY IF EXISTS audit_schedules_select ON public.audit_schedules;
DROP POLICY IF EXISTS audit_schedules_insert ON public.audit_schedules;
DROP POLICY IF EXISTS audit_schedules_update ON public.audit_schedules;
DROP POLICY IF EXISTS audit_schedules_delete ON public.audit_schedules;
CREATE POLICY audit_schedules_select ON public.audit_schedules
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.my_full_access_org_ids())
    OR (
      org_id IN (SELECT public.my_member_org_ids())
      AND (
        created_by = auth.uid()
        OR assignee_id = auth.uid()
        OR reviewer_id = auth.uid()
        OR auth.uid() = ANY (COALESCE(assignee_ids, '{}'::uuid[]))
        OR (store_id IS NULL AND COALESCE(cardinality(store_ids), 0) = 0)
        OR store_id IN (SELECT public.my_readable_store_ids())
        OR COALESCE(store_ids, '{}'::uuid[]) && ARRAY(SELECT public.my_readable_store_ids())
      )
    )
  );
CREATE POLICY audit_schedules_insert ON public.audit_schedules
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_manager(org_id)
    AND (
      public.is_org_owner_or_admin(org_id)
      OR (
        (store_id IS NULL OR store_id IN (SELECT public.my_readable_store_ids()))
        AND COALESCE(store_ids, '{}'::uuid[]) <@ ARRAY(SELECT public.my_readable_store_ids())
      )
    )
  );
CREATE POLICY audit_schedules_update ON public.audit_schedules
  FOR UPDATE TO authenticated
  USING (
    public.is_org_manager(org_id)
    AND (
      public.is_org_owner_or_admin(org_id)
      OR created_by = auth.uid()
      OR store_id IN (SELECT public.my_readable_store_ids())
      OR COALESCE(store_ids, '{}'::uuid[]) && ARRAY(SELECT public.my_readable_store_ids())
    )
  )
  WITH CHECK (
    public.is_org_manager(org_id)
    AND (
      public.is_org_owner_or_admin(org_id)
      OR (
        (store_id IS NULL OR store_id IN (SELECT public.my_readable_store_ids()))
        AND COALESCE(store_ids, '{}'::uuid[]) <@ ARRAY(SELECT public.my_readable_store_ids())
      )
    )
  );
CREATE POLICY audit_schedules_delete ON public.audit_schedules
  FOR DELETE TO authenticated
  USING (
    public.is_org_manager(org_id)
    AND (
      public.is_org_owner_or_admin(org_id)
      OR created_by = auth.uid()
      OR (
        (store_id IS NULL OR store_id IN (SELECT public.my_readable_store_ids()))
        AND COALESCE(store_ids, '{}'::uuid[]) <@ ARRAY(SELECT public.my_readable_store_ids())
      )
    )
  );

-- Planograms: org-wide (store_id null) or the caller's stores.
DROP POLICY IF EXISTS planogram_items_select ON public.planogram_items;
DROP POLICY IF EXISTS planogram_items_manage ON public.planogram_items;
CREATE POLICY planogram_items_select ON public.planogram_items
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.my_member_org_ids())
    AND (
      store_id IS NULL
      OR public.is_org_owner_or_admin(org_id)
      OR store_id IN (SELECT public.my_readable_store_ids())
    )
  );
CREATE POLICY planogram_items_manage ON public.planogram_items
  FOR ALL TO authenticated
  USING (
    private.is_org_manager_current(org_id)
    AND (
      public.is_org_owner_or_admin(org_id)
      OR store_id IS NULL
      OR store_id IN (SELECT public.my_readable_store_ids())
    )
  )
  WITH CHECK (
    private.is_org_manager_current(org_id)
    AND (
      public.is_org_owner_or_admin(org_id)
      OR store_id IS NULL
      OR store_id IN (SELECT public.my_readable_store_ids())
    )
  );

DROP POLICY IF EXISTS planogram_versions_select ON public.planogram_versions;
DROP POLICY IF EXISTS planogram_versions_manage ON public.planogram_versions;
CREATE POLICY planogram_versions_select ON public.planogram_versions
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.my_member_org_ids())
    AND (
      store_id IS NULL
      OR public.is_org_owner_or_admin(org_id)
      OR store_id IN (SELECT public.my_readable_store_ids())
    )
  );
CREATE POLICY planogram_versions_manage ON public.planogram_versions
  FOR ALL TO authenticated
  USING (
    private.is_org_manager_current(org_id)
    AND (
      public.is_org_owner_or_admin(org_id)
      OR store_id IS NULL
      OR store_id IN (SELECT public.my_readable_store_ids())
    )
  )
  WITH CHECK (
    private.is_org_manager_current(org_id)
    AND (
      public.is_org_owner_or_admin(org_id)
      OR store_id IS NULL
      OR store_id IN (SELECT public.my_readable_store_ids())
    )
  );

-- Ask Aislix logs hold other users' questions: owner/admin only (own logs stay readable).
DROP POLICY IF EXISTS ask_aislix_logs_select_manager ON public.ask_aislix_logs;
CREATE POLICY ask_aislix_logs_select_manager ON public.ask_aislix_logs
  FOR SELECT TO authenticated USING (public.is_org_owner_or_admin(org_id));
