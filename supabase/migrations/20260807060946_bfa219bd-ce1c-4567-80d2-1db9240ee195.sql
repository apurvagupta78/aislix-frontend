REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_organization() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.app_role[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.scan_in_my_org(uuid) FROM anon;