-- Server-side photo rules. Every audit evidence photo is measured on the Aislix backend and checked
-- against the audit's photo rules again on the server; identical and near-identical photos are found
-- across the whole organisation. Rows are written by the server only (service role).
-- validate_audit_completion refuses submit while a photo is unchecked or refused, and, when the
-- manager turns it on, while the auditee is outside the store or a scanned barcode doesn't match.

create table if not exists public.evidence_photo_checks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  assignment_id uuid not null references public.scan_assignments(id) on delete cascade,
  ref text not null,
  storage_path text not null,
  sha256 text,
  dhash text,
  taken_at timestamptz,
  received_at timestamptz not null,
  width integer,
  height integer,
  brightness real,
  sharpness real,
  decodable boolean,
  status text not null check (status in ('passed', 'flagged', 'rejected', 'not_checked')),
  blocking boolean not null default false,
  issues jsonb not null default '[]'::jsonb,
  checked_by uuid,
  checked_at timestamptz not null default now(),
  unique (assignment_id, ref)
);

create index if not exists evidence_photo_checks_org_sha_idx on public.evidence_photo_checks (org_id, sha256);
create index if not exists evidence_photo_checks_org_received_idx on public.evidence_photo_checks (org_id, received_at);

alter table public.evidence_photo_checks enable row level security;

drop policy if exists evidence_photo_checks_select on public.evidence_photo_checks;
create policy evidence_photo_checks_select on public.evidence_photo_checks
  for select using (is_org_member(org_id));

-- Every audit-evidence photo an assignment's saved answers point to.
create or replace function public.audit_photo_refs(p_assignment_id uuid)
returns setof text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select distinct x.ref
  from audit_responses r
  cross join lateral (
    select e.v as ref
    from jsonb_array_elements_text(case when jsonb_typeof(r.value) = 'array' then r.value else '[]'::jsonb end) as e(v)
    union all
    select r.value #>> '{}' where jsonb_typeof(r.value) = 'string'
  ) x
  where r.assignment_id = p_assignment_id
    and x.ref like 'audit-evidence://%';
$function$;

-- Server facts for one photo: the audit's rules, when it was opened, when the photo arrived.
create or replace function public.evidence_photo_context(p_assignment_id uuid, p_path text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid;
  v_policy jsonb;
  v_created timestamptz;
  v_first_save timestamptz;
  v_received timestamptz;
  v_device text;
  v_zone text;
begin
  select a.org_id, coalesce(a.evidence_policy, a.template_snapshot -> 'evidence_policy', '{}'::jsonb), a.created_at
    into v_org, v_policy, v_created
  from scan_assignments a
  where a.id = p_assignment_id;
  if not found then
    return null;
  end if;

  select min(r.created_at) into v_first_save from audit_responses r where r.assignment_id = p_assignment_id;
  select o.created_at into v_received from storage.objects o where o.bucket_id = 'audit-evidence' and o.name = p_path;
  select r.value #>> '{}' into v_device
  from audit_responses r
  where r.assignment_id = p_assignment_id and r.section_key = 'audit_evidence' and r.field_key = 'device_metadata'
  limit 1;
  begin
    v_zone := nullif(v_device::jsonb ->> 'timezone', '');
  exception when others then
    v_zone := null;
  end;

  return jsonb_build_object(
    'org_id', v_org,
    'policy', v_policy,
    'opened_at', greatest(v_created, coalesce(v_first_save, v_created)),
    'received_at', v_received,
    'time_zone', v_zone
  );
end;
$function$;

-- Earlier, non-refused photos in the organisation that are the same file or look almost the same.
-- Photos that were removed from their audit don't count.
create or replace function public.evidence_photo_matches(
  p_org uuid,
  p_assignment_id uuid,
  p_ref text,
  p_sha256 text,
  p_dhash text,
  p_received_at timestamptz,
  p_max_distance integer default 5
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_dup_assignment uuid;
  v_similar integer := 0;
  v_similar_same boolean := false;
begin
  with earlier as (
    select c.*
    from evidence_photo_checks c
    where c.org_id = p_org
      and c.ref <> p_ref
      and not c.blocking
      and (c.received_at < p_received_at or (c.received_at = p_received_at and c.ref < p_ref))
      and exists (
        select 1 from audit_responses r
        where r.assignment_id = c.assignment_id
          and (r.value @> jsonb_build_array(c.ref) or r.value = to_jsonb(c.ref))
      )
  )
  select e.assignment_id into v_dup_assignment
  from earlier e
  where p_sha256 is not null and e.sha256 = p_sha256
  order by e.received_at
  limit 1;

  if p_dhash ~ '^[0-9a-f]{16}$' then
    select count(*), coalesce(bool_or(c.assignment_id = p_assignment_id), false)
      into v_similar, v_similar_same
    from evidence_photo_checks c
    where c.org_id = p_org
      and c.ref <> p_ref
      and not c.blocking
      and c.received_at <= p_received_at
      and c.dhash ~ '^[0-9a-f]{16}$'
      and bit_count(('x' || c.dhash)::bit(64) # ('x' || p_dhash)::bit(64)) <= p_max_distance
      and exists (
        select 1 from audit_responses r
        where r.assignment_id = c.assignment_id
          and (r.value @> jsonb_build_array(c.ref) or r.value = to_jsonb(c.ref))
      );
  end if;

  return jsonb_build_object(
    'duplicate', case when v_dup_assignment is null then null
                      else jsonb_build_object('same_audit', v_dup_assignment = p_assignment_id) end,
    'similar_count', v_similar,
    'similar_same_audit', v_similar_same
  );
end;
$function$;

-- Photos an assignment points to that the server hasn't checked yet.
create or replace function public.evidence_photo_unchecked(p_assignment_id uuid)
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(array_agg(p.ref order by p.ref), '{}')
  from audit_photo_refs(p_assignment_id) as p(ref)
  where not exists (
    select 1 from evidence_photo_checks c where c.assignment_id = p_assignment_id and c.ref = p.ref
  );
$function$;

revoke all on function public.audit_photo_refs(uuid) from public, anon, authenticated;
revoke all on function public.evidence_photo_context(uuid, text) from public, anon, authenticated;
revoke all on function public.evidence_photo_matches(uuid, uuid, text, text, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.evidence_photo_unchecked(uuid) from public, anon, authenticated;
grant execute on function public.audit_photo_refs(uuid) to service_role;
grant execute on function public.evidence_photo_context(uuid, text) to service_role;
grant execute on function public.evidence_photo_matches(uuid, uuid, text, text, text, timestamptz, integer) to service_role;
grant execute on function public.evidence_photo_unchecked(uuid) to service_role;

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
  v_unchecked_photos integer := 0;
  v_refused_photos integer := 0;
  v_gps jsonb;
  v_store_lat double precision;
  v_store_lng double precision;
  v_store_radius double precision;
  v_distance double precision;
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

  -- Every photo must have passed the server's photo rules (refused photos must be replaced).
  select count(*) filter (where c.id is null), count(*) filter (where c.blocking)
    into v_unchecked_photos, v_refused_photos
  from audit_photo_refs(p_assignment_id) as p(ref)
  left join evidence_photo_checks c on c.assignment_id = p_assignment_id and c.ref = p.ref;
  if v_unchecked_photos > 0 then
    v_missing_evidence := v_missing_evidence + v_unchecked_photos;
    v_issues := v_issues || jsonb_build_object('type', 'photo_unchecked', 'label', 'Photo check', 'count', v_unchecked_photos);
  end if;
  if v_refused_photos > 0 then
    v_missing_evidence := v_missing_evidence + v_refused_photos;
    v_issues := v_issues || jsonb_build_object('type', 'photo_refused', 'label', 'Photo rules', 'count', v_refused_photos);
  end if;

  if jsonb_array_length(v_proofs) = 0 and not v_require_rca and not v_is_csv
     and v_unchecked_photos = 0 and v_refused_photos = 0 then
    return jsonb_build_object('ok', true, 'missingRcaCount', 0, 'missingExpiryCoverageRecords', 0, 'missingEvidenceCount', 0, 'issues', '[]'::jsonb);
  end if;

  v_shelf_col := case when v_is_csv then nullif(v_purpose ->> 'shelfColumnId', '') end;
  v_barcode_col := coalesce(
    case when v_is_csv then nullif(v_purpose ->> 'barcodeColumnId', '') end,
    (
      select c.col ->> 'id'
      from jsonb_array_elements(
        case when jsonb_typeof(v_purpose -> 'input_dataset' -> 'columns') = 'array'
             then v_purpose -> 'input_dataset' -> 'columns' else '[]'::jsonb end
      ) with ordinality as c(col, ord)
      where coalesce(c.col ->> 'id', '') ~* '(barcode|ean|upc|gtin)'
         or coalesce(c.col ->> 'name', '') ~* '(barcode|ean|upc|gtin)'
      order by c.ord
      limit 1
    )
  );

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

  -- Product rows: every row of the file, plus every row the auditee saved (template audits, and
  -- file audits with no rows from the manager, where the auditee adds the rows).
  if v_section is not null then
    select coalesce(array_agg(distinct i order by i), '{}') into v_row_indexes
    from (
      select generate_series(0, v_dataset_rows - 1) as i
      union
      select r.record_index
      from audit_responses r
      where (not v_is_csv or v_dataset_rows = 0)
        and r.assignment_id = p_assignment_id and r.section_key = v_section
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

    if coalesce((v_policy ->> 'blockBarcodeMismatch')::boolean, false) and v_barcode_col is not null then
      select count(*) into v_n
      from unnest(v_row_indexes) as i
      join audit_responses s
        on s.assignment_id = p_assignment_id and s.section_key = v_section
       and s.record_index = i and s.field_key = 'barcode_scan'
      where i < v_dataset_rows
        and nullif(btrim(v_rows -> i -> 'values' ->> v_barcode_col), '') is not null
        and nullif(btrim(s.value #>> '{}'), '') is not null
        and lower(regexp_replace(v_rows -> i -> 'values' ->> v_barcode_col, '\s', '', 'g'))
            <> lower(regexp_replace(s.value #>> '{}', '\s', '', 'g'));
      if v_n > 0 then
        v_missing_evidence := v_missing_evidence + v_n;
        v_issues := v_issues || jsonb_build_object('type', 'barcode_mismatch', 'label', 'Barcode match', 'count', v_n);
      end if;
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

  -- In-store check: the saved location must be within the store's radius (plus GPS accuracy, max 150 m).
  if v_proofs ? 'gps' and coalesce((v_policy ->> 'blockOutsideStore')::boolean, false) then
    select g.value into v_gps
    from audit_responses g
    where g.assignment_id = p_assignment_id and g.section_key = 'audit_evidence'
      and g.record_index = 0 and g.field_key = 'gps'
    limit 1;
    if v_gps is not null and jsonb_typeof(v_gps) = 'string' then
      begin
        v_gps := (v_gps #>> '{}')::jsonb;
      exception when others then
        v_gps := null;
      end;
    end if;
    select s.latitude::double precision, s.longitude::double precision,
           coalesce(nullif(s.geofence_radius_m, 0), 200)::double precision
      into v_store_lat, v_store_lng, v_store_radius
    from scan_assignments a
    join stores s on s.id = a.store_id
    where a.id = p_assignment_id;
    if jsonb_typeof(v_gps) = 'object'
       and jsonb_typeof(v_gps -> 'lat') = 'number' and jsonb_typeof(v_gps -> 'lng') = 'number'
       and v_store_lat is not null and v_store_lng is not null then
      v_distance := 2 * 6371000 * asin(sqrt(
        power(sin(radians(((v_gps ->> 'lat')::double precision) - v_store_lat) / 2), 2)
        + cos(radians(v_store_lat)) * cos(radians((v_gps ->> 'lat')::double precision))
          * power(sin(radians(((v_gps ->> 'lng')::double precision) - v_store_lng) / 2), 2)
      ));
      if v_distance > v_store_radius + least(150, greatest(0, coalesce(
           case when jsonb_typeof(v_gps -> 'accuracyM') = 'number' then (v_gps ->> 'accuracyM')::double precision end, 0))) then
        v_missing_evidence := v_missing_evidence + 1;
        v_issues := v_issues || jsonb_build_object(
          'type', 'outside_store', 'label', 'In-store location', 'count', 1,
          'distanceM', round(v_distance::numeric), 'radiusM', round(v_store_radius::numeric)
        );
      end if;
    end if;
  end if;

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

