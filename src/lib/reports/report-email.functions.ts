/**
 * Email a report summary. The server rebuilds the report from the database under the caller's
 * own session (row-level security), so the email can never show numbers the sender cannot see.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REPORT_DAYS, REPORT_KINDS, type ReportDays, type ReportKind } from "@/lib/reports/report-document";
import { SEGMENT_IDS, type SegmentId } from "@/lib/segments/segment-config";

export type EmailReportInput = {
  kind: ReportKind;
  days: ReportDays;
  segment: SegmentId;
  activeOrgId: string;
  storeId?: string | null;
  previewDemo?: boolean;
  recipients: string[];
  message?: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const emailReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EmailReportInput) => {
    const kind = REPORT_KINDS.includes(input?.kind) ? input.kind : null;
    if (!kind) throw new Error("Unknown report.");
    const days = (REPORT_DAYS as readonly number[]).includes(Number(input?.days))
      ? (Number(input.days) as ReportDays)
      : 30;
    const segment = (SEGMENT_IDS as string[]).includes(input?.segment) ? input.segment : "supermarket";
    const activeOrgId = String(input?.activeOrgId ?? "");
    if (!UUID_RE.test(activeOrgId)) throw new Error("Missing workspace.");
    const storeId = input?.storeId && UUID_RE.test(String(input.storeId)) ? String(input.storeId) : null;
    const recipients = [...new Set((input?.recipients ?? []).map((r) => String(r).trim().toLowerCase()))]
      .filter((r) => EMAIL_RE.test(r))
      .slice(0, 5);
    if (!recipients.length) throw new Error("Add at least one valid email address.");
    return {
      kind,
      days,
      segment,
      activeOrgId,
      storeId,
      previewDemo: input?.previewDemo === true,
      recipients,
      message: input?.message ? String(input.message).trim().slice(0, 500) : null,
    };
  })
  .handler(async ({ data, context }): Promise<{ sent: number; skipped: number }> => {
    const { supabase, userId } = context;

    const { data: member } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("org_id", data.activeOrgId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!member) throw new Error("You are not a member of this workspace.");

    const { withinRateLimits } = await import("@/lib/rate-limit.server");
    const allowed = await withinRateLimits([
      [`report_email:user:${userId}`, 30, 86400],
      [`report_email:org:${data.activeOrgId}`, 200, 86400],
    ]);
    if (!allowed) throw new Error("Daily report email limit reached. Try again tomorrow.");

    const { resolveDemoExperienceWithClient } = await import("@/lib/demo-environment");
    const experience = await resolveDemoExperienceWithClient(supabase as never, data.activeOrgId, {
      previewDemo: data.previewDemo,
    });

    let storeName: string | null = null;
    if (data.storeId) {
      const { data: store } = await supabase
        .from("stores")
        .select("name, org_id")
        .eq("id", data.storeId)
        .maybeSingle();
      if (!store || (store as { org_id: string }).org_id !== experience.dataOrgId) {
        throw new Error("Store not found in this workspace.");
      }
      storeName = (store as { name: string | null }).name;
    }

    const { fetchReportDocument, reportPeriod, reportUrl } = await import("@/lib/reports/report-data");
    const { narrowToSegment } = await import("@/lib/segments/segment-stores");
    const period = reportPeriod(data.days);
    const doc = await fetchReportDocument(supabase as never, {
      kind: data.kind,
      segment: data.segment,
      dataOrgId: experience.dataOrgId,
      labeledDemo: experience.labeledDemo,
      from: period.from,
      to: period.to,
      storeIds: data.storeId
        ? [data.storeId]
        : await narrowToSegment(supabase as never, experience.dataOrgId, data.segment, null),
      storeName,
    });

    const { data: me } = await supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
    const senderName =
      ((me as { full_name?: string | null } | null)?.full_name ?? "").trim() ||
      (me as { email?: string | null } | null)?.email ||
      "A teammate";

    const { serverAppOrigin } = await import("@/lib/app-origin");
    const url = reportUrl(serverAppOrigin(), { kind: data.kind, days: data.days, storeId: data.storeId });
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

    let sent = 0;
    let skipped = 0;
    const stamp = new Date().toISOString().slice(0, 16);
    for (const email of data.recipients) {
      const result = await sendTemplateEmail("report-summary", email, {
        idempotencyKey: `report-${userId}-${data.kind}-${data.days}-${data.storeId ?? "all"}-${stamp}-${email}`,
        templateData: {
          senderName,
          title: doc.title,
          subtitle: doc.subtitle,
          question: doc.question,
          headline: doc.empty ? doc.emptyMessage : doc.headline,
          kpis: doc.empty ? [] : doc.kpis.map((k) => ({ label: k.label, value: k.value, context: k.context })),
          labeledDemo: doc.labeledDemo,
          message: data.message,
          reportUrl: url,
        },
      });
      if (result.sent) sent += 1;
      else skipped += 1;
    }
    return { sent, skipped };
  });
