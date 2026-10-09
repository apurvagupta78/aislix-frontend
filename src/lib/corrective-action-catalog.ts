/**
 * Labels for the corrective action loop. Mirrors the SQL catalog in
 * supabase/migrations/20261005160000_corrective_actions_loop.sql (ca_action_type / ca_catalog).
 */

export type ActionType =
  | "availability"
  | "planogram"
  | "pricing"
  | "display"
  | "inventory"
  | "process"
  | "compliance"
  | "documentation"
  | "training"
  | "safety"
  | "hygiene";

export const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: "availability", label: "Availability" },
  { value: "planogram", label: "Planogram" },
  { value: "pricing", label: "Pricing" },
  { value: "display", label: "Display" },
  { value: "inventory", label: "Inventory" },
  { value: "process", label: "Process" },
  { value: "compliance", label: "Compliance" },
  { value: "documentation", label: "Documentation" },
  { value: "training", label: "Training" },
  { value: "safety", label: "Safety" },
  { value: "hygiene", label: "Hygiene" },
];

export function actionTypeLabel(value: string | null | undefined): string {
  return ACTION_TYPES.find((t) => t.value === value)?.label ?? "Other";
}

export type ActionSource = "ai" | "digital";

export const ACTION_SOURCES: { value: ActionSource; label: string }[] = [
  { value: "ai", label: "AI audit" },
  { value: "digital", label: "Digital audit" },
];

export function actionSourceLabel(value: string | null | undefined): string {
  return value === "digital" ? "Digital audit" : "AI audit";
}

/** The five stages people see. Raw statuses (assigned, rejected, resolved…) collapse into these. */
export type ActionStage = "open" | "in_progress" | "submitted" | "verified" | "closed";

export const ACTION_STAGES: { value: ActionStage; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "submitted", label: "Submitted" },
  { value: "verified", label: "Verified" },
  { value: "closed", label: "Closed" },
];

export function actionStage(status: string): ActionStage {
  if (status === "in_progress" || status === "rejected") return "in_progress";
  if (status === "pending_verification") return "submitted";
  if (status === "verified") return "verified";
  if (status === "closed" || status === "resolved") return "closed";
  return "open";
}

export function actionStageLabel(status: string): string {
  return ACTION_STAGES.find((s) => s.value === actionStage(status))?.label ?? "Open";
}

/**
 * Fixes an audit proposed that nobody approved yet, or that were rejected. They are not
 * corrective actions: no owner, no deadline, and left out of every action list and metric.
 */
export const UNREVIEWED_ACTION_STATUSES = ["proposed", "dismissed"] as const;
/** PostgREST filter value for `.not("status", "in", …)`. */
export const UNREVIEWED_STATUS_FILTER = `(${UNREVIEWED_ACTION_STATUSES.join(",")})`;

export function isUnreviewedAction(status: string): boolean {
  return (UNREVIEWED_ACTION_STATUSES as readonly string[]).includes(status);
}

/** Past due while the owner still has work to do (not waiting on verification). */
export function isActionLate(action: { status: string; due_at: string | null }, now = Date.now()): boolean {
  const stage = actionStage(action.status);
  if (stage !== "open" && stage !== "in_progress") return false;
  return Boolean(action.due_at && new Date(action.due_at).getTime() < now);
}

export function isActionDone(status: string): boolean {
  const stage = actionStage(status);
  return stage === "verified" || stage === "closed";
}

export type VerificationMethod = "ai_rescan" | "manager_review" | "document";

export function verificationMethodLabel(value: string | null | undefined): string {
  if (value === "ai_rescan") return "AI re-check photo";
  if (value === "document") return "Document check";
  return "Manager review";
}

export function evidenceLabel(value: string): string {
  if (value === "after_photo") return "After photo";
  if (value === "document") return "Document";
  if (value === "notes") return "Notes";
  return value.replace(/_/g, " ");
}

export const ROOT_CAUSE_OPTIONS = [
  "Shelf not refilled",
  "No backroom stock",
  "Supplier or distributor delay",
  "Planogram not followed",
  "Price change not updated",
  "Staff shortage",
  "Training gap",
  "Equipment or fixture issue",
  "Process not followed",
  "Other",
] as const;

export function requiresRootCause(priority: string): boolean {
  return priority === "critical" || priority === "high";
}

export function escalationLabel(level: number): string | null {
  if (level >= 2) return "Escalated to admins";
  if (level === 1) return "Escalated to manager";
  return null;
}
