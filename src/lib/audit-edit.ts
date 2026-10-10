// Edit an existing audit (or recurring series) on the New audit page, or start
// a new audit pre-filled from a finished one ("Run again with changes").

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import { isOrgManager, type AuditMode, type ScopeType, type ScopeValues } from "@/lib/assignments";
import type { AuditEvidencePolicy } from "@/lib/audit-evidence-policy";
import type { OperatingModel } from "@/lib/audit-builder/types";
import type { DistributionEntry, DueConfig, RecurrenceRule } from "@/lib/assignment-engine/types";
import { scheduleRecurrenceRule } from "@/lib/audit-schedules";
import { notifyMember } from "@/lib/notifications.functions";

export type AuditEditKind = "assignment" | "series" | "rerun" | "rerun_scan";

export type AuditEditTarget = { kind: AuditEditKind; id: string };

/** Setup carried over unchanged unless the user picks "Change setup". */
export type KeptAuditSetup = {
  auditMode: AuditMode;
  scopeType: ScopeType;
  scopeValues: ScopeValues;
  templateId: string | null;
  templateVersion: number | null;
  templateSnapshot: Record<string, unknown> | null;
  planogramVersionId: string | null;
  inputSource: string | null;
  label: string;
};

export type EditableAudit = {
  target: AuditEditTarget;
  name: string;
  description: string;
  instructions: string;
  auditMode: AuditMode;
  operatingModel: OperatingModel | null;
  storeIds: string[];
  assigneeIds: string[];
  /** Store → person, from a series' distribution plan. */
  storeAssignees: Record<string, string>;
  dueAt: string | null;
  dueConfig: DueConfig;
  recurrence: RecurrenceRule | null;
  evidencePolicy: AuditEvidencePolicy | null;
  requireRca: boolean;
  reviewerId: string | null;
  setup: KeptAuditSetup | null;
  /** Work has begun, so store and setup are fixed. */
  started: boolean;
  /** Submitted, approved, completed or cancelled — only "run again" applies. */
  finished: boolean;
  canEdit: boolean;
};

const ASSIGNMENT_EDIT_COLUMNS =
  "id, store_id, assignee_id, assigner_id, scope_type, scope_values, due_at, instructions, status, approval_status, scan_id, audit_mode, template_id, template_version, template_snapshot, planogram_version_id, evidence_policy, require_rca, reviewer_id, input_source";

const SCHEDULE_EDIT_COLUMNS =
  "id, name, store_id, store_ids, assignee_id, assignee_ids, distribution_plan, scope_type, scope_values, audit_mode, cadence, day_of_week, day_of_month, next_run_at, timezone, recurrence_config, due_config, instructions, template_id, template_version, template_snapshot, evidence_policy, require_rca, reviewer_id, operating_model, created_by, status";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Assignments that are done: they can only be run again as a new audit. */
export function isFinishedAssignment(status: string | null, approval: string | null): boolean {
  if (status === "completed" || status === "cancelled") return true;
  return approval === "pending_review" || approval === "approved" || approval === "submitted";
}

export function describeAuditSetup(input: {
  auditMode: AuditMode;
  snapshot: Record<string, unknown> | null;
  scopeValues: ScopeValues;
}): string {
  const snapshot = input.snapshot ?? {};
  const reference = snapshot.reference as { rows?: unknown[] } | undefined;
  const count = Number(input.scopeValues.product_count ?? reference?.rows?.length ?? 0);
  const lines = count > 0 ? ` · ${count} ${count === 1 ? "line" : "lines"}` : "";
  if (input.auditMode === "ai") {
    switch (snapshot.planogram_mode) {
      case "reference":
        return `Your document${lines}`;
      case "custom":
        return `Your planogram${lines}`;
      case "demo":
        return "Aislix sample planogram";
      case "none":
        return "Shelf photos only";
      default:
        return "Shelf photos";
    }
  }
  const templateName = text(snapshot.name);
  if (templateName) return `${templateName}${lines}`;
  return count > 0 ? `Uploaded data${lines}` : "Custom audit";
}

function keptSetup(row: Record<string, unknown>, auditMode: AuditMode): KeptAuditSetup {
  const scopeValues = (row.scope_values ?? {}) as ScopeValues;
  const snapshot = (row.template_snapshot ?? null) as Record<string, unknown> | null;
  return {
    auditMode,
    scopeType: ((row.scope_type as ScopeType | null) ?? "location") as ScopeType,
    scopeValues,
    templateId: (row.template_id as string | null) ?? null,
    templateVersion: (row.template_version as number | null) ?? null,
    templateSnapshot: snapshot,
    planogramVersionId: (row.planogram_version_id as string | null) ?? null,
    inputSource: (row.input_source as string | null) ?? null,
    label: describeAuditSetup({ auditMode, snapshot, scopeValues }),
  };
}

async function canManage(ownerId: string | null): Promise<boolean> {
  const userId = await requireUserId();
  if (ownerId && ownerId === userId) return true;
  return isOrgManager();
}

export async function fetchEditableAudit(target: AuditEditTarget): Promise<EditableAudit> {
  const orgId = await requireOrgId();

  if (target.kind === "series") {
    const { data, error } = await supabase
      .from("audit_schedules")
      .select(SCHEDULE_EDIT_COLUMNS)
      .eq("org_id", orgId)
      .eq("id", target.id)
      .maybeSingle();
    if (error) dbError(error, "Could not load this recurring audit.");
    if (!data) throw new Error("This recurring audit no longer exists.");
    const row = data as Record<string, unknown>;
    const auditMode = (row.audit_mode as AuditMode) === "ai" ? "ai" : "digital";
    const scopeValues = (row.scope_values ?? {}) as ScopeValues;
    const storeIds = ((row.store_ids as string[] | null) ?? []).filter(Boolean);
    const assigneeIds = ((row.assignee_ids as string[] | null) ?? []).filter(Boolean);
    const plan = (Array.isArray(row.distribution_plan) ? row.distribution_plan : []) as DistributionEntry[];
    const storeAssignees: Record<string, string> = {};
    for (const entry of plan) for (const id of entry.storeIds ?? []) storeAssignees[id] = entry.assigneeId;
    const ownerId = (row.created_by as string | null) ?? null;
    return {
      target,
      name: text(row.name) || text(scopeValues.audit_name),
      description: text(scopeValues.audit_description),
      instructions: text(row.instructions),
      auditMode,
      operatingModel: (row.operating_model as OperatingModel | null) ?? null,
      storeIds: storeIds.length ? storeIds : row.store_id ? [row.store_id as string] : [],
      assigneeIds: assigneeIds.length ? assigneeIds : row.assignee_id ? [row.assignee_id as string] : [],
      storeAssignees,
      dueAt: null,
      dueConfig: (row.due_config ?? {}) as DueConfig,
      recurrence: scheduleRecurrenceRule(row),
      evidencePolicy: (row.evidence_policy as AuditEvidencePolicy | null) ?? null,
      requireRca: row.require_rca !== false,
      reviewerId: (row.reviewer_id as string | null) ?? null,
      setup: { ...keptSetup(row, auditMode), planogramVersionId: null, inputSource: null },
      started: false,
      finished: ["completed", "cancelled", "expired"].includes(String(row.status ?? "")),
      canEdit: await canManage(ownerId),
    };
  }

  if (target.kind === "rerun_scan") {
    const { data, error } = await supabase
      .from("shelf_scans")
      .select("id, store_id, audit_mode, shelf_label, category, created_by")
      .eq("org_id", orgId)
      .eq("id", target.id)
      .maybeSingle();
    if (error) dbError(error, "Could not load this audit.");
    if (!data) throw new Error("This audit no longer exists.");
    const row = data as Record<string, unknown>;
    return {
      target,
      name: text(row.shelf_label) || text(row.category),
      description: "",
      instructions: "",
      auditMode: row.audit_mode === "digital" ? "digital" : "ai",
      operatingModel: null,
      storeIds: row.store_id ? [row.store_id as string] : [],
      assigneeIds: [],
      storeAssignees: {},
      dueAt: null,
      dueConfig: {},
      recurrence: null,
      evidencePolicy: null,
      requireRca: true,
      reviewerId: null,
      setup: null,
      started: false,
      finished: true,
      canEdit: true,
    };
  }

  const { data, error } = await supabase
    .from("scan_assignments")
    .select(ASSIGNMENT_EDIT_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", target.id)
    .maybeSingle();
  if (error) dbError(error, "Could not load this audit.");
  if (!data) throw new Error("This audit no longer exists.");
  const row = data as Record<string, unknown>;
  const auditMode = (row.audit_mode as AuditMode) === "digital" ? "digital" : "ai";
  const scopeValues = (row.scope_values ?? {}) as ScopeValues;
  const status = (row.status as string | null) ?? null;
  const ownerId = (row.assigner_id as string | null) ?? null;
  return {
    target,
    name: text(scopeValues.audit_name),
    description: text(scopeValues.audit_description),
    instructions: text(row.instructions),
    auditMode,
    operatingModel: null,
    storeIds: row.store_id ? [row.store_id as string] : [],
    assigneeIds: row.assignee_id ? [row.assignee_id as string] : [],
    storeAssignees: {},
    dueAt: (row.due_at as string | null) ?? null,
    dueConfig: {},
    recurrence: null,
    evidencePolicy: (row.evidence_policy as AuditEvidencePolicy | null) ?? null,
    requireRca: row.require_rca !== false,
    reviewerId: (row.reviewer_id as string | null) ?? null,
    setup: keptSetup(row, auditMode),
    started: status !== "pending" || Boolean(row.scan_id),
    finished: isFinishedAssignment(status, (row.approval_status as string | null) ?? null),
    canEdit: target.kind === "rerun" ? true : await canManage(ownerId),
  };
}

export type AuditSetupPatch = Omit<KeptAuditSetup, "label">;

async function notify(input: {
  orgId: string;
  userId: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
}) {
  try {
    await notifyMember({
      data: {
        org_id: input.orgId,
        user_id: input.userId,
        type: "scan_assigned",
        title: input.title,
        body: input.body,
        payload: input.payload,
      },
    });
  } catch (error) {
    console.error("[audit-edit] notification failed", error);
  }
}

/** Update an open audit in place and tell the assignee what changed. */
export async function saveAssignmentEdit(input: {
  assignmentId: string;
  previousAssigneeId: string | null;
  auditName: string;
  storeId: string;
  storeName: string | null;
  assigneeId: string;
  dueAt: string | null;
  instructions: string;
  reviewerId: string | null;
  evidencePolicy: AuditEvidencePolicy;
  requireRca: boolean;
  scopeValues: ScopeValues;
  /** Omitted when the audit has started — store and setup stay as they are. */
  setup?: AuditSetupPatch;
}): Promise<void> {
  const orgId = await requireOrgId();
  const patch: Record<string, unknown> = {
    assignee_id: input.assigneeId,
    due_at: input.dueAt,
    instructions: input.instructions.trim() || null,
    reviewer_id: input.reviewerId,
    evidence_policy: input.evidencePolicy,
    require_rca: input.requireRca,
    scope_values: input.scopeValues,
    updated_at: new Date().toISOString(),
  };
  if (input.setup) {
    Object.assign(patch, {
      store_id: input.storeId,
      audit_mode: input.setup.auditMode,
      scope_type: input.setup.scopeType,
      template_id: input.setup.templateId,
      template_version: input.setup.templateVersion,
      template_snapshot: input.setup.templateSnapshot,
      planogram_version_id: input.setup.planogramVersionId,
      input_source: input.setup.inputSource,
    });
  }

  const { data, error } = await supabase
    .from("scan_assignments")
    .update(patch as never)
    .eq("org_id", orgId)
    .eq("id", input.assignmentId)
    .select("id");
  if (error) dbError(error, "Could not save the audit.");
  if (!data?.length) throw new Error("You don't have permission to edit this audit.");

  const where = input.storeName ? ` · ${input.storeName}` : "";
  const name = input.auditName.trim() || "An audit";
  const payload = { assignment_id: input.assignmentId, store_id: input.storeId };
  if (input.previousAssigneeId !== input.assigneeId) {
    await notify({
      orgId,
      userId: input.assigneeId,
      title: "Audit assigned to you",
      body: `${name}${where}`,
      payload,
    });
  } else {
    await notify({
      orgId,
      userId: input.assigneeId,
      title: "Audit updated",
      body: `${name}${where} was updated. Check the latest details before you start.`,
      payload,
    });
  }
}

/** Update a recurring series; changes apply to rounds created from now on. */
export async function saveSeriesEdit(input: {
  scheduleId: string;
  name: string;
  storeIds: string[];
  assigneeIds: string[];
  distribution: DistributionEntry[];
  recurrence: RecurrenceRule;
  nextRunAt: string | null;
  dueConfig: DueConfig;
  instructions: string;
  reviewerId: string | null;
  evidencePolicy: AuditEvidencePolicy;
  requireRca: boolean;
  operatingModel: OperatingModel;
  scopeValues: ScopeValues;
  setup: AuditSetupPatch;
}): Promise<void> {
  const orgId = await requireOrgId();
  const frequency = input.recurrence.frequency;
  const patch: Record<string, unknown> = {
    name: input.name.trim() || "Recurring audit",
    store_id: input.storeIds[0],
    store_ids: input.storeIds,
    assignee_id: input.assigneeIds[0],
    assignee_ids: input.assigneeIds,
    distribution_strategy: "manual",
    distribution_plan: input.distribution,
    scope_type: input.setup.scopeType,
    scope_values: input.scopeValues,
    audit_mode: input.setup.auditMode,
    cadence: frequency === "monthly" ? "monthly" : frequency === "daily" ? "daily" : "weekly",
    day_of_week: input.recurrence.daysOfWeek?.[0] ?? null,
    day_of_month: input.recurrence.dayOfMonth ?? null,
    timezone: input.recurrence.timezone,
    recurrence_config: input.recurrence,
    due_config: input.dueConfig,
    end_at: input.recurrence.endDate ? `${input.recurrence.endDate}T23:59:59` : null,
    max_occurrences: input.recurrence.maxOccurrences ?? null,
    instructions: input.instructions.trim() || null,
    template_id: input.setup.templateId,
    template_version: input.setup.templateVersion,
    template_snapshot: input.setup.templateSnapshot,
    evidence_policy: input.evidencePolicy,
    require_rca: input.requireRca,
    reviewer_id: input.reviewerId,
    operating_model: input.operatingModel,
    updated_at: new Date().toISOString(),
  };
  if (input.nextRunAt) patch.next_run_at = input.nextRunAt;

  const { data, error } = await supabase
    .from("audit_schedules")
    .update(patch as never)
    .eq("org_id", orgId)
    .eq("id", input.scheduleId)
    .select("id");
  if (error) dbError(error, "Could not save the recurring audit.");
  if (!data?.length) throw new Error("Only managers can change a recurring audit.");
}
