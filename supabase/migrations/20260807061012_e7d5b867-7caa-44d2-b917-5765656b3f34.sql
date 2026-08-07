REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_organization() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.app_role[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scan_in_my_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.app_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.scan_in_my_org(uuid) TO authenticated, service_role;