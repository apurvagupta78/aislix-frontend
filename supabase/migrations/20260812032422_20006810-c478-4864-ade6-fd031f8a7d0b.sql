-- 1) Lock down SECURITY DEFINER helper execution
REVOKE ALL ON FUNCTION public.can_org_add_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.count_org_seats(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_member_seat_limit() FROM PUBLIC, anon, authenticated;

-- get_org_usage_summary stays callable by signed-in users, but must verify membership
CREATE OR REPLACE FUNCTION public.get_org_usage_summary(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  plan_code TEXT;
  plan_name TEXT;
  scan_quota INT;
  store_limit INT;
  seat_limit INT;
  scans_used INT;
  stores_used INT;
  seats_used INT;
  period_end TIMESTAMPTZ;
  free_status RECORD;
  is_bypass BOOLEAN;
  seat_label TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = p_org_id AND om.user_id = auth.uid() AND om.status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_org_id AND o.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  is_bypass := public.org_has_platform_bypass(p_org_id);

  PERFORM public.ensure_org_free_subscription(p_org_id);
  PERFORM public.reset_subscription_period_if_due(p_org_id);

  SELECT sp.code, sp.name, sp.scan_quota, sp.store_limit, sp.seat_limit, s.scans_used, s.current_period_end
  INTO plan_code, plan_name, scan_quota, store_limit, seat_limit, scans_used, period_end
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.org_id = p_org_id
    AND s.status IN ('active', 'trialing');

  IF NOT FOUND THEN
    plan_code := 'free';
    plan_name := 'Free';
    scan_quota := 3;
    store_limit := 1;
    seat_limit := 1;
    scans_used := 0;
    period_end := NULL;
  END IF;

  SELECT COUNT(*) INTO stores_used
  FROM public.stores WHERE org_id = p_org_id AND status = 'active';

  seats_used := public.count_org_seats(p_org_id);

  seat_label := CASE
    WHEN seat_limit IS NULL THEN 'Unlimited users'
    WHEN seat_limit = 1 THEN '1 user'
    ELSE seat_limit::text || ' users'
  END;

  IF is_bypass THEN
    RETURN jsonb_build_object(
      'plan_code', plan_code, 'plan_name', plan_name,
      'scans_used', COALESCE(scans_used, 0), 'scans_included', scan_quota,
      'scans_remaining', NULL,
      'scan_limit_label', COALESCE(
        CASE WHEN scan_quota IS NULL THEN 'Unlimited scans' ELSE scan_quota::text || ' scans / month' END,
        '3 scans / 24 hours'
      ),
      'blocked', FALSE, 'cooldown_until', NULL,
      'stores_used', stores_used, 'stores_included', COALESCE(store_limit, 1),
      'seats_used', seats_used, 'seats_included', seat_limit,
      'seat_limit_label', seat_label,
      'history_days', NULL, 'period_end', period_end,
      'platform_bypass', TRUE,
      'platform_bypass_note', 'Internal tester — plan limits not enforced'
    );
  END IF;

  IF plan_code = 'free' THEN
    SELECT * INTO free_status FROM public.free_plan_scan_status(p_org_id);
    RETURN jsonb_build_object(
      'plan_code', plan_code, 'plan_name', plan_name,
      'scans_used', free_status.scans_used_in_batch, 'scans_included', 3,
      'scans_remaining', GREATEST(0, 3 - free_status.scans_used_in_batch),
      'scan_limit_label', '3 scans / 24 hours',
      'blocked', free_status.blocked, 'cooldown_until', free_status.cooldown_until,
      'stores_used', stores_used, 'stores_included', COALESCE(store_limit, 1),
      'seats_used', seats_used, 'seats_included', COALESCE(seat_limit, 1),
      'seat_limit_label', seat_label,
      'history_days', 7, 'period_end', period_end, 'platform_bypass', FALSE
    );
  END IF;

  RETURN jsonb_build_object(
    'plan_code', plan_code, 'plan_name', plan_name,
    'scans_used', scans_used, 'scans_included', scan_quota,
    'scans_remaining', CASE WHEN scan_quota IS NULL THEN NULL ELSE GREATEST(0, scan_quota - scans_used) END,
    'scan_limit_label', CASE WHEN scan_quota IS NULL THEN 'Unlimited scans' ELSE scan_quota::text || ' scans / month' END,
    'blocked', CASE WHEN scan_quota IS NULL THEN FALSE ELSE scans_used >= scan_quota END,
    'cooldown_until', NULL, 'stores_used', stores_used, 'stores_included', store_limit,
    'seats_used', seats_used, 'seats_included', seat_limit,
    'seat_limit_label', seat_label,
    'history_days', NULL, 'period_end', period_end, 'platform_bypass', FALSE
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_org_usage_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_usage_summary(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.should_show_onboarding(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.should_show_onboarding(uuid) TO authenticated, service_role;

-- 2) Prevent role escalation to owner on organization_members
DROP POLICY IF EXISTS org_members_insert_admins ON public.organization_members;
CREATE POLICY org_members_insert_admins
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  (
    private.has_org_role(org_id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role])
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_members.org_id AND o.owner_id = auth.uid()
    )
  )
  AND (
    role <> 'owner'::app_role
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_members.org_id AND o.owner_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS org_members_update_admins ON public.organization_members;
CREATE POLICY org_members_update_admins
ON public.organization_members
FOR UPDATE
TO authenticated
USING (private.has_org_role(org_id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]))
WITH CHECK (
  private.has_org_role(org_id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role])
  AND (
    role <> 'owner'::app_role
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_members.org_id AND o.owner_id = auth.uid()
    )
  )
);

-- 3) Prevent ownership takeover on organizations
DROP POLICY IF EXISTS orgs_update_admins ON public.organizations;
CREATE POLICY orgs_update_admins
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR private.has_org_role(id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role])
)
WITH CHECK (
  (
    owner_id = auth.uid()
    OR private.has_org_role(id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role])
  )
  AND (
    owner_id = (SELECT o.owner_id FROM public.organizations o WHERE o.id = organizations.id)
    OR (SELECT o.owner_id FROM public.organizations o WHERE o.id = organizations.id) = auth.uid()
  )
);

-- 4) Hide billing_email and gstin from ordinary members
REVOKE SELECT ON public.organizations FROM authenticated;
GRANT SELECT (id, name, slug, owner_id, industry, website, logo_url, country, address, created_at, updated_at)
  ON public.organizations TO authenticated;
REVOKE SELECT ON public.organizations FROM anon;

CREATE OR REPLACE FUNCTION public.get_org_billing_profile(p_org_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  logo_url text,
  billing_email text,
  gstin text,
  address jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_org_id AND o.owner_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
      AND om.role IN ('owner'::app_role, 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT o.id, o.name, o.logo_url, o.billing_email, o.gstin, o.address
  FROM public.organizations o
  WHERE o.id = p_org_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_org_billing_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_billing_profile(uuid) TO authenticated, service_role;