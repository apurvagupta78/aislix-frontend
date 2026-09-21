/**
 * Canonical assignment status labels for UI (maps existing DB status values).
 * Locked set: Not Started · In Progress · Submitted · Pending Review ·
 * Approved · Re-audit Requested · Overdue (+ Cancelled).
 */

export type AssignmentUiStatus =
  | "pending"
  | "in_progress"
  | "needs_correction"
  | "completed"
  | "cancelled"
  | "overdue"
  | "submitted"
  | "pending_review"
  | "approved"
  | "reaudit_required";

const LABELS: Record<string, string> = {
  pending: "Not Started",
  in_progress: "In Progress",
  needs_correction: "Re-audit Requested",
  completed: "Approved",
  cancelled: "Cancelled",
  overdue: "Overdue",
  submitted: "Submitted",
  pending_review: "Pending Review",
  approved: "Approved",
  reaudit_required: "Re-audit Requested",
  /** Scan pipeline statuses when shown in All Audits Status column */
  processing: "In Progress",
  failed: "Failed",
  done: "Approved",
};

export function assignmentStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return LABELS[status] ?? status;
}

/** Prefer approval workflow over raw assignment.status when both exist. */
export function resolveAssignmentDisplayStatus(input: {
  status?: string | null;
  approval_status?: string | null;
  overdue?: boolean;
}): string {
  if (input.overdue) return "overdue";
  const approval = (input.approval_status ?? "").toLowerCase();
  if (approval === "pending_review") return "pending_review";
  if (approval === "approved") return "approved";
  if (approval === "rejected" || approval === "flagged") return "needs_correction";
  const status = (input.status ?? "").toLowerCase();
  if (status === "needs_correction" || status === "reaudit_required") return "needs_correction";
  if (status === "completed") return "approved";
  if (status === "in_progress") return "in_progress";
  if (status === "pending") return "pending";
  if (status === "cancelled") return "cancelled";
  if (status === "submitted") return "submitted";
  return status || "pending";
}

export function assignmentStatusClassName(status: string | null | undefined): string {
  switch (status) {
    case "completed":
    case "approved":
      return "bg-accent-green/12 text-accent-green";
    case "in_progress":
    case "submitted":
    case "processing":
      return "bg-brand-soft text-brand";
    case "needs_correction":
    case "reaudit_required":
    case "pending_review":
    case "overdue":
    case "pending":
      return "bg-amber-500/12 text-amber-700";
    case "failed":
      return "bg-destructive/10 text-destructive";
    case "cancelled":
    default:
      return "bg-muted text-muted-foreground";
  }
}
