/**
 * Server-only assignment email helpers (assign → assignee, submit → assignor).
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SendAuditAssignedEmailInput = {
  assignmentId: string;
  assigneeId: string;
  assignerId: string;
  storeId: string;
  auditMode: "ai" | "digital";
  dueAt?: string | null;
  scopeValues?: Record<string, unknown> | null;
};

export const sendAuditAssignedEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SendAuditAssignedEmailInput) => {
    if (!input?.assignmentId || !input?.assigneeId) throw new Error("Missing assignment.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const { serverAppOrigin } = await import("@/lib/app-origin");

    const [{ data: assignee }, { data: assigner }, { data: store }] = await Promise.all([
      supabase.from("profiles").select("email, full_name").eq("id", data.assigneeId).maybeSingle(),
      supabase.from("profiles").select("email, full_name").eq("id", data.assignerId).maybeSingle(),
      supabase.from("stores").select("name").eq("id", data.storeId).maybeSingle(),
    ]);

    const email = ((assignee as { email?: string | null } | null)?.email ?? "").trim().toLowerCase();
    if (!email) return { sent: false as const, reason: "no_email" as const };
    // Self-assign: still useful for reminder, but skip if same person requested silence — send anyway for My Work cue.

    const scope = (data.scopeValues ?? {}) as Record<string, unknown>;
    const myWorkUrl = `${serverAppOrigin()}/my-scans`;

    await sendTemplateEmail("audit-assigned", email, {
      idempotencyKey: `audit-assigned-${data.assignmentId}-${data.assigneeId}`,
      templateData: {
        assignerName:
          ((assigner as { full_name?: string | null } | null)?.full_name ?? "").trim() ||
          (assigner as { email?: string | null } | null)?.email ||
          "Your manager",
        assigneeName:
          ((assignee as { full_name?: string | null } | null)?.full_name ?? "").trim() ||
          email,
        storeName: (store as { name?: string | null } | null)?.name ?? null,
        location: typeof scope.location === "string" ? scope.location : null,
        category: typeof scope.category === "string" ? scope.category : null,
        subCategory: typeof scope.sub_category === "string" ? scope.sub_category : null,
        auditName: typeof scope.audit_name === "string" ? scope.audit_name : null,
        auditDescription:
          typeof scope.audit_description === "string" ? scope.audit_description : null,
        auditMode: data.auditMode,
        dueAt: data.dueAt ?? null,
        myWorkUrl,
      },
    });

    return { sent: true as const };
  });

export type SubmitAiAuditInput = {
  scanId: string;
  assignmentId?: string | null;
  notes?: string | null;
};

/**
 * Explicit AI audit Submit — emails assignor only after this succeeds.
 * Self-started audits without an assignment still mark the scan as submitted.
 */
export const submitAiAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SubmitAiAuditInput) => {
    if (!input?.scanId) throw new Error("Missing audit.");
    return {
      scanId: String(input.scanId).trim(),
      assignmentId: input.assignmentId ? String(input.assignmentId).trim() : null,
      notes: input.notes ? String(input.notes).slice(0, 2000) : null,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();

    const { data: scan, error: scanErr } = await supabase
      .from("shelf_scans")
      .select(
        "id, org_id, store_id, assignment_id, status, planogram_compliance_percent, shelf_health_score, total_products",
      )
      .eq("id", data.scanId)
      .maybeSingle();
    if (scanErr || !scan) throw new Error("Audit not found.");
    if ((scan as { status?: string }).status !== "completed") {
      throw new Error("Wait for analysis to finish before submitting.");
    }

    const assignmentId =
      data.assignmentId || ((scan as { assignment_id?: string | null }).assignment_id ?? null);

    let assignerId: string | null = null;
    let assigneeId: string | null = null;
    let assigneeName = "A team member";
    let storeName = "the store";
    let location = "assigned shelf";
    let compliance: number | null =
      (scan as { planogram_compliance_percent?: number | null }).planogram_compliance_percent ??
      null;

    if (assignmentId) {
      const { data: assignment } = await supabase
        .from("scan_assignments")
        .select(
          "id, assigner_id, assignee_id, store_id, scope_values, last_compliance_percent, status, org_id",
        )
        .eq("id", assignmentId)
        .maybeSingle();
      if (!assignment) throw new Error("Assignment not found.");

      assigneeId = (assignment.assignee_id as string | null) ?? null;
      assignerId = (assignment.assigner_id as string | null) ?? null;
      if (assigneeId && assigneeId !== userId && assignerId !== userId) {
        // Assignees submit their own work; assigners/managers may submit on their behalf.
        const { data: membership } = await supabase
          .from("organization_members")
          .select("role")
          .eq("org_id", assignment.org_id as string)
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();
        const role = String((membership as { role?: string } | null)?.role ?? "").toLowerCase();
        if (!["owner", "admin", "manager", "store_manager"].includes(role)) {
          throw new Error("Only the assignee or a manager can submit this audit.");
        }
      }

      if (assignment.last_compliance_percent != null) {
        compliance = Number(assignment.last_compliance_percent);
      }

      const scope = (assignment.scope_values ?? {}) as Record<string, unknown>;
      location =
        (typeof scope.location === "string" && scope.location) ||
        (typeof scope.category === "string" && scope.category) ||
        location;

      const [{ data: profile }, { data: store }] = await Promise.all([
        assigneeId
          ? supabase.from("profiles").select("full_name, email").eq("id", assigneeId).maybeSingle()
          : Promise.resolve({ data: null }),
        assignment.store_id
          ? supabase
              .from("stores")
              .select("name")
              .eq("id", assignment.store_id as string)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      assigneeName =
        ((profile as { full_name?: string | null } | null)?.full_name ?? "").trim() ||
        (profile as { email?: string | null } | null)?.email ||
        assigneeName;
      storeName = (store as { name?: string | null } | null)?.name ?? storeName;

      const openIssues = await countOpenActionsForAssignment(supabase, assignmentId);
      const passed = (compliance ?? 0) >= 100 && openIssues === 0;
      const nextStatus = passed ? "completed" : "needs_correction";

      const nextScope = {
        ...scope,
        ...(data.notes ? { submission_notes: data.notes } : {}),
      };

      const { data: updatedAsn, error: asnUpdateErr } = await supabase
        .from("scan_assignments")
        .update({
          scan_id: data.scanId,
          status: nextStatus,
          completed_at: passed ? now : null,
          updated_at: now,
          approval_status: "pending_review",
          assignment_state: "submitted",
          scope_values: nextScope,
          last_compliance_percent: compliance,
        } as never)
        .eq("id", assignmentId)
        .select("id")
        .maybeSingle();
      if (asnUpdateErr) {
        throw new Error(asnUpdateErr.message || "Could not update assignment after submit.");
      }
      if (!updatedAsn) {
        throw new Error("Could not update assignment after submit (permission denied).");
      }
    }

    await supabase
      .from("shelf_scans")
      .update({
        submission_status: "pending_review",
        submitted_at: now,
      } as never)
      .eq("id", data.scanId);

    // Assignor notify + email (skip self-assign)
    if (assignmentId && assignerId && assignerId !== assigneeId) {
      const percentLabel = compliance === null ? "—" : `${Math.round(compliance)}`;
      try {
        await supabase.from("notifications").insert({
          user_id: assignerId,
          org_id: (scan as { org_id: string }).org_id,
          type: "scan_completed",
          title: "Assigned audit submitted",
          body: `${assigneeName} submitted ${storeName} · ${location} (${percentLabel}% compliance)${data.notes ? ` — ${data.notes.slice(0, 120)}` : ""}`,
          payload: {
            assignment_id: assignmentId,
            scan_id: data.scanId,
            compliance_percent: compliance,
            submission_notes: data.notes,
          },
        } as never);
      } catch (e) {
        console.error("[submitAiAudit] notification failed", e);
      }

      try {
        const { data: assigner } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", assignerId)
          .maybeSingle();
        const email = ((assigner as { email?: string | null } | null)?.email ?? "")
          .trim()
          .toLowerCase();
        if (email) {
          const { scanShareSummary } = await import("@/lib/scan-share.server");
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          const { serverAppOrigin } = await import("@/lib/app-origin");
          const summary = await scanShareSummary(data.scanId);
          await sendTemplateEmail("audit-completed", email, {
            idempotencyKey: `audit-completed-submit-${data.scanId}-${assignerId}`,
            templateData: {
              assigneeName,
              storeName: summary.store_name ?? storeName,
              location: summary.location ?? location,
              category: summary.category,
              subCategory: summary.sub_category,
              auditName: summary.audit_name,
              auditDescription: summary.audit_description,
              scanDate: summary.scanned_at,
              healthScore: summary.shelf_health_score,
              productsDetected: summary.products_detected,
              compliancePercent: compliance ?? summary.planogram_compliance_percent,
              reportUrl: `${serverAppOrigin()}/results?scan=${encodeURIComponent(data.scanId)}`,
              message: data.notes,
            },
          });
        }
      } catch (e) {
        console.error("[submitAiAudit] email failed", e);
      }
    }

    return { ok: true as const, assignmentId };
  });

export const sendDigitalAssignerCompletionEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      assignmentId: string;
      scanId: string;
      storeName: string;
      assigneeName: string;
      notes?: string | null;
    }) => {
      if (!input?.assignmentId || !input?.scanId) throw new Error("Missing audit.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: assignment } = await supabase
      .from("scan_assignments")
      .select("assigner_id, assignee_id")
      .eq("id", data.assignmentId)
      .maybeSingle();
    const assignerId = (assignment as { assigner_id?: string | null } | null)?.assigner_id ?? null;
    const assigneeId = (assignment as { assignee_id?: string | null } | null)?.assignee_id ?? null;
    if (!assignerId || assignerId === assigneeId) return { sent: false as const };

    const { data: assigner } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", assignerId)
      .maybeSingle();
    const email = ((assigner as { email?: string | null } | null)?.email ?? "").trim().toLowerCase();
    if (!email) return { sent: false as const };

    const { scanShareSummary } = await import("@/lib/scan-share.server");
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const { serverAppOrigin } = await import("@/lib/app-origin");
    const summary = await scanShareSummary(data.scanId);

    await sendTemplateEmail("audit-completed", email, {
      idempotencyKey: `audit-completed-digital-${data.scanId}-${assignerId}`,
      templateData: {
        assigneeName: data.assigneeName,
        storeName: summary.store_name ?? data.storeName,
        location: summary.location,
        category: summary.category,
        subCategory: summary.sub_category,
        auditName: summary.audit_name,
        auditDescription: summary.audit_description,
        scanDate: summary.scanned_at,
        healthScore: summary.shelf_health_score,
        productsDetected: summary.products_detected,
        compliancePercent: summary.planogram_compliance_percent,
        reportUrl: `${serverAppOrigin()}/audit-review/${encodeURIComponent(data.scanId)}`,
        message: data.notes ?? null,
      },
    });
    return { sent: true as const };
  });

async function countOpenActionsForAssignment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  assignmentId: string,
): Promise<number> {
  const { data } = await supabase
    .from("planogram_comparisons")
    .select("id")
    .eq("assignment_id", assignmentId);
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  if (!ids.length) return 0;
  const { count } = await supabase
    .from("corrective_actions")
    .select("id", { count: "exact", head: true })
    .in("comparison_id", ids)
    .in("status", ["open", "in_progress"]);
  return count ?? 0;
}
