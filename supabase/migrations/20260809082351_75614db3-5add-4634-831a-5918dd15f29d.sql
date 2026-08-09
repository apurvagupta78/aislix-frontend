-- Aislix subscription plan limits

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS history_days integer,
  ADD COLUMN IF NOT EXISTS quota_period text NOT NULL DEFAULT 'month';

INSERT INTO public.subscription_plans
  (code, name, tagline, price_monthly_inr, price_annual_inr, scan_quota, store_limit, seat_limit,
   quota_period, history_days, is_contact_sales, is_active, sort_order)
VALUES
  ('free', 'Free', 'For single-store owners trying shelf audits', 0, 0, 3, 1, 1, 'rolling_24h', 7, false, true, 1),
  ('starter', 'Starter', 'For local stores and boutique retail chains', 999, 9990, 300, 1, 3, 'month', NULL, false, true, 2),
  ('growth', 'Growth', 'For growing retail chains and distributors', 2999, 29990, 3000, 3, 10, 'month', NULL, false, true, 3),
  ('professional', 'Professional', 'For supermarkets, dark stores, warehouses, FMCG brands, distributors and local stores', 4999, 49990, 5000, 5, 15, 'month', NULL, false, true, 4),
  ('enterprise', 'Enterprise', 'For multi-location retail groups and national brands', 0, 0, NULL, NULL, NULL, 'month', NULL, true, true, 5)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  price_monthly_inr = EXCLUDED.price_monthly_inr,
  price_annual_inr = EXCLUDED.price_annual_inr,
  scan_quota = EXCLUDED.scan_quota,
  store_limit = EXCLUDED.store_limit,
  seat_limit = EXCLUDED.seat_limit,
  quota_period = EXCLUDED.quota_period,
  history_days = EXCLUDED.history_days,
  is_contact_sales = EXCLUDED.is_contact_sales,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- Monthly quota rollover + automatic scan counting on completion.
CREATE OR REPLACE FUNCTION public.roll_subscription_period(_sub_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscriptions
     SET scans_used = 0,
         current_period_start = COALESCE(current_period_end, now()),
         current_period_end = COALESCE(current_period_end, now())
           + CASE WHEN cycle = 'annual' THEN interval '1 year' ELSE interval '1 month' END
   WHERE id = _sub_id
     AND current_period_end IS NOT NULL
     AND current_period_end <= now();
END;
$$;

CREATE OR REPLACE FUNCTION public.count_completed_scan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub_id uuid;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT id INTO _sub_id FROM public.subscriptions WHERE org_id = NEW.org_id LIMIT 1;
    IF _sub_id IS NOT NULL THEN
      PERFORM public.roll_subscription_period(_sub_id);
      UPDATE public.subscriptions
         SET scans_used = COALESCE(scans_used, 0) + 1
       WHERE id = _sub_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shelf_scans_count_completed ON public.shelf_scans;
CREATE TRIGGER shelf_scans_count_completed
AFTER UPDATE OF status ON public.shelf_scans
FOR EACH ROW EXECUTE FUNCTION public.count_completed_scan();

REVOKE ALL ON FUNCTION public.roll_subscription_period(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_completed_scan() FROM PUBLIC;

-- Usage summary consumed by the app (plan limits, usage, cooldown).
CREATE OR REPLACE FUNCTION public.get_org_usage_summary(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub record;
  _plan record;
  _scans_used integer := 0;
  _stores_used integer := 0;
  _cooldown timestamptz := NULL;
  _period_start timestamptz;
  _period_end timestamptz;
BEGIN
  IF NOT private.is_org_member(p_org_id, auth.uid()) THEN
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
$$;

REVOKE ALL ON FUNCTION public.get_org_usage_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_usage_summary(uuid) TO authenticated;
