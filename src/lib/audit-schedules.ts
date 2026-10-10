/**
 * Recurring audit schedules — Wave 4.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import { createScanAssignment, type AuditMode, type ScopeType, type ScopeValues } from "@/lib/assignments";
import { triggerScheduleRun } from "@/lib/assignment-engine/scheduler";
import {
  computeNextOccurrence,
  formatScheduleLabel,
  utcToZonedDateTime,
} from "@/lib/assignment-engine/recurrence";
import type { RecurrenceRule } from "@/lib/assignment-engine/types";

export type ScheduleCadence = "daily" | "weekly" | "monthly" | "special";

export type AuditSchedule = {
  id: string;
  org_id: string;
  store_id: string;
  store_name?: string;
  name?: string | null;
  assignee_id: string;
  assignee_name?: string;
  scope_type: ScopeType;
  scope_values: ScopeValues;
  audit_mode: AuditMode;
  cadence: ScheduleCadence;
  assignment_mode?: string | null;
  status?: string | null;
  day_of_week: number | null;
  day_of_month: number | null;
  next_run_at: string;
  last_run_at: string | null;
  active: boolean;
  instructions: string | null;
  created_at: string;
};

export type ScheduleInput = {
  store_id: string;
  assignee_id: string;
  assignee_name: string;
  scope_type?: ScopeType;
  scope_values?: ScopeValues;
  audit_mode?: AuditMode;
  cadence: ScheduleCadence;
  day_of_week?: number | null;
  day_of_month?: number | null;
  instructions?: string | null;
};

function computeNextRun(input: {
  cadence: ScheduleCadence;
  day_of_week?: number | null;
  day_of_month?: number | null;
  from?: Date;
}): Date {
  const base = input.from ?? new Date();
  const next = new Date(base);
  if (input.cadence === "daily") {
    next.setDate(next.getDate() + 1);
    next.setHours(8, 0, 0, 0);
    return next;
  }
  if (input.cadence === "weekly") {
    const target = input.day_of_week ?? 1;
    const diff = (target - next.getDay() + 7) % 7 || 7;
    next.setDate(next.getDate() + diff);
    next.setHours(8, 0, 0, 0);
    return next;
  }
  if (input.cadence === "monthly") {
    const dom = input.day_of_month ?? 1;
    next.setMonth(next.getMonth() + 1);
    next.setDate(Math.min(dom, 28));
    next.setHours(8, 0, 0, 0);
    return next;
  }
  next.setDate(next.getDate() + 7);
  return next;
}

export async function fetchAuditSchedules(): Promise<AuditSchedule[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("audit_schedules")
    .select("*, stores:store_id (name)")
    .eq("org_id", orgId)
    .order("next_run_at", { ascending: true });
  if (error) dbError(error, "Could not load audit schedules.");

  const assigneeIds = [
    ...new Set((data ?? []).map((row) => row.assignee_id as string).filter(Boolean)),
  ];
  const { data: profiles } = assigneeIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", assigneeIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (data ?? []).map((row) => {
    const profile = profileById.get(row.assignee_id as string);
    return {
      id: row.id as string,
      org_id: row.org_id as string,
      store_id: row.store_id as string,
      store_name: (row.stores as { name?: string })?.name,
      name: (row.name as string | null) ?? null,
      assignee_id: row.assignee_id as string,
      assignee_name: profile?.full_name ?? profile?.email ?? undefined,
      scope_type: row.scope_type as ScopeType,
      scope_values: (row.scope_values ?? {}) as ScopeValues,
      audit_mode: (row.audit_mode as AuditMode) ?? "digital",
      cadence: row.cadence as ScheduleCadence,
      assignment_mode: (row.assignment_mode as string | null) ?? null,
      status: (row.status as string | null) ?? null,
      day_of_week: row.day_of_week as number | null,
      day_of_month: row.day_of_month as number | null,
      next_run_at: row.next_run_at as string,
      last_run_at: row.last_run_at as string | null,
      active: Boolean(row.active),
      instructions: row.instructions as string | null,
      created_at: row.created_at as string,
    };
  });
}

export async function createAuditSchedule(input: ScheduleInput): Promise<string> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const nextRun = computeNextRun(input);

  const { data, error } = await supabase
    .from("audit_schedules")
    .insert({
      org_id: orgId,
      store_id: input.store_id,
      assignee_id: input.assignee_id,
      scope_type: input.scope_type ?? "planogram",
      scope_values: input.scope_values ?? {},
      audit_mode: input.audit_mode ?? "digital",
      cadence: input.cadence,
      day_of_week: input.day_of_week ?? null,
      day_of_month: input.day_of_month ?? null,
      next_run_at: nextRun.toISOString(),
      instructions: input.instructions?.trim() || null,
      created_by: userId,
      active: true,
    } as Record<string, unknown>)
    .select("id")
    .single();
  if (error) dbError(error, "Could not create the schedule.");
  return data!.id as string;
}

export async function toggleAuditSchedule(id: string, active: boolean): Promise<void> {
  if (active) await resumeAuditSchedule(id);
  else await pauseAuditSchedule(id);
}

/* ---------------------------- recurring series ---------------------------- */

type ScheduleRuleRow = {
  cadence?: string | null;
  day_of_week?: number | null;
  day_of_month?: number | null;
  next_run_at?: string | null;
  timezone?: string | null;
  recurrence_config?: unknown;
};

/** The series' repeat rule; legacy rows only carry cadence + day columns. */
export function scheduleRecurrenceRule(row: ScheduleRuleRow): RecurrenceRule {
  const timezone = row.timezone || "Asia/Kolkata";
  const config = (row.recurrence_config ?? {}) as Partial<RecurrenceRule>;
  const anchor = row.next_run_at
    ? utcToZonedDateTime(row.next_run_at, timezone)
    : { date: new Date().toISOString().slice(0, 10), time: "09:00" };
  if (config.frequency) {
    return {
      frequency: config.frequency,
      interval: config.interval || 1,
      daysOfWeek:
        config.frequency === "weekly"
          ? config.daysOfWeek?.length
            ? config.daysOfWeek
            : [row.day_of_week ?? 1]
          : config.daysOfWeek,
      dayOfMonth: config.dayOfMonth ?? row.day_of_month ?? undefined,
      startDate: config.startDate || anchor.date,
      startTime: config.startTime || anchor.time,
      endDate: config.endDate,
      maxOccurrences: config.maxOccurrences,
      timezone: config.timezone || timezone,
    };
  }
  const cadence = row.cadence === "daily" || row.cadence === "monthly" ? row.cadence : "weekly";
  return {
    frequency: cadence,
    interval: 1,
    daysOfWeek: cadence === "weekly" ? [row.day_of_week ?? 1] : undefined,
    dayOfMonth: cadence === "monthly" ? (row.day_of_month ?? 1) : undefined,
    startDate: anchor.date,
    startTime: anchor.time,
    timezone,
  };
}

export type RecurringSeries = {
  id: string;
  name: string;
  auditMode: AuditMode;
  storeNames: string[];
  assigneeNames: string[];
  repeatLabel: string;
  nextRunAt: string | null;
  paused: boolean;
  createdBy: string | null;
  assigneeIds: string[];
};

const ENDED_SCHEDULE_STATUSES = ["completed", "cancelled", "expired"];

/** Every repeating audit series in the org (one-off scheduled audits excluded). */
export async function fetchRecurringSeries(): Promise<RecurringSeries[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("audit_schedules")
    .select(
      "id, name, audit_mode, store_id, store_ids, assignee_id, assignee_ids, cadence, day_of_week, day_of_month, next_run_at, timezone, recurrence_config, status, active, assignment_mode, created_by, scope_values",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) dbError(error, "Could not load recurring audits.");

  const rows = ((data ?? []) as Record<string, unknown>[]).filter((row) => {
    const mode = row.assignment_mode as string | null;
    if (mode && mode !== "recurring") return false;
    return !ENDED_SCHEDULE_STATUSES.includes(String(row.status ?? ""));
  });
  if (!rows.length) return [];

  const idsOf = (row: Record<string, unknown>, many: string, one: string) => {
    const list = ((row[many] as string[] | null) ?? []).filter(Boolean);
    const single = row[one] as string | null;
    return list.length ? list : single ? [single] : [];
  };
  const storeIds = [...new Set(rows.flatMap((row) => idsOf(row, "store_ids", "store_id")))];
  const personIds = [...new Set(rows.flatMap((row) => idsOf(row, "assignee_ids", "assignee_id")))];
  const [{ data: stores }, { data: people }] = await Promise.all([
    storeIds.length
      ? supabase.from("stores").select("id, name").in("id", storeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    personIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", personIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
  ]);
  const storeName = new Map((stores ?? []).map((s) => [s.id as string, s.name as string]));
  const personName = new Map(
    (people ?? []).map((p) => [p.id as string, (p.full_name as string | null)?.trim() || (p.email as string | null) || "Member"]),
  );

  return rows.map((row) => {
    const paused = row.status === "paused" || (row.active === false && row.status !== "scheduled");
    const scopeName = (row.scope_values as ScopeValues | null)?.audit_name as string | undefined;
    const assigneeIds = idsOf(row, "assignee_ids", "assignee_id");
    return {
      id: row.id as string,
      name: (row.name as string | null)?.trim() || scopeName?.trim() || "Recurring audit",
      auditMode: (row.audit_mode as AuditMode) ?? "digital",
      storeNames: idsOf(row, "store_ids", "store_id").map((id) => storeName.get(id) ?? "Store"),
      assigneeNames: assigneeIds.map((id) => personName.get(id) ?? "Member"),
      repeatLabel: formatScheduleLabel(scheduleRecurrenceRule(row as ScheduleRuleRow)),
      nextRunAt: paused ? null : ((row.next_run_at as string | null) ?? null),
      paused,
      createdBy: (row.created_by as string | null) ?? null,
      assigneeIds,
    };
  });
}

/** Stop future rounds. Rounds already assigned stay open. */
export async function pauseAuditSchedule(id: string): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase
    .from("audit_schedules")
    .update({ active: false, status: "paused", updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) dbError(error, "Could not pause the recurring audit.");
}

/** Restart future rounds from the next upcoming slot — missed rounds are not created. */
export async function resumeAuditSchedule(id: string): Promise<void> {
  const orgId = await requireOrgId();
  const { data, error: readError } = await supabase
    .from("audit_schedules")
    .select("cadence, day_of_week, day_of_month, next_run_at, timezone, recurrence_config")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (readError) dbError(readError, "Could not resume the recurring audit.");
  if (!data) throw new Error("This recurring audit no longer exists.");

  const now = new Date();
  const current = data.next_run_at ? new Date(data.next_run_at as string) : null;
  const nextRun =
    current && current.getTime() > now.getTime()
      ? current
      : computeNextOccurrence(scheduleRecurrenceRule(data as ScheduleRuleRow), now);

  const { error } = await supabase
    .from("audit_schedules")
    .update({
      active: true,
      status: "active",
      next_run_at: nextRun.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) dbError(error, "Could not resume the recurring audit.");
}

export async function deleteAuditSchedule(id: string): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase.from("audit_schedules").delete().eq("org_id", orgId).eq("id", id);
  if (error) dbError(error, "Could not delete the schedule.");
}

/**
 * Manual manager trigger — delegates to server-side idempotent RPC.
 * Recurring audits are processed by pg_cron or the schedule-runner Edge Function;
 * this is not called automatically on page load (avoids duplicate client-side runs).
 */
export async function processDueAuditSchedules(): Promise<number> {
  const result = await triggerScheduleRun();
  if (result.source === "rpc") {
    return result.assignmentsCreated;
  }

  // Legacy fallback when scheduler migration is not applied yet.
  const orgId = await requireOrgId();
  const now = new Date().toISOString();

  // Include schedule_once rows (active=false, status=scheduled) that are due.
  const { data: due, error } = await supabase
    .from("audit_schedules")
    .select("*")
    .eq("org_id", orgId)
    .or("active.eq.true,status.in.(active,scheduled)")
    .lte("next_run_at", now)
    .not("status", "eq", "completed");
  if (error) dbError(error, "Could not check due schedules.");
  if (!due?.length) return 0;

  let created = 0;
  for (const row of due) {
    await createScanAssignment({
      storeId: row.store_id as string,
      scopeType: row.scope_type as ScopeType,
      scopeValues: (row.scope_values ?? {}) as ScopeValues,
      assigneeId: row.assignee_id as string,
      assigneeName: "team member",
      instructions: row.instructions as string | null,
      auditMode: (row.audit_mode as AuditMode) ?? "digital",
    });

    const nextRun = computeNextRun({
      cadence: row.cadence as ScheduleCadence,
      day_of_week: row.day_of_week as number | null,
      day_of_month: row.day_of_month as number | null,
      from: new Date(),
    });

    await supabase
      .from("audit_schedules")
      .update({
        last_run_at: now,
        next_run_at: nextRun.toISOString(),
        updated_at: now,
      } as Record<string, unknown>)
      .eq("id", row.id as string);

    created++;
  }
  return created;
}
