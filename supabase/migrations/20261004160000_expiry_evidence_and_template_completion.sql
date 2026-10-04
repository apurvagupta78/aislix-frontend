-- Expiry dates evidence + evidence checks for every template audit (not only uploaded files).
--
-- validate_audit_completion:
--   * Audit-wide proofs (context photo, video, quarantine, sealed, GPS, shelf photos) now apply to
--     every digital audit with an evidence policy, not just 'digital_csv_audit'.
--   * Expiry dates: every row needs expiry_scan_photo + expiry_scan_date; an expired row
--     (saved status 'expired' or date before today) needs expiry_removed = true + expiry_removal_photo.
-- sync_findings_for_scan: expired / near-expiry rows become findings (source_type 'expiry_check').

create or replace function public.safe_iso_date(p text)
returns date
language plpgsql
immutable
as $function$
begin
  if p ~ '^\d{4}-\d{2}-\d{2}$' then
    return p::date;
  end if;
  return null;
exception when others then
  return null;
end;
$function$;

alter table public.findings drop constraint if exists findings_source_type_check;
alter table public.findings add constraint findings_source_type_check
  check (source_type = any (array['digital_variance', 'planogram_line', 'manual', 'ai_suggested', 'expiry_check']));

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
  v_is_csv boolean;
  v_proofs jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_section text;
  v_row_mode text;
  v_shelf_col text;
  v_barcode_col text;
  v_shelf_idx integer;
  v_barcode_idx integer;
  v_issues jsonb := '[]'::jsonb;
  v_missing_evidence integer := 0;
  v_missing_rca integer := 0;
  v_n integer;
  v_slots text[];
  v_single record;
  v_expiry_rows integer[];
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

  if jsonb_array_length(v_proofs) = 0 and not v_require_rca and not v_is_csv then
    return jsonb_build_object('ok', true, 'missingRcaCount', 0, 'missingExpiryCoverageRecords', 0, 'missingEvidenceCount', 0, 'issues', '[]'::jsonb);
  end if;

  v_row_mode := case when v_is_csv then coalesce(v_purpose ->> 'rowEvidence', 'off') else 'off' end;
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

  if v_is_csv then
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
    else
      v_rows := case when jsonb_typeof(v_purpose -> 'input_dataset' -> 'rows') = 'array' then v_purpose -> 'input_dataset' -> 'rows' else '[]'::jsonb end;
    end if;
  end if;

  -- Row photos (Per-row photo / Per-variance photo) for uploaded-file audits.
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

  -- Expiry dates: photo + date on every row; expired rows removed with a photo.
  if v_proofs ? 'expiry_date' and v_section is not null then
    if v_is_csv then
      select coalesce(array_agg(i), '{}') into v_expiry_rows
      from generate_series(0, jsonb_array_length(v_rows) - 1) as i;
    else
      select coalesce(array_agg(distinct r.record_index), '{}') into v_expiry_rows
      from audit_responses r
      where r.assignment_id = p_assignment_id and r.section_key = v_section;
    end if;

    select count(*) into v_n
    from unnest(v_expiry_rows) as i
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
      and d.record_index = any (v_expiry_rows)
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

CREATE OR REPLACE FUNCTION public.sync_findings_for_scan(p_scan_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  scan_row public.shelf_scans%ROWTYPE;
  origin TEXT;
  inserted INT := 0;
  line RECORD;
  cmp RECORD;
  ex_row RECORD;
  f_type TEXT;
  f_sev TEXT;
  f_title TEXT;
  v_status TEXT;
BEGIN
  SELECT * INTO scan_row FROM public.shelf_scans WHERE id = p_scan_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  origin := CASE COALESCE(scan_row.audit_mode, 'ai')
    WHEN 'ai_assisted' THEN 'ai_assisted'
    WHEN 'digital' THEN 'digital'
    ELSE 'ai'
  END;

  FOR line IN
    SELECT *
    FROM public.digital_audit_lines
    WHERE scan_id = p_scan_id
      AND actual_qty IS NOT NULL
      AND variance_qty IS NOT NULL
      AND variance_qty <> 0
  LOOP
    IF line.actual_qty = 0 AND line.expected_qty > 0 THEN
      f_type := 'out_of_stock';
      f_title := 'Out of stock';
    ELSIF line.variance_qty < 0 THEN
      f_type := 'inventory_shortage';
      f_title := 'Inventory shortage';
    ELSE
      f_type := 'inventory_excess';
      f_title := 'Inventory excess';
    END IF;

    f_sev := CASE
      WHEN line.actual_qty = 0 AND line.expected_qty > 0 THEN 'critical'
      WHEN abs(COALESCE(line.variance_value_inr, 0)) >= 10000 THEN 'critical'
      WHEN abs(COALESCE(line.variance_qty, 0)) >= 10 THEN 'high'
      WHEN abs(COALESCE(line.variance_qty, 0)) >= 3 THEN 'medium'
      ELSE 'low'
    END;

    INSERT INTO public.findings (
      org_id, scan_id, assignment_id, store_id, digital_audit_line_id,
      source_type, source_id, audit_origin, finding_type, severity,
      confirmation_state, title, description, sku, product_name, category, shelf_label,
      expected_value, actual_value, variance_units, variance_percentage, variance_value_inr,
      rca_code, rca_notes, created_by, due_at
    )
    VALUES (
      line.org_id, line.scan_id, line.assignment_id, line.store_id, line.id,
      'digital_variance', line.id, origin, f_type, f_sev,
      CASE WHEN origin = 'ai' THEN 'ai_suggested' ELSE 'human_confirmed' END,
      f_title,
      COALESCE(line.product_name, line.sku, 'SKU variance'),
      line.sku, line.product_name, line.category, line.location,
      line.expected_qty, line.actual_qty, line.variance_qty, line.variance_pct, line.variance_value_inr,
      line.rca_code, line.rca_notes, auth.uid(),
      now() + make_interval(hours => public.sla_hours_for_severity(line.org_id, f_sev))
    )
    ON CONFLICT (org_id, source_type, source_id) DO UPDATE SET
      rca_code = EXCLUDED.rca_code,
      rca_notes = EXCLUDED.rca_notes,
      expected_value = EXCLUDED.expected_value,
      actual_value = EXCLUDED.actual_value,
      variance_units = EXCLUDED.variance_units,
      variance_percentage = EXCLUDED.variance_percentage,
      variance_value_inr = EXCLUDED.variance_value_inr,
      updated_at = now();

    GET DIAGNOSTICS inserted = ROW_COUNT;
  END LOOP;

  FOR cmp IN
    SELECT l.*, c.org_id AS cmp_org, c.scan_id AS cmp_scan, c.store_id AS cmp_store, c.assignment_id AS cmp_assignment
    FROM public.planogram_comparison_lines l
    JOIN public.planogram_comparisons c ON c.id = l.comparison_id
    WHERE c.scan_id = p_scan_id
      AND l.issue_type IS DISTINCT FROM 'correct'
      AND l.issue_type IS DISTINCT FROM 'ok'
  LOOP
    f_type := CASE cmp.issue_type
      WHEN 'missing' THEN 'missing_product'
      WHEN 'wrong_product' THEN 'wrong_placement'
      WHEN 'wrong_location' THEN 'wrong_placement'
      WHEN 'wrong_category' THEN 'planogram_violation'
      WHEN 'qty_mismatch' THEN
        CASE WHEN COALESCE(cmp.actual_qty, 0) = 0 THEN 'out_of_stock' ELSE 'planogram_violation' END
      ELSE 'shelf_execution_issue'
    END;
    f_sev := CASE COALESCE(cmp.severity, 'warning')
      WHEN 'critical' THEN 'critical'
      WHEN 'warning' THEN 'high'
      ELSE 'medium'
    END;
    f_title := CASE f_type
      WHEN 'missing_product' THEN 'Missing product'
      WHEN 'wrong_placement' THEN 'Wrong placement'
      WHEN 'out_of_stock' THEN 'Out of stock'
      WHEN 'planogram_violation' THEN 'Planogram violation'
      ELSE 'Shelf execution issue'
    END;

    INSERT INTO public.findings (
      org_id, scan_id, assignment_id, store_id, comparison_line_id,
      source_type, source_id, audit_origin, finding_type, severity,
      confirmation_state, title, description, sku, product_name, shelf_label,
      expected_value, actual_value, variance_units
    )
    VALUES (
      cmp.cmp_org, cmp.cmp_scan, cmp.cmp_assignment, cmp.cmp_store, cmp.id,
      'planogram_line', cmp.id, origin, f_type, f_sev,
      CASE WHEN origin = 'ai' THEN 'ai_suggested' ELSE 'human_confirmed' END,
      f_title,
      COALESCE(cmp.detail, cmp.expected_product, cmp.actual_product, 'Planogram issue'),
      NULL, COALESCE(cmp.expected_product, cmp.actual_product), NULL,
      cmp.expected_qty, cmp.actual_qty,
      COALESCE(cmp.actual_qty, 0) - COALESCE(cmp.expected_qty, 0)
    )
    ON CONFLICT (org_id, source_type, source_id) DO NOTHING;
  END LOOP;

  -- Expiry dates evidence: one finding per expired / near-expiry product row.
  IF scan_row.assignment_id IS NOT NULL THEN
    FOR ex_row IN
      SELECT
        d.id AS response_id,
        public.safe_iso_date(d.value #>> '{}') AS expiry_date,
        (SELECT s.value #>> '{}' FROM public.audit_responses s
          WHERE s.assignment_id = d.assignment_id AND s.section_key = d.section_key
            AND s.record_index = d.record_index AND s.field_key = 'expiry_scan_status' LIMIT 1) AS saved_status,
        (SELECT i.value #>> '{}' FROM public.audit_responses i
          WHERE i.assignment_id = d.assignment_id AND i.section_key = d.section_key
            AND i.record_index = d.record_index AND i.field_key = 'expiry_scan_item' LIMIT 1) AS item,
        EXISTS (SELECT 1 FROM public.audit_responses r
          WHERE r.assignment_id = d.assignment_id AND r.section_key = d.section_key
            AND r.record_index = d.record_index AND r.field_key = 'expiry_removed'
            AND r.value = 'true'::jsonb) AS removed
      FROM public.audit_responses d
      WHERE d.assignment_id = scan_row.assignment_id
        AND d.field_key = 'expiry_scan_date'
        AND public.safe_iso_date(d.value #>> '{}') IS NOT NULL
    LOOP
      v_status := CASE
        WHEN ex_row.expiry_date < current_date OR ex_row.saved_status = 'expired' THEN 'expired'
        WHEN ex_row.saved_status = 'near_expiry' THEN 'near_expiry'
        ELSE NULL
      END;
      CONTINUE WHEN v_status IS NULL;

      f_type := CASE v_status WHEN 'expired' THEN 'expired_product' ELSE 'near_expiry' END;
      f_sev := CASE v_status WHEN 'expired' THEN 'high' ELSE 'medium' END;
      f_title := CASE
        WHEN v_status = 'near_expiry' THEN 'Near expiry'
        WHEN ex_row.removed THEN 'Expired product removed from shelf'
        ELSE 'Expired product on shelf'
      END;

      INSERT INTO public.findings (
        org_id, scan_id, assignment_id, store_id,
        source_type, source_id, audit_origin, finding_type, severity,
        confirmation_state, title, description, product_name, rca_code, created_by, due_at
      )
      VALUES (
        scan_row.org_id, p_scan_id, scan_row.assignment_id, scan_row.store_id,
        'expiry_check', ex_row.response_id, origin, f_type, f_sev,
        'human_confirmed',
        f_title,
        COALESCE(NULLIF(ex_row.item, ''), 'Product') || ' — expiry ' || to_char(ex_row.expiry_date, 'DD Mon YYYY'),
        NULLIF(ex_row.item, ''),
        CASE WHEN v_status = 'expired' THEN 'expired' END,
        auth.uid(),
        now() + make_interval(hours => public.sla_hours_for_severity(scan_row.org_id, f_sev))
      )
      ON CONFLICT (org_id, source_type, source_id) DO UPDATE SET
        finding_type = EXCLUDED.finding_type,
        severity = EXCLUDED.severity,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        product_name = EXCLUDED.product_name,
        updated_at = now();
    END LOOP;
  END IF;

  PERFORM public.log_audit_activity(
    scan_row.org_id, p_scan_id, 'findings_synced', 'Findings synced from audit results'
  );

  RETURN inserted;
END;
$function$;
