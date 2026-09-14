/**
 * Digital audit notifications — submit, exception, digest hooks (Wave 4).
 */

import { requireOrgId } from "@/lib/db/context";
import { notifyAuditManagers } from "@/lib/notifications.functions";

export async function notifyManagersAuditSubmitted(input: {
  assignmentId: string;
  scanId: string;
  storeName: string;
  assigneeName: string;
}): Promise<void> {
  const orgId = await requireOrgId();

  try {
    await notifyAuditManagers({
      data: {
        org_id: orgId,
        assignment_id: input.assignmentId,
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
    console.error("[audit-alerts] notify submit failed", e);
  }
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
