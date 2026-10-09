/**
 * Fixes an audit proposes are reviewed by the auditor or a manager before they become
 * corrective actions. Approving starts the owner's SLA; rejecting dismisses the fix;
 * a re-audit discards every proposed fix and sends the auditor back to the shelf.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError } from "@/lib/db/context";
import { createScanAssignment, type AuditMode } from "@/lib/assignments";
import { requestReaudit } from "@/lib/reaudit";
import type { FindingSeverity } from "@/lib/findings";
import { collapseRepeatedWords } from "@/lib/finding-subject";

export type ProposedFixStatus = "proposed" | "approved" | "dismissed";

export type ProposedFix = {
  id: string;
  code: string | null;
  title: string;
  detail: string | null;
  priority: FindingSeverity;
  issueType: string;
  sku: string | null;
  slaType: string | null;
  slaMinutes: number | null;
  review: ProposedFixStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
};

export type ScanFixes = {
  fixes: ProposedFix[];
  canReview: boolean;
};

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function reviewState(status: string): ProposedFixStatus {
  if (status === "proposed") return "proposed";
  if (status === "dismissed") return "dismissed";
  return "approved";
}

export async function fetchScanFixes(scanId: string): Promise<ScanFixes> {
  const [{ data, error }, { data: canReview }] = await Promise.all([
    supabase
      .from("corrective_actions")
      .select(
        "id, code, title, description, suggestion, priority, issue_type, sku, sla_type, sla_minutes, status, review_note, reviewed_at",
      )
      .eq("scan_id", scanId),
    supabase.rpc("can_review_scan_actions" as never, { p_scan_id: scanId } as never),
  ]);
  if (error) dbError(error, "Could not load the fixes for this audit.");
  const fixes = ((data ?? []) as unknown as Record<string, unknown>[])
    .map(
      (row): ProposedFix => ({
        id: String(row.id),
        code: (row.code as string | null) ?? null,
        title: collapseRepeatedWords(String(row.title ?? row.suggestion ?? "Fix")),
        detail: (row.description as string | null) ?? null,
        priority: (String(row.priority ?? "medium") as FindingSeverity),
        issueType: String(row.issue_type ?? ""),
        sku: (row.sku as string | null) ?? null,
        slaType: (row.sla_type as string | null) ?? null,
        slaMinutes: row.sla_minutes == null ? null : Number(row.sla_minutes),
        review: reviewState(String(row.status)),
        reviewNote: (row.review_note as string | null) ?? null,
        reviewedAt: (row.reviewed_at as string | null) ?? null,
      }),
    )
    .sort(
      (a, b) =>
        (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9) ||
        a.title.localeCompare(b.title),
    );
  return { fixes, canReview: canReview === true };
}

export async function reviewScanFixes(input: {
  scanId: string;
  approveIds: string[];
  rejectIds: string[];
  note?: string | null;
}): Promise<{ approved: number; rejected: number }> {
  const { data, error } = await supabase.rpc(
    "review_scan_actions" as never,
    {
      p_scan_id: input.scanId,
      p_approve: input.approveIds,
      p_reject: input.rejectIds,
      p_note: input.note?.trim() || null,
    } as never,
  );
  if (error) dbError(error, "Could not save your review.");
  const result = (data ?? {}) as { approved?: number; rejected?: number };
  return { approved: Number(result.approved ?? 0), rejected: Number(result.rejected ?? 0) };
}

/**
 * Discards every proposed fix and assigns a fresh audit of the same store and shelf to
 * the person who ran this one. Returns false when the audit has no store to re-assign.
 */
export async function requestReauditForFixes(input: {
  scanId: string;
  reason: string;
}): Promise<{ assignmentCreated: boolean }> {
  const reason = input.reason.trim() || "The proposed fixes did not match the shelf.";
  const { data: scan, error } = await supabase
    .from("shelf_scans")
    .select("store_id, assignment_id, created_by, category, audit_mode, profiles:created_by (full_name, email)")
    .eq("id", input.scanId)
    .maybeSingle();
  if (error) dbError(error, "Could not load this audit.");

  const row = (scan ?? {}) as Record<string, unknown>;
  const auditorId = (row.created_by as string | null) ?? null;
  const profile = row.profiles as { full_name?: string | null; email?: string | null } | null;
  const auditorName = profile?.full_name?.trim() || profile?.email?.trim() || "Auditor";
  const storeId = (row.store_id as string | null) ?? null;
  const assignmentId = (row.assignment_id as string | null) ?? null;

  let assignmentCreated = false;
  if (auditorId && assignmentId) {
    await requestReaudit({
      scanId: input.scanId,
      assignmentId,
      reason,
      assigneeId: auditorId,
      assigneeName: auditorName,
    });
    assignmentCreated = true;
  } else if (auditorId && storeId) {
    const category = (row.category as string | null)?.trim();
    await createScanAssignment({
      storeId,
      assigneeId: auditorId,
      assigneeName: auditorName,
      scopeType: "category",
      scopeValues: category ? { category } : {},
      planogramVersionId: null,
      auditMode: ((row.audit_mode as AuditMode | null) ?? "ai") as AuditMode,
      instructions: `Re-audit of previous audit. Reason: ${reason}`,
    });
    assignmentCreated = true;
  }

  const { error: dismissError } = await supabase.rpc(
    "dismiss_scan_actions_for_reaudit" as never,
    { p_scan_id: input.scanId, p_note: reason } as never,
  );
  if (dismissError) dbError(dismissError, "Could not discard the proposed fixes.");
  return { assignmentCreated };
}
