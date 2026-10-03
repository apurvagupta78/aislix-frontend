-- Several sign-in listeners (auth callback, root auth listener, other open tabs) can ask for a
-- first workspace at the same moment. A per-user advisory lock makes creation idempotent.
create or replace function public.ensure_first_workspace(p_name text, p_customer_type text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_name text := left(coalesce(nullif(btrim(p_name), ''), 'My workspace'), 120);
  v_type text := nullif(btrim(coalesce(p_customer_type, '')), '');
  v_slug text;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('first-workspace:' || v_uid::text, 0));

  select om.org_id into v_org
  from public.organization_members om
  where om.user_id = v_uid
    and om.status::text in ('active', 'invited')
  order by om.created_at
  limit 1;

  if v_org is not null then
    return v_org;
  end if;

  v_slug := left(btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-'), 40);
  v_slug := coalesce(nullif(v_slug, ''), 'workspace') || '-' || substr(md5(random()::text), 1, 5);

  insert into public.organizations (name, slug, owner_id, customer_type, industry)
  values (v_name, v_slug, v_uid, v_type, v_type)
  returning id into v_org;

  perform public.ensure_org_free_subscription(v_org);
  return v_org;
end;
$$;

revoke all on function public.ensure_first_workspace(text, text) from public, anon;
grant execute on function public.ensure_first_workspace(text, text) to authenticated;
