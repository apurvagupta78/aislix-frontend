/**
 * Manage your own scheduled report emails. Runs under the caller's session, so row-level
 * security limits every read and write to schedules they created in workspaces they belong to.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REPORT_DAYS, REPORT_KINDS, type ReportDays, type ReportKind } from "@/lib/reports/report-document";
import {
  MAX_SCHEDULES_PER_PERSON,
  nextScheduleRun,
  safeTimeZone,
  type ReportScheduleRow,
  type ScheduleFrequency,
} from "@/lib/reports/report-schedule";
import { SEGMENT_IDS, type SegmentId } from "@/lib/segments/segment-config";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCHEDULE_COLUMNS =
  "id, kind, segment, store_id, days, preview_demo, frequency, weekday, send_hour, timezone, recipients, enabled, next_run_at, last_sent_at, last_status";

function requireUuid(value: unknown, message: string): string {
  const id = String(value ?? "");
  if (!UUID_RE.test(id)) throw new Error(message);
  return id;
}

export const listReportSchedules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { activeOrgId: string }) => ({
    activeOrgId: requireUuid(input?.activeOrgId, "Missing workspace."),
  }))
  .handler(async ({ data, context }): Promise<ReportScheduleRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("report_schedules" as never)
      .select(SCHEDULE_COLUMNS)
      .eq("org_id", data.activeOrgId)
      .eq("created_by", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error("Could not load your scheduled reports.");
    return (rows ?? []) as unknown as ReportScheduleRow[];
  });

export type CreateReportScheduleInput = {
  activeOrgId: string;
  kind: ReportKind;
  segment: SegmentId;
  storeId?: string | null;
  days: ReportDays;
  previewDemo?: boolean;
  frequency: ScheduleFrequency;
  weekday?: number | null;
  sendHour: number;
  timeZone?: string | null;
  recipients: string[];
};

export const createReportSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateReportScheduleInput) => {
    const kind = REPORT_KINDS.includes(input?.kind) ? input.kind : null;
    if (!kind) throw new Error("Unknown report.");
    const frequency: ScheduleFrequency = input?.frequency === "weekly" ? "weekly" : "daily";
    const weekday = frequency === "weekly" ? Number(input?.weekday) : null;
    if (frequency === "weekly" && !(Number.isInteger(weekday) && weekday! >= 0 && weekday! <= 6)) {
      throw new Error("Pick a day of the week.");
    }
    const sendHour = Number(input?.sendHour);
    if (!Number.isInteger(sendHour) || sendHour < 0 || sendHour > 23) throw new Error("Pick a send time.");
    const storeId = input?.storeId && UUID_RE.test(String(input.storeId)) ? String(input.storeId) : null;
    if (kind === "store" && !storeId) throw new Error("Pick a store for this report.");
    const recipients = [...new Set((input?.recipients ?? []).map((r) => String(r).trim().toLowerCase()))]
      .filter((r) => EMAIL_RE.test(r))
      .slice(0, 5);
    if (!recipients.length) throw new Error("Add at least one valid email address.");
    return {
      activeOrgId: requireUuid(input?.activeOrgId, "Missing workspace."),
      kind,
      segment: (SEGMENT_IDS as string[]).includes(input?.segment) ? input.segment : ("supermarket" as SegmentId),
      storeId,
      days: ((REPORT_DAYS as readonly number[]).includes(Number(input?.days)) ? Number(input.days) : 7) as ReportDays,
      previewDemo: input?.previewDemo === true,
      frequency,
      weekday,
      sendHour,
      timeZone: safeTimeZone(input?.timeZone),
      recipients,
    };
  })
  .handler(async ({ data, context }): Promise<ReportScheduleRow> => {
    const { supabase, userId } = context;
    const { count } = await supabase
      .from("report_schedules" as never)
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId);
    if ((count ?? 0) >= MAX_SCHEDULES_PER_PERSON) {
      throw new Error(`You can have up to ${MAX_SCHEDULES_PER_PERSON} scheduled reports. Delete one first.`);
    }

    const next = nextScheduleRun(new Date(), {
      frequency: data.frequency,
      weekday: data.weekday,
      sendHour: data.sendHour,
      timeZone: data.timeZone,
    });
    const { data: row, error } = await supabase
      .from("report_schedules" as never)
      .insert({
        org_id: data.activeOrgId,
        created_by: userId,
        kind: data.kind,
        segment: data.segment,
        store_id: data.storeId,
        days: data.days,
        preview_demo: data.previewDemo,
        frequency: data.frequency,
        weekday: data.weekday,
        send_hour: data.sendHour,
        timezone: data.timeZone,
        recipients: data.recipients,
        next_run_at: next.toISOString(),
      } as never)
      .select(SCHEDULE_COLUMNS)
      .single();
    if (error || !row) throw new Error("Could not save the schedule. Check you still belong to this workspace.");
    return row as unknown as ReportScheduleRow;
  });

export const setReportScheduleEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; enabled: boolean }) => ({
    id: requireUuid(input?.id, "Unknown schedule."),
    enabled: input?.enabled === true,
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = { enabled: data.enabled, updated_at: new Date().toISOString() };
    if (data.enabled) {
      const { data: current } = await supabase
        .from("report_schedules" as never)
        .select("frequency, weekday, send_hour, timezone")
        .eq("id", data.id)
        .eq("created_by", userId)
        .maybeSingle();
      const c = current as { frequency: ScheduleFrequency; weekday: number | null; send_hour: number; timezone: string } | null;
      if (!c) throw new Error("Schedule not found.");
      patch.next_run_at = nextScheduleRun(new Date(), {
        frequency: c.frequency,
        weekday: c.weekday,
        sendHour: c.send_hour,
        timeZone: c.timezone,
      }).toISOString();
      patch.last_status = null;
    }
    const { error } = await supabase
      .from("report_schedules" as never)
      .update(patch as never)
      .eq("id", data.id)
      .eq("created_by", userId);
    if (error) throw new Error("Could not update the schedule.");
    return { ok: true };
  });

export const deleteReportSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: requireUuid(input?.id, "Unknown schedule.") }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("report_schedules" as never)
      .delete()
      .eq("id", data.id)
      .eq("created_by", context.userId);
    if (error) throw new Error("Could not delete the schedule.");
    return { ok: true };
  });
