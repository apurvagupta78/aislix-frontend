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
  scans_used INT;
  stores_used INT;
  period_end TIMESTAMPTZ;
  free_status RECORD;
  is_bypass BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = p_org_id AND om.user_id = auth.uid() AND om.status = 'active'
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  is_bypass := public.org_has_platform_bypass(p_org_id);

  PERFORM public.ensure_org_free_subscription(p_org_id);
  PERFORM public.reset_subscription_period_if_due(p_org_id);

  SELECT sp.code, sp.name, sp.scan_quota, sp.store_limit, s.scans_used, s.current_period_end
  INTO plan_code, plan_name, scan_quota, store_limit, scans_used, period_end
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.org_id = p_org_id
    AND s.status IN ('active', 'trialing');

  IF NOT FOUND THEN
    plan_code := 'free';
    plan_name := 'Free';
    scan_quota := 3;
    store_limit := 1;
    scans_used := 0;
    period_end := NULL;
  END IF;

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
      'stores_used', stores_used, 'stores_included', COALESCE(store_limit, 1),
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