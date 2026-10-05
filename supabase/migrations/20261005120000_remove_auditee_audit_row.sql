-- Lets the auditee remove a row they added during an audit (manager-provided rows stay locked).
-- Deleting audit_responses directly is manager-only, so the checks live here.

create or replace function public.remove_audit_row(
  p_assignment_id uuid,
  p_section_key text,
  p_record_index integer
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid;
  v_assignee uuid;
  v_status text;
  v_template_id uuid;
  v_purpose jsonb;
  v_dataset jsonb;
  v_provided integer := 0;
  v_deleted integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in to change this audit.' using errcode = '42501';
  end if;

  select a.org_id, a.assignee_id, a.status, a.template_id, a.template_snapshot -> 'purpose_config'
    into v_org, v_assignee, v_status, v_template_id, v_purpose
  from scan_assignments a
  where a.id = p_assignment_id;

  if not found then
    raise exception 'Audit not found.' using errcode = 'P0002';
  end if;

  if v_assignee is distinct from auth.uid() and not is_org_manager(v_org) then
    raise exception 'Only the auditee or a manager can remove rows from this audit.' using errcode = '42501';
  end if;

  if v_status not in ('pending', 'in_progress') then
    raise exception 'This audit is no longer open, so rows cannot be removed.' using errcode = '42501';
  end if;

  if v_purpose is null and v_template_id is not null then
    select t.purpose_config into v_purpose from audit_templates t where t.id = v_template_id;
  end if;

  v_dataset := coalesce(v_purpose -> 'input_dataset', '{}'::jsonb);
  if jsonb_typeof(v_dataset -> 'packed_rows') = 'array' then
    v_provided := jsonb_array_length(v_dataset -> 'packed_rows');
  elsif jsonb_typeof(v_dataset -> 'rows') = 'array' then
    v_provided := jsonb_array_length(v_dataset -> 'rows');
  end if;

  if p_record_index is null or p_record_index < v_provided then
    raise exception 'Rows provided by the manager cannot be removed.' using errcode = '42501';
  end if;

  delete from audit_responses r
  where r.assignment_id = p_assignment_id
    and r.section_key = p_section_key
    and r.record_index = p_record_index;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

revoke all on function public.remove_audit_row(uuid, text, integer) from public, anon;
grant execute on function public.remove_audit_row(uuid, text, integer) to authenticated;
