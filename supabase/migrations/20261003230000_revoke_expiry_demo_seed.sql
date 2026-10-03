-- Development-only seeder must not be callable against customer workspaces.
revoke execute on function public.seed_expiry_demo_scenario(uuid, uuid) from public, anon, authenticated;
