-- Fix process_due_audit_schedules: schedule_once must not set next_run_at to NULL.
-- next_run_at is NOT NULL; setting NULL aborted the whole run and rolled back assignment inserts,
-- so Schedule Once / Recurring never delivered My Work rows.
-- Applied live 2026-09-20; kept here so environments stay in sync.

CREATE OR REPLACE FUNCTION public.process_due_audit_schedules(p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_schedule RECORD;
  v_occurrence_key TEXT;
  v_occurrence_id UUID;
  v_store_id UUID;
  v_assignee_id UUID;
  v_created INT := 0;
  v_schedules INT := 0;
  v_now TIMESTAMPTZ := now();
  v_due_at TIMESTAMPTZ;
  v_plan JSONB;
  v_entry JSONB;
  v_store_ids UUID[];
  v_assignee_ids UUID[];
  v_i INT;
  v_batch_created INT;
BEGIN
  FOR v_schedule IN
    SELECT *
    FROM public.audit_schedules s
    WHERE (s.active = true OR s.status IN ('active', 'scheduled'))
      AND s.next_run_at IS NOT NULL
      AND s.next_run_at <= v_now
      AND (s.end_at IS NULL OR s.end_at > v_now)
      AND (s.max_occurrences IS NULL OR COALESCE(s.occurrence_count, 0) < s.max_occurrences)
    ORDER BY s.next_run_at ASC
    LIMIT p_limit
  LOOP
    v_occurrence_key := to_char(v_schedule.next_run_at AT TIME ZONE COALESCE(v_schedule.timezone, 'UTC'), 'YYYY-MM-DD"T"HH24:MI');
    v_batch_created := 0;

    INSERT INTO public.schedule_occurrences (org_id, schedule_id, occurrence_key, scheduled_for)
    VALUES (v_schedule.org_id, v_schedule.id, v_occurrence_key, v_schedule.next_run_at)
    ON CONFLICT (schedule_id, occurrence_key) DO NOTHING
    RETURNING id INTO v_occurrence_id;

    IF v_occurrence_id IS NULL THEN
      UPDATE public.audit_schedules
      SET next_run_at = CASE
            WHEN v_schedule.assignment_mode = 'schedule_once' THEN v_schedule.next_run_at
            ELSE public.compute_schedule_next_run(
              v_schedule.cadence, v_schedule.day_of_week, v_schedule.day_of_month, v_now + INTERVAL '1 minute'
            )
          END,
          status = CASE
            WHEN v_schedule.assignment_mode = 'schedule_once' THEN 'completed'
            ELSE status
          END,
          active = CASE
            WHEN v_schedule.assignment_mode = 'schedule_once' THEN false
            ELSE active
          END,
          updated_at = v_now
      WHERE id = v_schedule.id;
      CONTINUE;
    END IF;

    v_due_at := v_schedule.next_run_at + INTERVAL '24 hours';
    IF v_schedule.due_config ? 'dueOffsetHours' THEN
      v_due_at := v_schedule.next_run_at + (COALESCE((v_schedule.due_config->>'dueOffsetHours')::INT, 24)) * INTERVAL '1 hour';
    END IF;

    v_plan := COALESCE(v_schedule.distribution_plan, '[]'::jsonb);

    IF jsonb_array_length(v_plan) > 0 THEN
      FOR v_entry IN SELECT * FROM jsonb_array_elements(v_plan)
      LOOP
        v_assignee_id := (v_entry->>'assigneeId')::UUID;
        FOR v_store_id IN
          SELECT jsonb_array_elements_text(v_entry->'storeIds')::UUID
        LOOP
          INSERT INTO public.scan_assignments (
            org_id, store_id, assignee_id, assigner_id, scope_type, scope_values,
            status, audit_mode, due_at, instructions, template_id, template_version,
            template_snapshot, evidence_policy, require_rca, reviewer_id,
            schedule_id, campaign_id, scheduled_at, assignment_state, creation_source
          ) VALUES (
            v_schedule.org_id,
            v_store_id,
            v_assignee_id,
            COALESCE(v_schedule.created_by, v_assignee_id),
            v_schedule.scope_type,
            COALESCE(v_schedule.scope_values, '{}'::jsonb),
            'pending',
            COALESCE(v_schedule.audit_mode, 'digital'),
            v_due_at,
            v_schedule.instructions,
            v_schedule.template_id,
            v_schedule.template_version,
            v_schedule.template_snapshot,
            v_schedule.evidence_policy,
            COALESCE(v_schedule.require_rca, true),
            v_schedule.reviewer_id,
            v_schedule.id,
            v_schedule.campaign_id,
            v_schedule.next_run_at,
            'assigned',
            'schedule'
          );
          v_batch_created := v_batch_created + 1;
          v_created := v_created + 1;
        END LOOP;
      END LOOP;
    ELSE
      v_store_ids := CASE
        WHEN COALESCE(array_length(v_schedule.store_ids, 1), 0) > 0 THEN v_schedule.store_ids
        ELSE ARRAY[v_schedule.store_id]
      END;
      v_assignee_ids := CASE
        WHEN COALESCE(array_length(v_schedule.assignee_ids, 1), 0) > 0 THEN v_schedule.assignee_ids
        ELSE ARRAY[v_schedule.assignee_id]
      END;

      v_i := 0;
      FOREACH v_store_id IN ARRAY v_store_ids
      LOOP
        v_assignee_id := v_assignee_ids[1 + (v_i % array_length(v_assignee_ids, 1))];
        INSERT INTO public.scan_assignments (
          org_id, store_id, assignee_id, assigner_id, scope_type, scope_values,
          status, audit_mode, due_at, instructions, template_id, template_version,
          template_snapshot, evidence_policy, require_rca, reviewer_id,
          schedule_id, campaign_id, scheduled_at, assignment_state, creation_source
        ) VALUES (
          v_schedule.org_id,
          v_store_id,
          v_assignee_id,
          COALESCE(v_schedule.created_by, v_assignee_id),
          v_schedule.scope_type,
          COALESCE(v_schedule.scope_values, '{}'::jsonb),
          'pending',
          COALESCE(v_schedule.audit_mode, 'digital'),
          v_due_at,
          v_schedule.instructions,
          v_schedule.template_id,
          v_schedule.template_version,
          v_schedule.template_snapshot,
          v_schedule.evidence_policy,
          COALESCE(v_schedule.require_rca, true),
          v_schedule.reviewer_id,
          v_schedule.id,
          v_schedule.campaign_id,
          v_schedule.next_run_at,
          'assigned',
          'schedule'
        );
        v_batch_created := v_batch_created + 1;
        v_created := v_created + 1;
        v_i := v_i + 1;
      END LOOP;
    END IF;

    UPDATE public.schedule_occurrences
    SET assignments_created = v_batch_created
    WHERE id = v_occurrence_id;

    UPDATE public.audit_schedules
    SET
      last_run_at = v_now,
      occurrence_count = COALESCE(occurrence_count, 0) + 1,
      next_run_at = CASE
        WHEN v_schedule.assignment_mode = 'schedule_once' THEN v_schedule.next_run_at
        ELSE public.compute_schedule_next_run(
          v_schedule.cadence, v_schedule.day_of_week, v_schedule.day_of_month, v_now + INTERVAL '1 minute'
        )
      END,
      status = CASE
        WHEN v_schedule.assignment_mode = 'schedule_once' THEN 'completed'
        WHEN v_schedule.max_occurrences IS NOT NULL
          AND COALESCE(occurrence_count, 0) + 1 >= v_schedule.max_occurrences THEN 'completed'
        ELSE status
      END,
      active = CASE
        WHEN v_schedule.assignment_mode = 'schedule_once' THEN false
        WHEN v_schedule.max_occurrences IS NOT NULL
          AND COALESCE(occurrence_count, 0) + 1 >= v_schedule.max_occurrences THEN false
        ELSE active
      END,
      updated_at = v_now
    WHERE id = v_schedule.id;

    INSERT INTO public.notifications (user_id, org_id, type, title, body, payload)
    SELECT
      v_schedule.assignee_id,
      v_schedule.org_id,
      'scan_assigned',
      'Scheduled audit ready',
      COALESCE(v_schedule.name, 'Scheduled audit') || ' — new assignment created.',
      jsonb_build_object('schedule_id', v_schedule.id, 'occurrence_key', v_occurrence_key);

    v_schedules := v_schedules + 1;
  END LOOP;

  RETURN jsonb_build_object('schedules_processed', v_schedules, 'assignments_created', v_created);
END;
$function$;
