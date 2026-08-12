CREATE OR REPLACE FUNCTION public.should_show_onboarding(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  already_done BOOLEAN;
  has_store BOOLEAN;
  has_scan BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
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
$$;

GRANT EXECUTE ON FUNCTION public.should_show_onboarding(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.should_show_onboarding(uuid) TO service_role;