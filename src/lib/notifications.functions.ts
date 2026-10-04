/**
 * Server-side notification delivery.
 *
 * The client-side insert policy requires the recipient to be an *active* member,
 * which silently drops notifications for freshly invited teammates. This server
 * function verifies the caller manages the org and then writes the row with
 * elevated privileges so delivery never fails silently.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MANAGER_ROLES = ["owner", "admin", "manager"];

export type NotifyMemberInput = {
  org_id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string | null;
  payload?: Record<string, unknown>;
};

export const notifyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: NotifyMemberInput) => {
    const orgId = String(input?.org_id ?? "").trim();
    const userId = String(input?.user_id ?? "").trim();
    if (!orgId || !userId) throw new Error("Missing notification recipient.");
    return {
      org_id: orgId,
      user_id: userId,
      type: String(input?.type ?? "announcement").slice(0, 64),
      title: String(input?.title ?? "Notification").slice(0, 200),
      body: input?.body ? String(input.body).slice(0, 2000) : null,
      payload: (JSON.stringify(input?.payload ?? {}).length <= 8000
        ? (input?.payload ?? {})
        : {}) as Record<string, unknown>,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: me, error } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", data.org_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!me || !MANAGER_ROLES.includes(String(me.role).toLowerCase())) {
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: recipient } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("org_id", data.org_id)
      .eq("user_id", data.user_id)
      .in("status", ["active", "invited"])
      .maybeSingle();
    if (!recipient) throw new Error("That person is not on this workspace.");

    const { error: insertError } = await supabaseAdmin.from("notifications").insert({
      user_id: data.user_id,
      org_id: data.org_id,
      type: data.type,
      title: data.title,
      body: data.body,
      payload: data.payload as never,
    });
    if (insertError) throw new Error(insertError.message);
    return { ok: true };
  });

/**
 * Tell the right people a submitted audit is waiting for them, following the assignment's
 * review requirement: the chosen reviewer (Independent reviewer) or every manager
 * (Manager review / Supervisor receipt). Nobody is notified when no review is needed.
 */
export const notifyAuditSubmitted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { org_id: string; assignment_id: string; scan_id: string }) => ({
    org_id: String(input?.org_id ?? "").trim(),
    assignment_id: String(input?.assignment_id ?? "").trim(),
    scan_id: String(input?.scan_id ?? "").trim(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.org_id || !data.assignment_id || !data.scan_id)
      throw new Error("Missing audit details.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: assignment } = await supabaseAdmin
      .from("scan_assignments")
      .select("assignee_id, reviewer_id, evidence_policy, template_snapshot, stores(name)")
      .eq("id", data.assignment_id)
      .eq("org_id", data.org_id)
      .maybeSingle();
    if (!assignment) throw new Error("Assignment not found.");

    if (assignment.assignee_id !== userId) {
      const { data: me } = await supabase
        .from("organization_members")
        .select("role")
        .eq("org_id", data.org_id)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      if (!me || !MANAGER_ROLES.includes(String(me.role).toLowerCase()))
        throw new Error("Forbidden");
    }

    const policy = (assignment.evidence_policy ?? {}) as { reviewMode?: string };
    const mode = policy.reviewMode ?? "manager";
    if (mode === "none") return { ok: true, count: 0 };

    let recipients: string[];
    if (mode === "independent" && assignment.reviewer_id) {
      recipients = [assignment.reviewer_id as string];
    } else {
      const { data: managers } = await supabaseAdmin
        .from("organization_members")
        .select("user_id")
        .eq("org_id", data.org_id)
        .eq("status", "active")
        .in("role", MANAGER_ROLES as never);
      recipients = (managers ?? []).map((m) => m.user_id as string);
    }
    recipients = [...new Set(recipients)].filter((id) => id && id !== assignment.assignee_id);
    if (!recipients.length) return { ok: true, count: 0 };

    const auditName =
      String((assignment.template_snapshot as { name?: string } | null)?.name ?? "").trim() ||
      "Audit";
    const storeName = String((assignment.stores as { name?: string } | null)?.name ?? "").trim();
    const where = storeName ? ` at ${storeName}` : "";
    const receipt = mode === "supervisor_receipt";
    const { error } = await supabaseAdmin.from("notifications").insert(
      recipients.map((user_id) => ({
        user_id,
        org_id: data.org_id,
        type: receipt ? "audit_receipt_requested" : "audit_review_requested",
        title: receipt
          ? `Confirm you received: ${auditName}${where}`
          : `Review needed: ${auditName}${where}`,
        body:
          mode === "independent"
            ? "You're the reviewer for this audit. Only you can approve it."
            : receipt
              ? "A supervisor needs to confirm this audit was received."
              : "A submitted audit is waiting for a manager to approve, flag or reject it.",
        payload: {
          scan_id: data.scan_id,
          assignment_id: data.assignment_id,
          review_mode: mode,
        } as never,
      })),
    );
    if (error) throw new Error(error.message);
    return { ok: true, count: recipients.length };
  });

/** Notify all managers — callable by assignee after digital audit submit. */
export const notifyAuditManagers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      org_id: string;
      assignment_id: string;
      type: string;
      title: string;
      body?: string | null;
      payload?: Record<string, unknown>;
    }) => ({
      org_id: String(input.org_id),
      assignment_id: String(input.assignment_id),
      type: String(input.type),
      title: String(input.title),
      body: input.body ? String(input.body) : null,
      payload: (input.payload ?? {}) as Record<string, unknown>,
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: assignment } = await supabase
      .from("scan_assignments")
      .select("assignee_id, org_id")
      .eq("id", data.assignment_id)
      .eq("org_id", data.org_id)
      .maybeSingle();
    if (!assignment) throw new Error("Assignment not found.");
    const isAssignee = assignment.assignee_id === userId;

    const { data: me } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", data.org_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    const isManager = me && MANAGER_ROLES.includes(String(me.role).toLowerCase());
    if (!isAssignee && !isManager) throw new Error("Forbidden");

    const { data: managers } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("org_id", data.org_id)
      .eq("status", "active")
      .in("role", MANAGER_ROLES);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const mgr of managers ?? []) {
      await supabaseAdmin.from("notifications").insert({
        user_id: mgr.user_id as string,
        org_id: data.org_id,
        type: data.type,
        title: data.title,
        body: data.body,
        payload: data.payload as never,
      });
    }
    return { ok: true, count: managers?.length ?? 0 };
  });
