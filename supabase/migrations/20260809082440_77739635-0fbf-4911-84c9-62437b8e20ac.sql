DROP TRIGGER IF EXISTS shelf_scans_count_completed ON public.shelf_scans;
DROP FUNCTION IF EXISTS public.count_completed_scan();
DROP FUNCTION IF EXISTS public.roll_subscription_period(uuid);

CREATE OR REPLACE FUNCTION private.roll_subscription_period(_sub_id uuid)
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

CREATE OR REPLACE FUNCTION private.count_completed_scan()
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
      PERFORM private.roll_subscription_period(_sub_id);
      UPDATE public.subscriptions
         SET scans_used = COALESCE(scans_used, 0) + 1
       WHERE id = _sub_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER shelf_scans_count_completed
AFTER UPDATE OF status ON public.shelf_scans
FOR EACH ROW EXECUTE FUNCTION private.count_completed_scan();

REVOKE ALL ON FUNCTION private.roll_subscription_period(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.count_completed_scan() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_org_usage_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_usage_summary(uuid) TO authenticated;
