-- Plan, usage and billing period are server-managed. Customers may only toggle renewal,
-- and a subscription created from the browser is always the Free plan.
revoke insert, update, delete on table public.subscriptions from anon;
revoke update on table public.subscriptions from authenticated;
grant update (cancel_at_period_end) on table public.subscriptions to authenticated;

create or replace function public.force_free_plan_on_client_subscription_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.plan_id := (select id from public.subscription_plans where code = 'free' limit 1);
    new.status := 'active';
    new.cycle := 'monthly';
    new.current_period_start := now();
    new.current_period_end := null;
    new.scans_used := 0;
    new.cancel_at_period_end := false;
    new.provider := null;
    new.provider_subscription_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_client_insert_free_only on public.subscriptions;
create trigger subscriptions_client_insert_free_only
  before insert on public.subscriptions
  for each row execute function public.force_free_plan_on_client_subscription_insert();
