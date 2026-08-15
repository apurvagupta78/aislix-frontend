REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS global_learned_skus_auth_read ON public.global_learned_skus;
REVOKE SELECT ON public.global_learned_skus FROM authenticated, anon;
GRANT ALL ON public.global_learned_skus TO service_role;