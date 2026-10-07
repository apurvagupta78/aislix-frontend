/**
 * Sends due scheduled reports. Runs with the service role, so every report is narrowed to the
 * stores its creator can access today; a schedule never shows more than the creator could see.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { AISLIX_DEMO_ORG_ID, isDemoOrgId } from "@/lib/demo-environment";
import { fetchReportDocument, reportPeriod, reportUrl } from "@/lib/reports/report-data";
import { sendReportSummaryEmails } from "@/lib/reports/report-email.server";
import { nextScheduleRun, type ReportScheduleRow } from "@/lib/reports/report-schedule";
import { narrowToSegment } from "@/lib/segments/segment-stores";

type DueSchedule = ReportScheduleRow & { org_id: string; created_by: string };

export type ScheduleRunResult = { id: string; status: string };

const BATCH_SIZE = 20;

export async function runDueReportSchedules(
  admin: SupabaseClient,
  origin: string,
  now: Date = new Date(),
): Promise<ScheduleRunResult[]> {
  const { data: due, error } = await admin
    .from("report_schedules")
    .select("*")
    .eq("enabled", true)
    .lte("next_run_at", now.toISOString())
    .order("next_run_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (error) throw new Error(error.message);

  const results: ScheduleRunResult[] = [];
  for (const schedule of (due ?? []) as DueSchedule[]) {
    const next = nextScheduleRun(now, {
      frequency: schedule.frequency,
      weekday: schedule.weekday,
      sendHour: schedule.send_hour,
      timeZone: schedule.timezone,
    });
    // Claim the run first so overlapping timers never send the same schedule twice.
    const { data: claimed } = await admin
      .from("report_schedules")
      .update({ next_run_at: next.toISOString(), updated_at: now.toISOString() })
      .eq("id", schedule.id)
      .eq("next_run_at", schedule.next_run_at)
      .select("id");
    if (!claimed?.length) continue;

    let status: string;
    try {
      status = await sendSchedule(admin, schedule, origin, now);
    } catch (err) {
      console.error("[report-schedules] send failed", schedule.id, err);
      status = "failed";
    }
    await admin
      .from("report_schedules")
      .update({
        last_status: status,
        ...(status === "sent" ? { last_sent_at: now.toISOString() } : {}),
        ...(status === "left_workspace" ? { enabled: false } : {}),
      })
      .eq("id", schedule.id);
    results.push({ id: schedule.id, status });
  }
  return results;
}

async function sendSchedule(
  admin: SupabaseClient,
  schedule: DueSchedule,
  origin: string,
  now: Date,
): Promise<string> {
  const { data: member } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("org_id", schedule.org_id)
    .eq("user_id", schedule.created_by)
    .eq("status", "active")
    .maybeSingle();
  if (!member) return "left_workspace";

  const { data: org } = await admin.from("organizations").select("is_demo").eq("id", schedule.org_id).maybeSingle();
  const orgIsDemo = isDemoOrgId(schedule.org_id) || Boolean((org as { is_demo?: boolean } | null)?.is_demo);
  const labeledDemo = orgIsDemo || schedule.preview_demo;
  const dataOrgId = orgIsDemo ? schedule.org_id : schedule.preview_demo ? AISLIX_DEMO_ORG_ID : schedule.org_id;

  let scope: string[] | null = null;
  if (!labeledDemo) {
    const { data: ids, error } = await admin.rpc("effective_store_ids" as never, {
      p_org_id: schedule.org_id,
      p_user_id: schedule.created_by,
    } as never);
    if (error) throw new Error(error.message);
    scope = ((ids as string[] | null) ?? []).filter(Boolean);
    if (!scope.length) return "no_store_access";
  }

  let storeName: string | null = null;
  if (schedule.store_id) {
    const { data: store } = await admin
      .from("stores")
      .select("name, org_id")
      .eq("id", schedule.store_id)
      .maybeSingle();
    const row = store as { name: string | null; org_id: string } | null;
    if (!row || row.org_id !== dataOrgId) return "no_store_access";
    if (scope && !scope.includes(schedule.store_id)) return "no_store_access";
    storeName = row.name;
  }

  const { withinRateLimits } = await import("@/lib/rate-limit.server");
  const allowed = await withinRateLimits([[`report_email:org:${schedule.org_id}`, 200, 86400]]);
  if (!allowed) return "rate_limited";

  const period = reportPeriod(schedule.days, now);
  const doc = await fetchReportDocument(admin, {
    kind: schedule.kind,
    segment: schedule.segment,
    dataOrgId,
    labeledDemo,
    from: period.from,
    to: period.to,
    storeIds: schedule.store_id ? [schedule.store_id] : await narrowToSegment(admin as never, dataOrgId, schedule.segment, scope),
    storeName,
  });

  const { data: me } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", schedule.created_by)
    .maybeSingle();
  const profile = me as { full_name?: string | null; email?: string | null } | null;
  const senderName = (profile?.full_name ?? "").trim() || profile?.email || "A teammate";

  const result = await sendReportSummaryEmails({
    doc,
    recipients: schedule.recipients,
    senderName,
    message: null,
    reportUrl: reportUrl(origin, { kind: schedule.kind, days: schedule.days, storeId: schedule.store_id }),
    scheduled: true,
    idempotencyPrefix: `schedule-${schedule.id}-${now.toISOString().slice(0, 13)}`,
  });
  return result.sent > 0 ? "sent" : "not_sent";
}
