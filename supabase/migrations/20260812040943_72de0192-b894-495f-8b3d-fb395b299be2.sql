CREATE OR REPLACE FUNCTION public.is_user_email_verified(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE((
    SELECT u.email_confirmed_at IS NOT NULL
    FROM auth.users u
    WHERE u.id = COALESCE(p_user_id, auth.uid())
      AND auth.uid() IS NOT NULL
      AND u.id = auth.uid()
  ), FALSE);
$$;

REVOKE ALL ON FUNCTION public.is_user_email_verified(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_user_email_verified(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_user_email_verified(UUID) TO authenticated;