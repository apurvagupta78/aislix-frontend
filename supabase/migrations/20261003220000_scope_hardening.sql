-- 1. Expiry Control rows follow store assignment, not just org membership.
--    Tables with store_id: the store must be readable by the caller.
--    Tables tied to an inspection attempt: the attempt must be readable (its RLS applies).

alter policy expiry_exceptions_org on public.expiry_exceptions
  using (public.is_org_member(org_id) and (store_id is null or store_id in (select public.my_readable_store_ids())))
  with check (public.is_org_member(org_id) and (store_id is null or store_id in (select public.my_readable_store_ids())));

alter policy expiry_future_actions_org on public.expiry_future_actions
  using (public.is_org_member(org_id) and (store_id is null or store_id in (select public.my_readable_store_ids())))
  with check (public.is_org_member(org_id) and (store_id is null or store_id in (select public.my_readable_store_ids())));

alter policy expiry_assignments_write on public.expiry_inspection_assignments
  using (public.is_org_member(org_id) and (store_id is null or store_id in (select public.my_readable_store_ids())))
  with check (public.is_org_member(org_id) and (store_id is null or store_id in (select public.my_readable_store_ids())));
alter policy expiry_assignments_select on public.expiry_inspection_assignments
  using (public.is_org_member(org_id) and (store_id is null or store_id in (select public.my_readable_store_ids())));

alter policy expiry_attempts_write on public.expiry_inspection_attempts
  using (public.is_org_member(org_id) and (store_id is null or store_id in (select public.my_readable_store_ids())))
  with check (public.is_org_member(org_id) and (store_id is null or store_id in (select public.my_readable_store_ids())));
alter policy expiry_attempts_select on public.expiry_inspection_attempts
  using (public.is_org_member(org_id) and (store_id is null or store_id in (select public.my_readable_store_ids())));

alter policy expiry_locations_manage on public.expiry_locations
  using (public.is_org_manager(org_id) and (store_id is null or store_id in (select public.my_readable_store_ids())))
  with check (public.is_org_manager(org_id) and (store_id is null or store_id in (select public.my_readable_store_ids())));
alter policy expiry_locations_select on public.expiry_locations
  using (public.is_org_member(org_id) and (store_id is null or store_id in (select public.my_readable_store_ids())));

alter policy expiry_quarantine_containers_org on public.expiry_quarantine_containers
  using (public.is_org_member(org_id) and (store_id is null or store_id in (select public.my_readable_store_ids())))
  with check (public.is_org_member(org_id) and (store_id is null or store_id in (select public.my_readable_store_ids())));

alter policy expiry_role_grants_manage on public.expiry_role_grants
  using (public.is_org_manager(org_id) and (store_id is null or store_id in (select public.my_readable_store_ids())))
  with check (public.is_org_manager(org_id) and (store_id is null or store_id in (select public.my_readable_store_ids())));
alter policy expiry_role_grants_select on public.expiry_role_grants
  using (public.is_org_member(org_id) and (store_id is null or store_id in (select public.my_readable_store_ids())));

alter policy expiry_evidence_links_org on public.expiry_evidence_links
  using (public.is_org_member(org_id) and (attempt_id is null or attempt_id in (select a.id from public.expiry_inspection_attempts a)))
  with check (public.is_org_member(org_id) and (attempt_id is null or attempt_id in (select a.id from public.expiry_inspection_attempts a)));

alter policy expiry_observations_org on public.expiry_packet_observations
  using (public.is_org_member(org_id) and (attempt_id is null or attempt_id in (select a.id from public.expiry_inspection_attempts a)))
  with check (public.is_org_member(org_id) and (attempt_id is null or attempt_id in (select a.id from public.expiry_inspection_attempts a)));

alter policy expiry_quarantine_transfers_org on public.expiry_quarantine_transfers
  using (public.is_org_member(org_id) and (attempt_id is null or attempt_id in (select a.id from public.expiry_inspection_attempts a)))
  with check (public.is_org_member(org_id) and (attempt_id is null or attempt_id in (select a.id from public.expiry_inspection_attempts a)));

alter policy expiry_review_decisions_org on public.expiry_review_decisions
  using (public.is_org_member(org_id) and (attempt_id is null or attempt_id in (select a.id from public.expiry_inspection_attempts a)))
  with check (public.is_org_member(org_id) and (attempt_id is null or attempt_id in (select a.id from public.expiry_inspection_attempts a)));

alter policy expiry_baselines_org on public.expiry_stock_baselines
  using (public.is_org_member(org_id) and (attempt_id is null or attempt_id in (select a.id from public.expiry_inspection_attempts a)))
  with check (public.is_org_member(org_id) and (attempt_id is null or attempt_id in (select a.id from public.expiry_inspection_attempts a)));

alter policy expiry_movements_org on public.expiry_stock_movement_adjustments
  using (public.is_org_member(org_id) and (attempt_id is null or attempt_id in (select a.id from public.expiry_inspection_attempts a)))
  with check (public.is_org_member(org_id) and (attempt_id is null or attempt_id in (select a.id from public.expiry_inspection_attempts a)));

-- 2. Overview metrics read through the caller's own row-level security.
alter function public.expiry_overview_metrics(uuid, uuid) security invoker;

-- 3. Internal helpers are not callable from the API.
revoke execute on function public.notify_org_role(uuid, text[], text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.sync_expiry_findings(uuid) from public, anon, authenticated;
revoke execute on function public.expiry_reconciliation_ok(uuid) from public, anon, authenticated;
revoke execute on function public.mark_overdue_corrective_actions() from public, anon, authenticated;
revoke execute on function public.sla_hours_for_severity(uuid, text) from public, anon, authenticated;
revoke execute on function public.count_org_master_setups(uuid) from public, anon, authenticated;
revoke execute on function public.can_org_add_master_setup(uuid) from public, anon, authenticated;
revoke execute on function public.org_has_plan_feature(uuid, text) from public, anon, authenticated;

-- 4. API-callable helpers that take an org id answer only for the caller's own orgs.
--    The original body keeps running under an internal name; service-role calls (no auth.uid()) pass.
alter function public.get_org_usage_summary(uuid) rename to get_org_usage_summary__impl;
revoke execute on function public.get_org_usage_summary__impl(uuid) from public, anon, authenticated;
create function public.get_org_usage_summary(p_org_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_org_member(p_org_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  return public.get_org_usage_summary__impl(p_org_id);
end $$;
revoke execute on function public.get_org_usage_summary(uuid) from public, anon;
grant execute on function public.get_org_usage_summary(uuid) to authenticated, service_role;

alter function public.direct_store_ids(uuid, uuid) rename to direct_store_ids__impl;
revoke execute on function public.direct_store_ids__impl(uuid, uuid) from public, anon, authenticated;
create function public.direct_store_ids(p_org_id uuid, p_user_id uuid default auth.uid())
returns uuid[] language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null or public.is_org_member(p_org_id)
    then public.direct_store_ids__impl(p_org_id, p_user_id) else '{}'::uuid[] end
$$;
revoke execute on function public.direct_store_ids(uuid, uuid) from public, anon;
grant execute on function public.direct_store_ids(uuid, uuid) to authenticated, service_role;

alter function public.inherited_store_ids(uuid, uuid) rename to inherited_store_ids__impl;
revoke execute on function public.inherited_store_ids__impl(uuid, uuid) from public, anon, authenticated;
create function public.inherited_store_ids(p_org_id uuid, p_user_id uuid default auth.uid())
returns uuid[] language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null or public.is_org_member(p_org_id)
    then public.inherited_store_ids__impl(p_org_id, p_user_id) else '{}'::uuid[] end
$$;
revoke execute on function public.inherited_store_ids(uuid, uuid) from public, anon;
grant execute on function public.inherited_store_ids(uuid, uuid) to authenticated, service_role;

alter function public.resolve_hierarchy_assignees(uuid, uuid, uuid, text) rename to resolve_hierarchy_assignees__impl;
revoke execute on function public.resolve_hierarchy_assignees__impl(uuid, uuid, uuid, text) from public, anon, authenticated;
create function public.resolve_hierarchy_assignees(p_org_id uuid, p_profile_id uuid, p_node_id uuid, p_level_key text default null)
returns table(user_id uuid, node_id uuid, node_name text, level_key text)
language sql stable security definer set search_path = public as $$
  select * from public.resolve_hierarchy_assignees__impl(p_org_id, p_profile_id, p_node_id, p_level_key)
  where auth.uid() is null or public.is_org_member(p_org_id)
$$;
revoke execute on function public.resolve_hierarchy_assignees(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.resolve_hierarchy_assignees(uuid, uuid, uuid, text) to authenticated, service_role;

alter function public.resolve_hierarchy_outlet_stores(uuid, uuid, uuid) rename to resolve_hierarchy_outlet_stores__impl;
revoke execute on function public.resolve_hierarchy_outlet_stores__impl(uuid, uuid, uuid) from public, anon, authenticated;
create function public.resolve_hierarchy_outlet_stores(p_org_id uuid, p_profile_id uuid, p_node_id uuid)
returns table(store_id uuid, node_id uuid, node_name text, level_key text, sales_rep_id uuid)
language sql stable security definer set search_path = public as $$
  select * from public.resolve_hierarchy_outlet_stores__impl(p_org_id, p_profile_id, p_node_id)
  where auth.uid() is null or public.is_org_member(p_org_id)
$$;
revoke execute on function public.resolve_hierarchy_outlet_stores(uuid, uuid, uuid) from public, anon;
grant execute on function public.resolve_hierarchy_outlet_stores(uuid, uuid, uuid) to authenticated, service_role;
