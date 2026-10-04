-- Evidence: Minimum Evidences on every photo requirement, row photos + barcode on template audits,
-- and the review requirement enforced on approvals.
--
-- validate_audit_completion:
--   * Minimum Evidences (evidence_policy.minimumPhotos) applies to every photo requirement:
--     contextual, per shelf, before/after, row photos, quarantine and sealed container.
--   * Template audits (not only uploaded files) check row photos: the first visible photo field of the
--     repeatable section, required on every row (field required / Per-row photo) or on rows with a
--     difference (Per-variance photo).
--   * Barcode scan: every product row needs a scan (the file's barcode column, when set, is only
--     used to check the scan).
-- audit_approvals:
--   * New action 'received' (Supervisor receipt).
--   * Guard trigger: reviewer is always the caller; Independent reviewer audits can only be
--     approved / flagged / rejected by the chosen reviewer; Supervisor receipt audits only accept
--     'received' (or 'reopened').

create or replace function public.audit_response_count(
  p_assignment_id uuid,
  p_section text,
  p_record_index integer,
  p_field text
) returns integer
language sql
stable
set search_path to 'public'
as $$
  select coalesce(max(
    case
      when jsonb_typeof(r.value) = 'array' then (
        select count(*)::integer from jsonb_array_elements_text(r.value) e(v) where btrim(e.v) <> ''
      )
      when jsonb_typeof(r.value) = 'string' and length(btrim(r.value #>> '{}')) > 0 then 1
      else 0
    end
  ), 0)
  from audit_responses r
  where r.assignment_id = p_assignment_id
    and r.section_key = p_section
    and r.record_index = p_record_index
    and r.field_key = p_field;
$$;

revoke execute on function public.audit_response_count(uuid, text, integer, text) from public, anon, authenticated;

create or replace function public.validate_audit_completion(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid;
  v_template_id uuid;
  v_policy jsonb;
  v_require_rca boolean;
  v_snapshot jsonb;
  v_purpose jsonb;
  v_sections jsonb;
  v_fields jsonb;
  v_is_csv boolean;
  v_proofs jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_dataset_rows integer := 0;
  v_row_indexes integer[] := '{}';
  v_section text;
  v_row_mode text := 'off';
  v_photo_key text;
  v_photo_required boolean := false;
  v_field_min integer := 0;
  v_min integer := 1;
  v_row_min integer := 1;
  v_shelf_col text;
  v_barcode_col text;
  v_shelf_idx integer;
  v_barcode_idx integer;
  v_issues jsonb := '[]'::jsonb;
  v_missing_evidence integer := 0;
  v_missing_rca integer := 0;
  v_n integer;
  v_need integer;
  v_slots text[];
  v_single record;
begin
  if p_assignment_id is null then
    return jsonb_build_object(
      'ok', false, 'missingRcaCount', 0, 'missingExpiryCoverageRecords', 0, 'missingEvidenceCount', 0,
      'issues', jsonb_build_array(jsonb_build_object('type', 'missing_assignment'))
    );
  end if;

  select a.org_id, a.template_id, a.evidence_policy, coalesce(a.require_rca, false), coalesce(a.template_snapshot, '{}'::jsonb)
    into v_org, v_template_id, v_policy, v_require_rca, v_snapshot
  from scan_assignments a
  where a.id = p_assignment_id;

  if not found then
    return jsonb_build_object(
      'ok', false, 'missingRcaCount', 0, 'missingExpiryCoverageRecords', 0, 'missingEvidenceCount', 0,
      'issues', jsonb_build_array(jsonb_build_object('type', 'missing_assignment'))
    );
  end if;

  if auth.uid() is not null and not exists (
    select 1 from organization_members m
    where m.org_id = v_org and m.user_id = auth.uid() and m.status = 'active'
  ) then
    return jsonb_build_object(
      'ok', false, 'missingRcaCount', 0, 'missingExpiryCoverageRecords', 0, 'missingEvidenceCount', 0,
      'issues', jsonb_build_array(jsonb_build_object('type', 'forbidden'))
    );
  end if;

  v_purpose := coalesce(v_snapshot -> 'purpose_config', '{}'::jsonb);
  v_is_csv := coalesce(v_purpose ->> 'source', '') = 'digital_csv_audit';
  v_policy := coalesce(v_policy, v_snapshot -> 'evidence_policy', '{}'::jsonb);
  v_proofs := case when jsonb_typeof(v_policy -> 'requiredProof') = 'array' then v_policy -> 'requiredProof' else '[]'::jsonb end;
  v_min := greatest(1, case when (v_policy ->> 'minimumPhotos') ~ '^\d+(\.\d+)?$' then round((v_policy ->> 'minimumPhotos')::numeric)::integer else 1 end);

  if jsonb_array_length(v_proofs) = 0 and not v_require_rca and not v_is_csv then
    return jsonb_build_object('ok', true, 'missingRcaCount', 0, 'missingExpiryCoverageRecords', 0, 'missingEvidenceCount', 0, 'issues', '[]'::jsonb);
  end if;

  v_shelf_col := case when v_is_csv then nullif(v_purpose ->> 'shelfColumnId', '') end;
  v_barcode_col := case when v_is_csv then nullif(v_purpose ->> 'barcodeColumnId', '') end;

  if v_is_csv then
    v_section := coalesce(nullif(v_purpose -> 'inputSchema' ->> 'sectionKey', ''), 'records');
  else
    v_sections := v_snapshot -> 'sections';
    if jsonb_typeof(v_sections) is distinct from 'array' and v_template_id is not null then
      select t.sections into v_sections from audit_templates t where t.id = v_template_id;
    end if;
    if jsonb_typeof(v_sections) = 'array' then
      select s ->> 'key' into v_section
      from jsonb_array_elements(v_sections) with ordinality as e(s, ord)
      where coalesce((s ->> 'repeatable')::boolean, false)
      order by coalesce((s ->> 'order')::integer, e.ord::integer)
      limit 1;
    end if;
  end if;

  -- Rows of the uploaded file (shelf / barcode values kept for the per-shelf checks).
  if jsonb_typeof(v_purpose -> 'input_dataset' -> 'packed_rows') = 'array' then
    select (c.ord - 1)::integer into v_shelf_idx
    from jsonb_array_elements(v_purpose -> 'input_dataset' -> 'columns') with ordinality as c(col, ord)
    where c.col ->> 'id' = v_shelf_col;
    select (c.ord - 1)::integer into v_barcode_idx
    from jsonb_array_elements(v_purpose -> 'input_dataset' -> 'columns') with ordinality as c(col, ord)
    where c.col ->> 'id' = v_barcode_col;
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'values',
          jsonb_build_object(
            coalesce(v_shelf_col, '__shelf'), p.cells ->> v_shelf_idx,
            coalesce(v_barcode_col, '__barcode'), p.cells ->> v_barcode_idx
          )
        )
        order by p.ord
      ),
      '[]'::jsonb
    )
      into v_rows
    from jsonb_array_elements(v_purpose -> 'input_dataset' -> 'packed_rows') with ordinality as p(cells, ord);
  elsif jsonb_typeof(v_purpose -> 'input_dataset' -> 'rows') = 'array' then
    v_rows := v_purpose -> 'input_dataset' -> 'rows';
  end if;
  v_dataset_rows := jsonb_array_length(v_rows);

  -- Product rows: every row of the file, plus (template audits) every row the auditee saved.
  if v_section is not null then
    select coalesce(array_agg(distinct i order by i), '{}') into v_row_indexes
    from (
      select generate_series(0, v_dataset_rows - 1) as i
      union
      select r.record_index
      from audit_responses r
      where not v_is_csv and r.assignment_id = p_assignment_id and r.section_key = v_section
    ) rows_union;
  end if;

  -- Row photo rule.
  if v_is_csv then
    v_row_mode := coalesce(v_purpose ->> 'rowEvidence', 'off');
    v_photo_key := 'evidence_photo';
  elsif v_section is not null then
    v_fields := v_snapshot -> 'field_definitions';
    if jsonb_typeof(v_fields) is distinct from 'array' and v_template_id is not null then
      select t.field_definitions into v_fields from audit_templates t where t.id = v_template_id;
    end if;
    if jsonb_typeof(v_fields) = 'array' then
      select f ->> 'key',
             coalesce((f ->> 'required')::boolean, false),
             case when (f -> 'config' ->> 'minImages') ~ '^\d+$' then (f -> 'config' ->> 'minImages')::integer else 0 end
        into v_photo_key, v_photo_required, v_field_min
      from jsonb_array_elements(v_fields) with ordinality as e(f, ord)
      where f ->> 'section' = v_section
        and f ->> 'type' in ('single_image', 'multiple_images', 'before_after_images')
        and not coalesce((f ->> 'system')::boolean, false)
        and coalesce(f -> 'config' ->> 'visible', 'true') <> 'false'
      order by e.ord
      limit 1;
    end if;
    if v_photo_key is not null then
      if (v_purpose ->> 'rowEvidence') in ('required', 'on_mismatch', 'optional', 'off') then
        v_row_mode := v_purpose ->> 'rowEvidence';
      elsif v_photo_required or v_proofs ? 'per_sku_photo' then
        v_row_mode := 'required';
      elsif v_proofs ? 'variance_photo' then
        v_row_mode := 'on_mismatch';
      else
        v_row_mode := 'optional';
      end if;
    end if;
  end if;
  v_row_min := greatest(v_min, coalesce(v_field_min, 0), 1);

  -- Row photos: enough photos on every row, or on every row with a difference.
  if v_row_mode = 'required' then
    select count(*) into v_n
    from unnest(v_row_indexes) as i
    where audit_response_count(p_assignment_id, v_section, i, v_photo_key) < v_row_min;
  elsif v_row_mode = 'on_mismatch' then
    select count(*) into v_n
    from unnest(v_row_indexes) as i
    where (
        exists (
          select 1 from audit_responses v
          where v.assignment_id = p_assignment_id and v.section_key = v_section
            and v.record_index = i and v.field_key = 'row_variance' and v.value = 'true'::jsonb
        )
        and audit_response_count(p_assignment_id, v_section, i, v_photo_key) < v_row_min
      )
      or exists (
        select 1 from audit_responses s
        where s.assignment_id = p_assignment_id and s.section_key = v_section
          and s.record_index = i and s.field_key = 'evidence_status' and s.value ->> 0 = 'missing'
      );
  else
    v_n := 0;
  end if;
  if v_n > 0 then
    v_missing_evidence := v_missing_evidence + v_n;
    v_issues := v_issues || jsonb_build_object('type', 'row_photo', 'label', 'Row photos', 'count', v_n, 'minimum', v_row_min);
  end if;

  -- Evidence per shelf and Before and after: one slot per distinct shelf, or one for the audit.
  if v_proofs ? 'shelf_photo' or v_proofs ? 'before_after' then
    v_slots := '{}'::text[];
    if v_shelf_col is not null then
      select coalesce(array_agg(distinct lower(btrim(r -> 'values' ->> v_shelf_col))), '{}'::text[])
        into v_slots
      from jsonb_array_elements(v_rows) r
      where btrim(coalesce(r -> 'values' ->> v_shelf_col, '')) <> '';
    end if;
    if cardinality(v_slots) = 0 then
      v_slots := array[''];
    end if;

    if v_proofs ? 'shelf_photo' then
      select count(*) into v_n
      from unnest(v_slots) as s(name)
      where not exists (
        select 1
        from audit_responses sh
        where sh.assignment_id = p_assignment_id
          and sh.section_key = 'shelf_evidence'
          and sh.field_key = 'shelf'
          and lower(btrim(coalesce(sh.value #>> '{}', ''))) = s.name
          and audit_response_count(p_assignment_id, 'shelf_evidence', sh.record_index, 'shelf_photo') >= v_min
      );
      if v_n > 0 then
        v_missing_evidence := v_missing_evidence + v_n;
        v_issues := v_issues || jsonb_build_object('type', 'shelf_photo', 'label', 'Evidence per shelf', 'count', v_n, 'minimum', v_min);
      end if;
    end if;

    if v_proofs ? 'before_after' then
      select count(*) into v_n
      from unnest(v_slots) as s(name)
      where not exists (
        select 1
        from audit_responses sh
        where sh.assignment_id = p_assignment_id
          and sh.section_key = 'shelf_evidence'
          and sh.field_key = 'shelf'
          and lower(btrim(coalesce(sh.value #>> '{}', ''))) = s.name
          and audit_response_count(p_assignment_id, 'shelf_evidence', sh.record_index, 'shelf_photo') >= v_min
          and audit_response_count(p_assignment_id, 'shelf_evidence', sh.record_index, 'after_photo') >= v_min
      );
      if v_n > 0 then
        v_missing_evidence := v_missing_evidence + v_n;
        v_issues := v_issues || jsonb_build_object('type', 'before_after', 'label', 'Before and after', 'count', v_n, 'minimum', v_min);
      end if;
    end if;
  end if;

  -- Barcode scan on every product row.
  if v_proofs ? 'barcode' and v_section is not null then
    select count(*) into v_n
    from unnest(v_row_indexes) as i
    where not audit_response_present(p_assignment_id, v_section, i, 'barcode_scan');
    if v_n > 0 then
      v_missing_evidence := v_missing_evidence + v_n;
      v_issues := v_issues || jsonb_build_object('type', 'barcode', 'label', 'Barcode scan', 'count', v_n);
    end if;
  end if;

  -- Expiry dates: photo + date on every row; expired rows removed with a photo.
  if v_proofs ? 'expiry_date' and v_section is not null then
    select count(*) into v_n
    from unnest(v_row_indexes) as i
    where not audit_response_present(p_assignment_id, v_section, i, 'expiry_scan_photo')
       or not audit_response_present(p_assignment_id, v_section, i, 'expiry_scan_date');
    if v_n > 0 then
      v_missing_evidence := v_missing_evidence + v_n;
      v_issues := v_issues || jsonb_build_object('type', 'expiry_date', 'label', 'Expiry dates', 'count', v_n);
    end if;

    select count(*) into v_n
    from audit_responses d
    where d.assignment_id = p_assignment_id
      and d.section_key = v_section
      and d.field_key = 'expiry_scan_date'
      and d.record_index = any (v_row_indexes)
      and (
        coalesce(safe_iso_date(d.value #>> '{}') < current_date, false)
        or exists (
          select 1 from audit_responses s
          where s.assignment_id = p_assignment_id and s.section_key = v_section
            and s.record_index = d.record_index and s.field_key = 'expiry_scan_status'
            and s.value #>> '{}' = 'expired'
        )
      )
      and (
        not exists (
          select 1 from audit_responses rm
          where rm.assignment_id = p_assignment_id and rm.section_key = v_section
            and rm.record_index = d.record_index and rm.field_key = 'expiry_removed'
            and rm.value = 'true'::jsonb
        )
        or not audit_response_present(p_assignment_id, v_section, d.record_index, 'expiry_removal_photo')
      );
    if v_n > 0 then
      v_missing_evidence := v_missing_evidence + v_n;
      v_issues := v_issues || jsonb_build_object('type', 'expired_removal', 'label', 'Expired items removed', 'count', v_n);
    end if;
  end if;

  -- Audit-wide proofs (photos need Minimum Evidences; video and GPS need one).
  for v_single in
    select * from (values
      ('context_photo', 'context_photo', 'Contextual shelf photo', true),
      ('live_session_video', 'session_video', 'Session video', false),
      ('quarantine_contents', 'quarantine_contents', 'Quarantine contents', true),
      ('sealed_container', 'sealed_container', 'Sealed container', true),
      ('gps', 'gps', 'GPS location', false)
    ) as t(proof, field, label, is_photo)
  loop
    v_need := 1;
    if v_single.is_photo then
      v_need := v_min;
    end if;
    if v_proofs ? v_single.proof
       and audit_response_count(p_assignment_id, 'audit_evidence', 0, v_single.field) < v_need then
      v_missing_evidence := v_missing_evidence + 1;
      v_issues := v_issues || jsonb_build_object(
        'type', v_single.proof, 'label', v_single.label, 'count', 1, 'minimum', v_need
      );
    end if;
  end loop;

  -- Explanation for every difference.
  if v_require_rca and v_section is not null then
    select count(*) into v_missing_rca
    from audit_responses v
    where v.assignment_id = p_assignment_id
      and v.section_key = v_section
      and v.field_key = 'row_variance'
      and v.value = 'true'::jsonb
      and (
        not audit_response_present(p_assignment_id, v_section, v.record_index, 'variance_reason')
        or (
          exists (
            select 1 from audit_responses rr
            where rr.assignment_id = p_assignment_id
              and rr.section_key = v_section
              and rr.record_index = v.record_index
              and rr.field_key = 'variance_reason'
              and rr.value #>> '{}' = 'other'
          )
          and not audit_response_present(p_assignment_id, v_section, v.record_index, 'variance_note')
        )
      );
    if v_missing_rca > 0 then
      v_issues := v_issues || jsonb_build_object('type', 'variance_explanation', 'label', 'Explanation for every difference', 'count', v_missing_rca);
    end if;
  end if;

  return jsonb_build_object(
    'ok', v_missing_evidence = 0 and v_missing_rca = 0,
    'missingRcaCount', v_missing_rca,
    'missingExpiryCoverageRecords', 0,
    'missingEvidenceCount', v_missing_evidence,
    'issues', v_issues
  );
end;
$function$;

revoke execute on function public.validate_audit_completion(uuid) from public, anon;
grant execute on function public.validate_audit_completion(uuid) to authenticated, service_role;

alter table public.audit_approvals drop constraint if exists audit_approvals_action_check;
alter table public.audit_approvals add constraint audit_approvals_action_check
  check (action = any (array['approved', 'rejected', 'flagged', 'reopened', 'received']));

create or replace function public.guard_audit_approval()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_mode text;
  v_reviewer uuid;
begin
  if auth.uid() is not null then
    new.reviewer_id := auth.uid();
  end if;
  if new.assignment_id is null then
    return new;
  end if;

  select coalesce(a.evidence_policy ->> 'reviewMode', 'manager'), a.reviewer_id
    into v_mode, v_reviewer
  from scan_assignments a
  where a.id = new.assignment_id;

  if v_mode = 'supervisor_receipt' and new.action not in ('received', 'reopened') then
    raise exception 'This audit only needs a supervisor to confirm receipt — it can''t be approved, flagged or rejected.'
      using errcode = 'P0001';
  end if;
  if new.action = 'received' and v_mode is distinct from 'supervisor_receipt' then
    raise exception 'Confirm receipt is only for audits that need a supervisor receipt.'
      using errcode = 'P0001';
  end if;
  if v_mode = 'independent' and v_reviewer is not null and auth.uid() is not null
     and new.action in ('approved', 'rejected', 'flagged') and auth.uid() <> v_reviewer then
    raise exception 'Only the independent reviewer chosen for this audit can approve, flag or reject it.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_audit_approval on public.audit_approvals;
create trigger guard_audit_approval
  before insert on public.audit_approvals
  for each row execute function public.guard_audit_approval();
