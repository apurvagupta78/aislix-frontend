/**
 * Canonical assignment status labels for UI (maps existing DB status values).
 * Keep in sync with StatusBadge assignmentMeta.
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
};

export function assignmentStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return LABELS[status] ?? status;
}

export function assignmentStatusClassName(status: string | null | undefined): string {
  switch (status) {
    case "completed":
    case "approved":
      return "bg-accent-green/12 text-accent-green";
    case "in_progress":
    case "submitted":
      return "bg-brand-soft text-brand";
    case "needs_correction":
    case "reaudit_required":
    case "pending_review":
    case "overdue":
    case "pending":
      return "bg-amber-500/12 text-amber-700";
    case "cancelled":
    default:
      return "bg-muted text-muted-foreground";
  }
}
