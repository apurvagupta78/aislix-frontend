-- Real server-side completion check for spreadsheet Digital Audits (purpose_config.source =
-- 'digital_csv_audit'). Mirrors evaluateGridEvidence in src/lib/audit-engine/grid-evidence.ts.
-- Other audit types keep returning ok; their checks stay in the app.

create or replace function public.audit_response_present(
  p_assignment_id uuid,
  p_section text,
  p_record_index integer,
  p_field text
) returns boolean
language sql
stable
set search_path to 'public'
as $$
  select exists (
    select 1
    from audit_responses r
    where r.assignment_id = p_assignment_id
      and r.section_key = p_section
      and r.record_index = p_record_index
      and r.field_key = p_field
      and (
        (jsonb_typeof(r.value) = 'array' and jsonb_array_length(r.value) > 0)
        or (jsonb_typeof(r.value) = 'string' and length(btrim(r.value #>> '{}')) > 0)
      )
  );
$$;

revoke execute on function public.audit_response_present(uuid, text, integer, text) from public, anon, authenticated;

create or replace function public.validate_audit_completion(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid;
  v_policy jsonb;
  v_require_rca boolean;
  v_snapshot jsonb;
  v_purpose jsonb;
  v_proofs jsonb;
  v_rows jsonb;
  v_section text;
  v_row_mode text;
  v_shelf_col text;
  v_barcode_col text;
  v_issues jsonb := '[]'::jsonb;
  v_missing_evidence integer := 0;
  v_missing_rca integer := 0;
  v_n integer;
  v_slots text[];
  v_single record;
begin
  if p_assignment_id is null then
    return jsonb_build_object(
      'ok', false,
      'missingRcaCount', 0,
      'missingExpiryCoverageRecords', 0,
      'missingEvidenceCount', 0,
      'issues', jsonb_build_array(jsonb_build_object('type', 'missing_assignment'))
    );
  end if;

  select a.org_id, a.evidence_policy, coalesce(a.require_rca, false), coalesce(a.template_snapshot, '{}'::jsonb)
    into v_org, v_policy, v_require_rca, v_snapshot
  from scan_assignments a
  where a.id = p_assignment_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'missingRcaCount', 0,
      'missingExpiryCoverageRecords', 0,
      'missingEvidenceCount', 0,
      'issues', jsonb_build_array(jsonb_build_object('type', 'missing_assignment'))
    );
  end if;

  if auth.uid() is not null and not exists (
    select 1 from organization_members m
    where m.org_id = v_org and m.user_id = auth.uid() and m.status = 'active'
  ) then
    return jsonb_build_object(
      'ok', false,
      'missingRcaCount', 0,
      'missingExpiryCoverageRecords', 0,
      'missingEvidenceCount', 0,
      'issues', jsonb_build_array(jsonb_build_object('type', 'forbidden'))
    );
  end if;

  v_purpose := coalesce(v_snapshot -> 'purpose_config', '{}'::jsonb);
  if coalesce(v_purpose ->> 'source', '') <> 'digital_csv_audit' then
    return jsonb_build_object(
      'ok', true,
      'missingRcaCount', 0,
      'missingExpiryCoverageRecords', 0,
      'missingEvidenceCount', 0,
      'issues', '[]'::jsonb
    );
  end if;

  v_policy := coalesce(v_policy, v_snapshot -> 'evidence_policy', '{}'::jsonb);
  v_proofs := case when jsonb_typeof(v_policy -> 'requiredProof') = 'array' then v_policy -> 'requiredProof' else '[]'::jsonb end;
  v_rows := case when jsonb_typeof(v_purpose -> 'input_dataset' -> 'rows') = 'array' then v_purpose -> 'input_dataset' -> 'rows' else '[]'::jsonb end;
  v_section := coalesce(nullif(v_purpose -> 'inputSchema' ->> 'sectionKey', ''), 'records');
  v_row_mode := coalesce(v_purpose ->> 'rowEvidence', 'off');
  v_shelf_col := nullif(v_purpose ->> 'shelfColumnId', '');
  v_barcode_col := nullif(v_purpose ->> 'barcodeColumnId', '');

  -- Row photos (Per-row photo / Per-variance photo).
  if v_row_mode = 'required' then
    select count(*) into v_n
    from generate_series(0, jsonb_array_length(v_rows) - 1) as i
    where not audit_response_present(p_assignment_id, v_section, i, 'evidence_photo');
  elsif v_row_mode = 'on_mismatch' then
    select count(*) into v_n
    from audit_responses r
    where r.assignment_id = p_assignment_id
      and r.section_key = v_section
      and r.field_key = 'evidence_status'
      and r.value ->> 0 = 'missing';
  else
    v_n := 0;
  end if;
  if v_n > 0 then
    v_missing_evidence := v_missing_evidence + v_n;
    v_issues := v_issues || jsonb_build_object('type', 'row_photo', 'label', 'Row photos', 'count', v_n);
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
          and audit_response_present(p_assignment_id, 'shelf_evidence', sh.record_index, 'shelf_photo')
      );
      if v_n > 0 then
        v_missing_evidence := v_missing_evidence + v_n;
        v_issues := v_issues || jsonb_build_object('type', 'shelf_photo', 'label', 'Evidence per shelf', 'count', v_n);
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
          and audit_response_present(p_assignment_id, 'shelf_evidence', sh.record_index, 'shelf_photo')
          and audit_response_present(p_assignment_id, 'shelf_evidence', sh.record_index, 'after_photo')
      );
      if v_n > 0 then
        v_missing_evidence := v_missing_evidence + v_n;
        v_issues := v_issues || jsonb_build_object('type', 'before_after', 'label', 'Before and after', 'count', v_n);
      end if;
    end if;
  end if;

  -- Barcode scan on every row that has a barcode in the file.
  if v_proofs ? 'barcode' and v_barcode_col is not null then
    select count(*) into v_n
    from jsonb_array_elements(v_rows) with ordinality as r(row_value, ord)
    where btrim(coalesce(r.row_value -> 'values' ->> v_barcode_col, '')) <> ''
      and not audit_response_present(p_assignment_id, v_section, (r.ord - 1)::integer, 'barcode_scan');
    if v_n > 0 then
      v_missing_evidence := v_missing_evidence + v_n;
      v_issues := v_issues || jsonb_build_object('type', 'barcode', 'label', 'Barcode scan', 'count', v_n);
    end if;
  end if;

  -- Audit-wide proofs.
  for v_single in
    select * from (values
      ('context_photo', 'context_photo', 'Contextual shelf photo'),
      ('live_session_video', 'session_video', 'Session video'),
      ('quarantine_contents', 'quarantine_contents', 'Quarantine contents'),
      ('sealed_container', 'sealed_container', 'Sealed container'),
      ('gps', 'gps', 'GPS location')
    ) as t(proof, field, label)
  loop
    if v_proofs ? v_single.proof
       and not audit_response_present(p_assignment_id, 'audit_evidence', 0, v_single.field) then
      v_missing_evidence := v_missing_evidence + 1;
      v_issues := v_issues || jsonb_build_object('type', v_single.proof, 'label', v_single.label, 'count', 1);
    end if;
  end loop;

  -- Explanation for every difference.
  if v_require_rca then
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
