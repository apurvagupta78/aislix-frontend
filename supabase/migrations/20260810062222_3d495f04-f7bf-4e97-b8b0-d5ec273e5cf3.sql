-- 1. Lock down SECURITY DEFINER functions in the exposed public schema
REVOKE ALL ON FUNCTION public.can_org_add_store(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_org_start_scan(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.org_has_platform_bypass(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.org_has_platform_store_bypass(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_email_has_platform_bypass(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_org_usage_summary(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_organization() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.can_org_add_store(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_org_start_scan(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.org_has_platform_bypass(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.org_has_platform_store_bypass(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_email_has_platform_bypass(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_org_usage_summary(uuid) TO authenticated, service_role;

-- 2. get_org_usage_summary must only reveal data for orgs the caller belongs to
CREATE OR REPLACE FUNCTION public.get_org_usage_summary(p_org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  plan_code TEXT;
  plan_name TEXT;
  scan_quota INT;
  store_limit INT;
  scans_used INT;
  stores_used INT;
  period_end TIMESTAMPTZ;
  free_status RECORD;
  is_bypass BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  is_bypass := public.org_has_platform_bypass(p_org_id);

  PERFORM public.reset_subscription_period_if_due(p_org_id);

  SELECT sp.code, sp.name, sp.scan_quota, sp.store_limit, s.scans_used, s.current_period_end
  INTO plan_code, plan_name, scan_quota, store_limit, scans_used, period_end
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.org_id = p_org_id;

  SELECT COUNT(*) INTO stores_used
  FROM public.stores WHERE org_id = p_org_id AND status = 'active';

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
      'stores_used', stores_used, 'stores_included', store_limit,
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
      'stores_used', stores_used, 'stores_included', store_limit,
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
    'history_days', NULL, 'period_end', period_end, 'platform_bypass', FALSE
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_org_usage_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_usage_summary(uuid) TO authenticated, service_role;

-- 3. Shared catalog: read-only for signed-in users, writes only via trusted server role
DROP POLICY IF EXISTS global_learned_skus_auth_insert ON public.global_learned_skus;
DROP POLICY IF EXISTS global_learned_skus_auth_update ON public.global_learned_skus;

REVOKE INSERT, UPDATE, DELETE ON public.global_learned_skus FROM authenticated, anon;
GRANT SELECT ON public.global_learned_skus TO authenticated;
GRANT ALL ON public.global_learned_skus TO service_role;