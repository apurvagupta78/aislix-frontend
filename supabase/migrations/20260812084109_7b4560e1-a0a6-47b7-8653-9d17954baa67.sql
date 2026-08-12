-- 1) Onboarding completion: only ever acts on the caller.
CREATE OR REPLACE FUNCTION public.complete_onboarding(p_user_id uuid DEFAULT auth.uid())
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  done_at TIMESTAMPTZ;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM uid THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.profiles
  SET onboarding_completed_at = COALESCE(onboarding_completed_at, now()),
      updated_at = now()
  WHERE id = uid
  RETURNING onboarding_completed_at INTO done_at;

  IF done_at IS NULL THEN
    INSERT INTO public.profiles (id, onboarding_completed_at, updated_at)
    VALUES (uid, now(), now())
    ON CONFLICT (id) DO UPDATE
      SET onboarding_completed_at = COALESCE(public.profiles.onboarding_completed_at, now()),
          updated_at = now()
    RETURNING onboarding_completed_at INTO done_at;
  END IF;

  RETURN done_at;
END;
$function$;

-- 2) Email verification: caller-only, no cross-user lookups.
CREATE OR REPLACE FUNCTION public.is_user_email_verified(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT COALESCE((
    SELECT u.email_confirmed_at IS NOT NULL
    FROM auth.users u
    WHERE auth.uid() IS NOT NULL
      AND u.id = auth.uid()
      AND (p_user_id IS NULL OR p_user_id = auth.uid())
  ), FALSE);
$function$;

-- 3) Lock down execute privileges: only the five caller-scoped RPCs stay callable
--    by signed-in users; everything else runs server-side only.
DO $$
DECLARE
  r RECORD;
  allowed TEXT[] := ARRAY[
    'complete_onboarding',
    'should_show_onboarding',
    'is_user_email_verified',
    'get_org_billing_profile',
    'get_org_usage_summary'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    IF NOT (r.proname = ANY (allowed)) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END
$$;