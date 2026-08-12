-- Signed-out visitors must not be able to run onboarding completion
REVOKE EXECUTE ON FUNCTION public.complete_onboarding(uuid) FROM anon;

-- Restrict onboarding status check to the caller's own account
CREATE OR REPLACE FUNCTION public.should_show_onboarding(p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID := COALESCE(p_user_id, auth.uid());
  profile_done TIMESTAMPTZ;
  is_invited_member BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF uid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT onboarding_completed_at INTO profile_done FROM public.profiles WHERE id = uid;
  IF profile_done IS NOT NULL THEN RETURN FALSE; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = uid AND om.status = 'active'
      AND om.role IN ('member', 'manager', 'admin')
  ) INTO is_invited_member;
  IF is_invited_member THEN RETURN FALSE; END IF;

  RETURN TRUE;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.should_show_onboarding(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.should_show_onboarding(uuid) TO authenticated, service_role;