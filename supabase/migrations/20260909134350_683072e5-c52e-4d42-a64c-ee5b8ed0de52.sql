REVOKE EXECUTE ON FUNCTION public.is_org_manager(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_owner_or_admin(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_manager(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_owner_or_admin(uuid) TO authenticated, service_role;