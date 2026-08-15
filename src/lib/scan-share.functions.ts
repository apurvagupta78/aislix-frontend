/**
 * Scan sharing server functions.
 *
 * Share links, emailed reports and in-app team shares all verify org
 * membership through the caller's own session (RLS) before touching the
 * privileged helpers in scan-share.server.ts.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ScanShareLink, ShareTarget, SharedScanPayload } from "@/lib/scan-share";

/* ------------------------------- copy link -------------------------------- */

export const createScanShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scanId: string }) => {
    const scanId = String(input?.scanId ?? "").trim();
    if (!scanId) throw new Error("Missing scan.");
    return { scanId };
  })
  .handler(async ({ data, context }): Promise<ScanShareLink> => {
    const { supabase, userId } = context;
    const { requireScanAccess } = await import("@/lib/scan-share.server");
    const { orgId } = await requireScanAccess(supabase as never, data.scanId);

    const { ensureShareLink, logShareEvent } = await import("@/lib/scan-share.server");
    const link = await ensureShareLink(data.scanId, orgId, userId);
    await logShareEvent({
      scanId: data.scanId,
      orgId,
      shareType: "link",
      userId,
      payload: { action: "copy" },
    });

    return { ...link, view_count: 0 };
  });

/* ----------------------------- share targets ------------------------------ */

export const listShareTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scanId: string }) => ({
    scanId: String(input?.scanId ?? "").trim(),
  }))
  .handler(async ({ data, context }): Promise<{ targets: ShareTarget[]; assignee_id: string | null }> => {
    const { supabase, userId } = context;
    const { requireScanAccess } = await import("@/lib/scan-share.server");
    const { orgId, assigneeId } = await requireScanAccess(supabase as never, data.scanId);

    const { data: members, error } = await supabase
      .from("organization_members")
      .select("user_id, role, invited_email")
      .eq("org_id", orgId)
      .eq("status", "active");
    if (error) throw new Error(error.message);

    const rows = (members ?? []).filter((row: any) => row.user_id && row.user_id !== userId);
    if (!rows.length) return { targets: [], assignee_id: assigneeId };

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in(
        "id",
        rows.map((row: any) => row.user_id),
      );
    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    const targets: ShareTarget[] = rows.map((row: any) => {
      const profile = byId.get(row.user_id) as any;
      const email = (profile?.email as string | null) ?? (row.invited_email as string | null) ?? "";
      return {
        user_id: row.user_id as string,
        name: (profile?.full_name as string | null)?.trim() || email.split("@")[0] || "Team member",
        email,
        role: String(row.role ?? "member"),
      };
    });

    return { targets, assignee_id: assigneeId };
  });

/* ------------------------------ email report ------------------------------ */

export type EmailScanReportInput = {
  scanId: string;
  recipients?: string[];
  recipientUserIds?: string[];
  message?: string | null;
  includePdf?: boolean;
  includeAnnotated?: boolean;
};

export const emailScanReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EmailScanReportInput) => {
    const scanId = String(input?.scanId ?? "").trim();
    if (!scanId) throw new Error("Missing scan.");
    const recipients = (input?.recipients ?? [])
      .map((value) => String(value).trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 5);
    const recipientUserIds = (input?.recipientUserIds ?? []).map((value) => String(value));
    if (!recipients.length && !recipientUserIds.length) {
      throw new Error("Add at least one recipient.");
    }
    return {
      scanId,
      recipients,
      recipientUserIds,
      message: input?.message ? String(input.message).slice(0, 1000) : null,
      includePdf: input?.includePdf !== false,
      includeAnnotated: input?.includeAnnotated !== false,
    };
  })
  .handler(async ({ data, context }): Promise<{ sent: number; skipped: number }> => {
    const { supabase, userId } = context;
    const { requireScanAccess } = await import("@/lib/scan-share.server");
    const { orgId } = await requireScanAccess(supabase as never, data.scanId);

    const emails = [...data.recipients];
    if (data.recipientUserIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", data.recipientUserIds);
      for (const profile of profiles ?? []) {
        const email = (profile as any).email as string | null;
        if (email && !emails.includes(email.toLowerCase())) emails.push(email.toLowerCase());
      }
    }
    if (!emails.length) throw new Error("No valid recipient email addresses were found.");

    const { data: me } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();
    const sharerName =
      ((me as any)?.full_name as string | null)?.trim() ||
      ((me as any)?.email as string | null) ||
      "A teammate";

    const { ensureShareLink, logShareEvent, scanShareSummary, signedScanAssets } = await import(
      "@/lib/scan-share.server"
    );
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

    const [link, summary, assets] = await Promise.all([
      ensureShareLink(data.scanId, orgId, userId),
      scanShareSummary(data.scanId),
      signedScanAssets(data.scanId, 86400),
    ]);

    let sent = 0;
    let skipped = 0;
    for (const email of emails) {
      const result = await sendTemplateEmail("scan-report", email, {
        idempotencyKey: `scan-report-${data.scanId}-${link.token}-${email}`,
        templateData: {
          sharerName,
          storeName: summary.store_name,
          location: summary.location,
          category: [summary.category, summary.sub_category].filter(Boolean).join(" · "),
          scanDate: summary.scanned_at,
          healthScore: summary.shelf_health_score,
          productsDetected: summary.products_detected,
          compliancePercent: summary.planogram_compliance_percent,
          message: data.message,
          shareUrl: link.url,
          pdfUrl: data.includePdf ? assets.pdf_url : undefined,
          annotatedUrl: data.includeAnnotated ? assets.annotated_image_url : undefined,
        },
      });
      if (result.sent) sent += 1;
      else skipped += 1;

      await logShareEvent({
        scanId: data.scanId,
        orgId,
        shareType: "email",
        userId,
        recipientEmail: email,
        payload: { delivered: result.sent, share_token: link.token },
      });
    }

    return { sent, skipped };
  });

/* ------------------------------ share w/ team ----------------------------- */

export type ShareWithTeamInput = {
  scanId: string;
  userIds: string[];
  note?: string | null;
  notifyInApp?: boolean;
  sendEmail?: boolean;
};

export const shareScanWithTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ShareWithTeamInput) => {
    const scanId = String(input?.scanId ?? "").trim();
    const userIds = [...new Set((input?.userIds ?? []).map((id) => String(id)).filter(Boolean))];
    if (!scanId) throw new Error("Missing scan.");
    if (!userIds.length) throw new Error("Select at least one team member.");
    return {
      scanId,
      userIds,
      note: input?.note ? String(input.note).slice(0, 500) : null,
      notifyInApp: input?.notifyInApp !== false,
      sendEmail: Boolean(input?.sendEmail),
    };
  })
  .handler(async ({ data, context }): Promise<{ shared: number; emailed: number; url: string }> => {
    const { supabase, userId } = context;
    const { requireScanAccess } = await import("@/lib/scan-share.server");
    const { orgId } = await requireScanAccess(supabase as never, data.scanId);

    const { data: members, error } = await supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("org_id", orgId)
      .eq("status", "active")
      .in("user_id", data.userIds);
    if (error) throw new Error(error.message);
    const recipientIds = (members ?? []).map((row: any) => row.user_id as string);
    if (!recipientIds.length) throw new Error("Those team members are no longer active.");

    const { data: me } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();
    const sharerName =
      ((me as any)?.full_name as string | null)?.trim() ||
      ((me as any)?.email as string | null) ||
      "A teammate";

    const { ensureShareLink, logShareEvent, scanShareSummary } = await import(
      "@/lib/scan-share.server"
    );
    const link = await ensureShareLink(data.scanId, orgId, userId);
    const summary = await scanShareSummary(data.scanId);
    const context_label = [summary.store_name, summary.location].filter(Boolean).join(" · ");

    if (data.notifyInApp) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: insertError } = await supabaseAdmin.from("notifications").insert(
        recipientIds.map((recipient) => ({
          user_id: recipient,
          org_id: orgId,
          type: "scan_shared",
          title: "Shelf audit shared with you",
          body: data.note || `${sharerName} shared a scan report${context_label ? ` · ${context_label}` : ""}`,
          payload: { scan_id: data.scanId, share_url: link.url } as never,
        })),
      );
      if (insertError) throw new Error(insertError.message);
    }

    let emailed = 0;
    if (data.sendEmail) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", recipientIds);
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const { signedScanAssets } = await import("@/lib/scan-share.server");
      const assets = await signedScanAssets(data.scanId, 86400);

      for (const profile of profiles ?? []) {
        const email = ((profile as any).email as string | null)?.toLowerCase();
        if (!email) continue;
        const result = await sendTemplateEmail("scan-report", email, {
          idempotencyKey: `scan-report-team-${data.scanId}-${link.token}-${email}`,
          templateData: {
            sharerName,
            storeName: summary.store_name,
            location: summary.location,
            category: [summary.category, summary.sub_category].filter(Boolean).join(" · "),
            scanDate: summary.scanned_at,
            healthScore: summary.shelf_health_score,
            productsDetected: summary.products_detected,
            compliancePercent: summary.planogram_compliance_percent,
            message: data.note,
            shareUrl: link.url,
            pdfUrl: assets.pdf_url,
            annotatedUrl: assets.annotated_image_url,
          },
        });
        if (result.sent) emailed += 1;
      }
    }

    await logShareEvent({
      scanId: data.scanId,
      orgId,
      shareType: "team",
      userId,
      payload: { user_ids: recipientIds, note: data.note, emailed },
    });

    return { shared: recipientIds.length, emailed, url: link.url };
  });

/* ---------------------------- public share page --------------------------- */

export const getSharedScan = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => {
    const token = String(input?.token ?? "").trim();
    if (!token) throw new Error("expired_or_invalid");
    return { token };
  })
  .handler(async ({ data }): Promise<SharedScanPayload> => {
    const { loadSharedScan } = await import("@/lib/scan-share.server");
    return loadSharedScan(data.token);
  });

