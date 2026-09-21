/**
 * Digital audit notifications — submit, exception, digest hooks (Wave 4).
 */

import { requireOrgId } from "@/lib/db/context";
import { supabase } from "@/integrations/supabase/client";
import { notifyMember, notifyAuditManagers } from "@/lib/notifications.functions";

/** In-app notify assigner only; email via server fn. */
export async function notifyAssignerAuditSubmitted(input: {
  assignmentId: string;
  scanId: string;
  storeName: string;
  assigneeName: string;
}): Promise<void> {
  const orgId = await requireOrgId();

  const { data: assignment } = await supabase
    .from("scan_assignments")
    .select("assigner_id, assignee_id")
    .eq("id", input.assignmentId)
    .maybeSingle();

  const assignerId = (assignment as { assigner_id?: string | null } | null)?.assigner_id ?? null;
  const assigneeId = (assignment as { assignee_id?: string | null } | null)?.assignee_id ?? null;
  if (!assignerId || assignerId === assigneeId) return;

  try {
    await notifyMember({
      data: {
        org_id: orgId,
        user_id: assignerId,
        type: "audit_pending_review",
        title: "Digital audit ready for review",
        body: `${input.assigneeName} submitted a digital audit for ${input.storeName}.`,
        payload: {
          assignment_id: input.assignmentId,
          scan_id: input.scanId,
        },
      },
    });
  } catch (e) {
    console.error("[audit-alerts] notify assigner failed", e);
  }

  try {
    const { sendDigitalAssignerCompletionEmail } = await import(
      "@/lib/assignment-emails.functions"
    );
    await sendDigitalAssignerCompletionEmail({
      data: {
        assignmentId: input.assignmentId,
        scanId: input.scanId,
        storeName: input.storeName,
        assigneeName: input.assigneeName,
      },
    });
  } catch (e) {
    console.error("[audit-alerts] assigner email failed", e);
  }
}

export async function notifyManagersAuditSubmitted(input: {
  assignmentId: string;
  scanId: string;
  storeName: string;
  assigneeName: string;
}): Promise<void> {
  // Launch lock: notify the assigner only (not all managers).
  await notifyAssignerAuditSubmitted(input);
}

export async function notifyManagersVarianceException(input: {
  assignmentId: string;
  scanId: string;
  storeName: string;
  totalVarianceInr: number;
  criticalCount: number;
}): Promise<void> {
  if (input.criticalCount === 0 && Math.abs(input.totalVarianceInr) < 10_000) return;

  const orgId = await requireOrgId();

  try {
    await notifyAuditManagers({
      data: {
        org_id: orgId,
        assignment_id: input.assignmentId,
        type: "audit_exception",
        title: "Audit variance exception",
        body: `${input.storeName}: ₹${Math.abs(input.totalVarianceInr).toFixed(0)} total variance (${input.criticalCount} critical SKU(s)).`,
        payload: { scan_id: input.scanId },
      },
    });
  } catch (e) {
    console.error("[audit-alerts] notify exception failed", e);
  }
}
