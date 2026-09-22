-- Public-SaaS: people reporting hierarchy + authoritative effective store scope.
-- ACCESS = role + org + reports_to tree + direct store_ids (+ assignment-touch).
-- Owner/admin = organization-wide. Managers are NOT org-wide.

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS reports_to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_members_reports_to
  ON public.organization_members (org_id, reports_to_user_id)
  WHERE reports_to_user_id IS NOT NULL;

COMMENT ON COLUMN public.organization_members.reports_to_user_id IS
  'Immediate manager (auth user id) within the same org. Effective store scope rolls up recursively.';

-- Prevent self-report and cross-org / cycle on write.
CREATE OR REPLACE FUNCTION private.validate_reports_to()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_cursor UUID;
  v_guard INT := 0;
  v_mgr_org UUID;
BEGIN
  IF NEW.reports_to_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.reports_to_user_id = NEW.user_id THEN
    RAISE EXCEPTION 'A user cannot report to themselves.';
  END IF;

  SELECT org_id INTO v_mgr_org
  FROM public.organization_members
  WHERE org_id = NEW.org_id
    AND user_id = NEW.reports_to_user_id
    AND status IN ('active', 'invited')
  LIMIT 1;

  IF v_mgr_org IS NULL THEN
    RAISE EXCEPTION 'Reports-to user must be an active or invited member of the same organization.';
  END IF;

  -- Cycle: walk upward from the proposed manager; must never reach NEW.user_id.
  v_cursor := NEW.reports_to_user_id;
  WHILE v_cursor IS NOT NULL AND v_guard < 64 LOOP
    IF v_cursor = NEW.user_id THEN
      RAISE EXCEPTION 'Reporting hierarchy cycle detected.';
    END IF;
    SELECT reports_to_user_id INTO v_cursor
    FROM public.organization_members
    WHERE org_id = NEW.org_id AND user_id = v_cursor
    LIMIT 1;
    v_guard := v_guard + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_reports_to ON public.organization_members;
CREATE TRIGGER trg_validate_reports_to
  BEFORE INSERT OR UPDATE OF reports_to_user_id, user_id, org_id
  ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_reports_to();

-- Authoritative effective store IDs for a user in an org.
CREATE OR REPLACE FUNCTION public.effective_store_ids(
  p_org_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_status TEXT;
  v_direct UUID[];
  v_result UUID[];
BEGIN
  IF p_org_id IS NULL OR p_user_id IS NULL THEN
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

  -- Owner / Admin: entire organization.
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
    -- Direct stores
    SELECT UNNEST(COALESCE(v_direct, '{}'::uuid[])) AS store_id
    UNION
    -- Descendant team members' direct stores
    SELECT UNNEST(COALESCE(m.store_ids, '{}'::uuid[])) AS store_id
    FROM public.organization_members m
    WHERE m.org_id = p_org_id
      AND m.user_id IN (SELECT user_id FROM descendants)
    UNION
    -- Assignment-touch stores (existing product rule)
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
$$;

GRANT EXECUTE ON FUNCTION public.effective_store_ids(UUID, UUID) TO authenticated, service_role;

-- Direct store IDs only (no inheritance) for UI breakdown.
CREATE OR REPLACE FUNCTION public.direct_store_ids(
  p_org_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN om.role::text IN ('owner', 'admin') THEN (
          SELECT COALESCE(array_agg(s.id), '{}'::uuid[])
          FROM public.stores s
          WHERE s.org_id = p_org_id AND s.status = 'active'
        )
        ELSE COALESCE(om.store_ids, '{}'::uuid[])
      END
      FROM public.organization_members om
      WHERE om.org_id = p_org_id AND om.user_id = p_user_id AND om.status = 'active'
      LIMIT 1
    ),
    '{}'::uuid[]
  );
$$;

GRANT EXECUTE ON FUNCTION public.direct_store_ids(UUID, UUID) TO authenticated, service_role;

-- Inherited = effective − direct (for managers/members).
CREATE OR REPLACE FUNCTION public.inherited_store_ids(
  p_org_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT array_agg(x)
      FROM (
        SELECT UNNEST(public.effective_store_ids(p_org_id, p_user_id)) AS x
        EXCEPT
        SELECT UNNEST(public.direct_store_ids(p_org_id, p_user_id))
      ) d
    ),
    '{}'::uuid[]
  );
$$;

GRANT EXECUTE ON FUNCTION public.inherited_store_ids(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.user_can_access_store(
  p_org_id UUID,
  p_store_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_store_id IS NOT NULL
    AND p_store_id = ANY (public.effective_store_ids(p_org_id, p_user_id));
$$;

GRANT EXECUTE ON FUNCTION public.user_can_access_store(UUID, UUID, UUID) TO authenticated, service_role;

-- RLS: stores SELECT — scoped by effective stores (demo showcase still readable).
DROP POLICY IF EXISTS stores_select_members ON public.stores;
CREATE POLICY stores_select_members ON public.stores
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(org_id)
    AND (
      public.is_org_owner_or_admin(org_id)
      OR public.user_can_access_store(org_id, id, auth.uid())
      OR public.is_demo_org_readable(org_id)
    )
  );

-- RLS: shelf_scans SELECT — store in effective scope OR assignee/creator path for members.
DROP POLICY IF EXISTS scans_select_members ON public.shelf_scans;
CREATE POLICY scans_select_members ON public.shelf_scans
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(org_id)
    AND (
      public.is_org_owner_or_admin(org_id)
      OR (store_id IS NOT NULL AND public.user_can_access_store(org_id, store_id, auth.uid()))
      OR created_by = auth.uid()
      OR finalized_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.scan_assignments sa
        WHERE sa.id = shelf_scans.assignment_id
          AND (sa.assignee_id = auth.uid() OR sa.assigner_id = auth.uid())
      )
      OR public.is_demo_org_readable(org_id)
    )
  );
