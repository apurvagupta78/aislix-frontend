-- Harden public.get_org_usage_summary: it no longer needs elevated (SECURITY
-- DEFINER) rights. Every table it reads already has member-scoped SELECT
-- policies, so running as SECURITY INVOKER means row-level security is applied
-- as the calling user, in addition to the explicit membership guard.
CREATE OR REPLACE FUNCTION public.get_org_usage_summary(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  _sub record;
  _plan record;
  _scans_used integer := 0;
  _stores_used integer := 0;
  _cooldown timestamptz := NULL;
  _period_start timestamptz;
  _period_end timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_org_member(p_org_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  SELECT * INTO _sub FROM public.subscriptions WHERE org_id = p_org_id LIMIT 1;
  IF _sub.plan_id IS NOT NULL THEN
    SELECT * INTO _plan FROM public.subscription_plans WHERE id = _sub.plan_id;
  ELSE
    SELECT * INTO _plan FROM public.subscription_plans WHERE code = 'free';
  END IF;

  SELECT count(*) INTO _stores_used FROM public.stores WHERE org_id = p_org_id;

  IF _plan.quota_period = 'rolling_24h' THEN
    _period_start := now() - interval '24 hours';
    _period_end := NULL;
    SELECT count(*) INTO _scans_used
      FROM public.shelf_scans
     WHERE org_id = p_org_id
       AND status = 'completed'
       AND created_at >= now() - interval '24 hours';

    IF _plan.scan_quota IS NOT NULL AND _scans_used >= _plan.scan_quota THEN
      SELECT min(created_at) + interval '24 hours' INTO _cooldown
        FROM (
          SELECT created_at
            FROM public.shelf_scans
           WHERE org_id = p_org_id
             AND status = 'completed'
             AND created_at >= now() - interval '24 hours'
           ORDER BY created_at DESC
           LIMIT _plan.scan_quota
        ) recent;
    END IF;
  ELSE
    _period_start := _sub.current_period_start;
    _period_end := _sub.current_period_end;
    IF _period_end IS NOT NULL AND _period_end <= now() THEN
      _scans_used := 0;
    ELSE
      _scans_used := COALESCE(_sub.scans_used, 0);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'plan_code', _plan.code,
    'plan_name', _plan.name,
    'quota_period', _plan.quota_period,
    'is_contact_sales', _plan.is_contact_sales,
    'price_monthly_inr', _plan.price_monthly_inr,
    'scan_quota', _plan.scan_quota,
    'store_limit', _plan.store_limit,
    'seat_limit', _plan.seat_limit,
    'history_days', _plan.history_days,
    'scans_used', _scans_used,
    'scans_remaining', CASE WHEN _plan.scan_quota IS NULL THEN NULL
                            ELSE greatest(0, _plan.scan_quota - _scans_used) END,
    'stores_used', _stores_used,
    'stores_remaining', CASE WHEN _plan.store_limit IS NULL THEN NULL
                             ELSE greatest(0, _plan.store_limit - _stores_used) END,
    'period_start', _period_start,
    'period_end', _period_end,
    'cooldown_until', _cooldown,
    'can_scan', CASE WHEN _plan.scan_quota IS NULL THEN true
                     ELSE _scans_used < _plan.scan_quota END,
    'can_add_store', CASE WHEN _plan.store_limit IS NULL THEN true
                          ELSE _stores_used < _plan.store_limit END,
    'status', COALESCE(_sub.status::text, 'active'),
    'cycle', COALESCE(_sub.cycle::text, 'monthly'),
    'cancel_at_period_end', COALESCE(_sub.cancel_at_period_end, false)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_org_usage_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_usage_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_usage_summary(uuid) TO service_role;