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

/** What needs correcting. Mirrors public.ca_issue_category in the database. */
export type IssueCategory =
  | "location"
  | "facing"
  | "branding"
  | "planogram"
  | "hygiene"
  | "quality"
  | "damaged"
  | "expired"
  | "rotten"
  | "less_quantity"
  | "more_quantity"
  | "remove_item"
  | "refill_item"
  | "other";

export const ISSUE_CATEGORIES: { value: IssueCategory; label: string }[] = [
  { value: "location", label: "Location issue" },
  { value: "facing", label: "Product facing issue" },
  { value: "branding", label: "Branding issue" },
  { value: "planogram", label: "Planogram compliance" },
  { value: "hygiene", label: "Hygiene" },
  { value: "quality", label: "Quality" },
  { value: "damaged", label: "Damaged" },
  { value: "expired", label: "Expired" },
  { value: "rotten", label: "Rotten" },
  { value: "less_quantity", label: "Less quantity" },
  { value: "more_quantity", label: "More quantity" },
  { value: "remove_item", label: "Remove the item" },
  { value: "refill_item", label: "Refill the item" },
  { value: "other", label: "Other" },
];

export function issueCategoryLabel(value: string | null | undefined): string {
  return ISSUE_CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

/** Saved issue type, or the same classification the database uses for older rows. */
export function issueCategoryOf(a: {
  issue_category?: string | null;
  issue_type?: string | null;
  action_type?: string | null;
  title?: string | null;
  suggestion?: string | null;
}): IssueCategory {
  if (ISSUE_CATEGORIES.some((c) => c.value === a.issue_category)) return a.issue_category as IssueCategory;
  const t = (a.issue_type ?? "").toLowerCase();
  const h = `${a.title ?? ""} ${a.suggestion ?? ""}`.toLowerCase();
  const act = (a.action_type ?? "").toLowerCase();
  if (/facing/.test(t)) return "facing";
  if (/rotten|spoil|mould|mold/.test(t)) return "rotten";
  if (/expir/.test(t)) return "expired";
  if (/damage/.test(t)) return "damaged";
  if (/hygien|dirty|unclean|spill/.test(t)) return "hygiene";
  if (/quality/.test(t)) return "quality";
  if (/placement|location|wrong_category|unexpected|misplac|wrong_aisle/.test(t)) return "location";
  if (/planogram/.test(t)) return "planogram";
  if (/excess|overstock|surplus/.test(t)) return "more_quantity";
  if (/qty|quantity|shortage|missing|out_of_stock|oos|low_stock|empty|gap|refill|replenish/.test(t)) {
    return /extra|excess|overstock|too many/.test(h) ? "more_quantity" : "less_quantity";
  }
  if (/brand|display|wrong_product|variant|promo/.test(t)) return "branding";
  if (/pric/.test(t)) return "other";
  if (/facing/.test(h)) return "facing";
  if (/location|placement|aisle|misplaced/.test(h)) return "location";
  if (/expir/.test(h)) return "expired";
  if (/damage/.test(h)) return "damaged";
  if (act === "hygiene") return "hygiene";
  if (act === "availability" || act === "inventory") return "less_quantity";
  if (act === "display") return "branding";
  if (act === "planogram") return "planogram";
  return "other";
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
