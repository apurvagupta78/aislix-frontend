DO $migration$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('public', p.oid, 'EXECUTE')
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn.signature);
  END LOOP;
END
$migration$;

ALTER FUNCTION public.expiry_demo_clock() SET search_path = public;
ALTER FUNCTION public.prevent_locked_digital_edits() SET search_path = public;
ALTER FUNCTION public.protect_assignment_control_snapshot() SET search_path = public;