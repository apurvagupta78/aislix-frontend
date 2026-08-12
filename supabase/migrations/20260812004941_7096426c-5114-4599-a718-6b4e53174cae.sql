-- Lock down internal SECURITY DEFINER helpers
REVOKE ALL ON FUNCTION public.ensure_org_free_subscription(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_subscription_period_if_due(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.free_plan_scan_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_org_add_store(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_org_start_scan(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_email_has_platform_bypass(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.org_has_platform_bypass(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.org_has_platform_store_bypass(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_organization() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Client-facing RPCs: signed-in users only
REVOKE ALL ON FUNCTION public.get_org_usage_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_usage_summary(uuid) TO authenticated;

-- Onboarding check: signed-in, own account only
CREATE OR REPLACE FUNCTION public.should_show_onboarding(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  already_done BOOLEAN;
  has_store BOOLEAN;
  has_scan BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT onboarding_completed_at IS NOT NULL INTO already_done
  FROM public.profiles WHERE id = p_user_id;

  IF already_done IS NULL THEN
    RETURN TRUE;
  END IF;

  IF already_done THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.stores s
    JOIN public.organization_members om ON om.org_id = s.org_id
    WHERE om.user_id = p_user_id AND om.status = 'active'
  ) INTO has_store;

  SELECT EXISTS (
    SELECT 1 FROM public.shelf_scans sc
    JOIN public.organization_members om ON om.org_id = sc.org_id
    WHERE om.user_id = p_user_id AND om.status = 'active'
  ) INTO has_scan;

  RETURN NOT (has_store OR has_scan);
END;
$function$;

REVOKE ALL ON FUNCTION public.should_show_onboarding(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.should_show_onboarding(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.should_show_onboarding(uuid) TO service_role;

-- Restrict api_keys visibility to org owners/admins
DROP POLICY IF EXISTS "Org members can view api keys" ON public.api_keys;
CREATE POLICY "Org admins can view api keys"
ON public.api_keys FOR SELECT TO authenticated
USING (private.has_org_role(org_id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]));