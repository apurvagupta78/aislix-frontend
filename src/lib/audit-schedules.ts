/**
 * Recurring audit schedules — Wave 4.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import { createScanAssignment, type AuditMode, type ScopeType, type ScopeValues } from "@/lib/assignments";
import { processUniversalSchedules } from "@/lib/assignment-engine/publish";

export type ScheduleCadence = "daily" | "weekly" | "monthly" | "special";

export type AuditSchedule = {
  id: string;
  org_id: string;
  store_id: string;
  store_name?: string;
  assignee_id: string;
  assignee_name?: string;
  scope_type: ScopeType;
  scope_values: ScopeValues;
  audit_mode: AuditMode;
  cadence: ScheduleCadence;
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
    .select(
      "*, stores:store_id (name), profiles:assignee_id (full_name, email)",
    )
    .eq("org_id", orgId)
    .order("next_run_at", { ascending: true });
  if (error) dbError(error, "Could not load audit schedules.");

  return (data ?? []).map((row) => ({
    id: row.id as string,
    org_id: row.org_id as string,
    store_id: row.store_id as string,
    store_name: (row.stores as { name?: string })?.name,
    assignee_id: row.assignee_id as string,
    assignee_name:
      (row.profiles as { full_name?: string; email?: string })?.full_name ??
      (row.profiles as { email?: string })?.email,
    scope_type: row.scope_type as ScopeType,
    scope_values: (row.scope_values ?? {}) as ScopeValues,
    audit_mode: (row.audit_mode as AuditMode) ?? "digital",
    cadence: row.cadence as ScheduleCadence,
    day_of_week: row.day_of_week as number | null,
    day_of_month: row.day_of_month as number | null,
    next_run_at: row.next_run_at as string,
    last_run_at: row.last_run_at as string | null,
    active: Boolean(row.active),
    instructions: row.instructions as string | null,
    created_at: row.created_at as string,
  }));
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
  const orgId = await requireOrgId();
  const { error } = await supabase
    .from("audit_schedules")
    .update({ active, updated_at: new Date().toISOString() } as Record<string, unknown>)
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) dbError(error, "Could not update the schedule.");
}

export async function deleteAuditSchedule(id: string): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase.from("audit_schedules").delete().eq("org_id", orgId).eq("id", id);
  if (error) dbError(error, "Could not delete the schedule.");
}

/** Create assignments for all due schedules (call on dashboard/schedules page load). */
export async function processDueAuditSchedules(): Promise<number> {
  try {
    const universal = await processUniversalSchedules();
    if (universal > 0) return universal;
  } catch {
    // Fall through to legacy schedules if universal migration not applied.
  }

  const orgId = await requireOrgId();
  const now = new Date().toISOString();

  const { data: due, error } = await supabase
    .from("audit_schedules")
    .select("*")
    .eq("org_id", orgId)
    .eq("active", true)
    .lte("next_run_at", now);
  if (error) dbError(error, "Could not check due schedules.");
  if (!due?.length) return 0;

  let created = 0;
  for (const row of due) {
    const assigneeName = "team member";
    await createScanAssignment({
      storeId: row.store_id as string,
      scopeType: row.scope_type as ScopeType,
      scopeValues: (row.scope_values ?? {}) as ScopeValues,
      assigneeId: row.assignee_id as string,
      assigneeName,
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
