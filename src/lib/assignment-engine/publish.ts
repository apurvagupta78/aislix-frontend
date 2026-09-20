/**
 * Universal Assignment Engine — publish assignments, schedules, and campaigns.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import { createScanAssignment, type ScopeType, type ScopeValues } from "@/lib/assignments";
import { notifyMember } from "@/lib/notifications.functions";
import type { AssignmentPlan, AssignmentMode, ScheduleStatus } from "./types";
import { computeDueAt, computeNextOccurrence, zonedDateTimeToUtc } from "./recurrence";
import { filterDatasetForStore } from "@/lib/audit-builder/template-csv-merge";
import type { InputSchema } from "@/lib/audit-builder/field-roles";
import type { AuditInputDataset } from "@/lib/audit-input-dataset";

export type PublishResult = {
  campaignId?: string;
  scheduleId?: string;
  assignmentIds: string[];
  mode: AssignmentMode;
};

function cloneTemplateSnapshot(
  snapshot: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!snapshot) return null;
  return JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
}

/** Create per-store template snapshot — each assignment gets independent reference data. */
function snapshotForStore(
  base: Record<string, unknown> | null | undefined,
  storeId: string,
  storeName?: string,
): Record<string, unknown> | null {
  const snap = cloneTemplateSnapshot(base);
  if (!snap) return null;

  const purposeConfig = (snap.purpose_config ?? {}) as Record<string, unknown>;
  const inputSchema = purposeConfig.inputSchema as InputSchema | undefined;
  const inputDataset = (purposeConfig.input_dataset ?? snap.input_dataset) as
    | AuditInputDataset
    | undefined;

  if (inputDataset && inputSchema) {
    const filtered = filterDatasetForStore(inputDataset, inputSchema, storeId, storeName);
    const nextDataset = { ...filtered, store_id: storeId };
    snap.input_dataset = nextDataset;
    snap.purpose_config = {
      ...purposeConfig,
      input_dataset: nextDataset,
    };
  } else if (snap.input_dataset && typeof snap.input_dataset === "object") {
    const dataset = snap.input_dataset as Record<string, unknown>;
    snap.input_dataset = { ...dataset, store_id: storeId };
  }

  return snap;
}

export async function publishAssignmentPlan(plan: AssignmentPlan): Promise<PublishResult> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const assignmentIds: string[] = [];

  if (plan.mode === "recurring" || plan.mode === "schedule_once") {
    const scheduleId = await createUniversalSchedule(plan);
    if (plan.mode === "schedule_once") {
      return { scheduleId, assignmentIds: [], mode: plan.mode };
    }
    return { scheduleId, assignmentIds: [], mode: plan.mode };
  }

  // Assign Now — create campaign record optionally, then assignments
  let campaignId: string | undefined;
  if (plan.campaignName || plan.locationScope.storeIds.length > 1) {
    campaignId = await createCampaignDraft(plan, "published");
  }

  const timezone = plan.recurrence?.timezone ?? "Asia/Kolkata";
  const publishAt = new Date();
  const dueAt = computeDueAt(publishAt, plan.dueConfig, timezone);

  for (const entry of plan.distribution) {
    for (const storeId of entry.storeIds) {
      const storeMeta = plan.locationScope.stores?.find((s) => s.id === storeId);
      const scopeValues: ScopeValues = {
        ...plan.scopeValues,
        location: plan.scopeValues.location ?? storeMeta?.name ?? "Main",
      };

      const id = await createScanAssignment({
        storeId,
        scopeType: plan.scopeType,
        scopeValues,
        assigneeId: entry.assigneeId,
        assigneeName: entry.assigneeName,
        dueAt,
        instructions: plan.instructions,
        planogramVersionId: plan.planogramVersionId,
        auditMode: plan.auditMode,
        templateId: plan.templateId,
        templateVersion: plan.templateVersion,
        templateSnapshot: snapshotForStore(
          plan.templateSnapshot ?? undefined,
          storeId,
          storeMeta?.name,
        ),
        reviewerId: plan.reviewerId,
        evidencePolicy: plan.evidencePolicy,
        requireRca: plan.requireRca,
        creationSource: "unified_new_audit",
        inputSource: plan.inputSource as never,
      });

      await supabase
        .from("scan_assignments")
        .update({
          campaign_id: campaignId ?? null,
          scheduled_at: publishAt.toISOString(),
          assignment_state: "assigned",
          scope_values: {
            ...scopeValues,
            city: storeMeta?.city,
            country: storeMeta?.country,
          },
        } as Record<string, unknown>)
        .eq("id", id)
        .eq("org_id", orgId);

      assignmentIds.push(id);
    }
  }

  void userId;
  return { campaignId, assignmentIds, mode: plan.mode };
}

async function createCampaignDraft(
  plan: AssignmentPlan,
  status: "draft" | "published" | "scheduled",
): Promise<string> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from("assignment_campaigns")
    .insert({
      org_id: orgId,
      name: plan.campaignName ?? `${plan.templateName ?? "Audit"} — ${new Date().toLocaleDateString()}`,
      operating_model: plan.operatingModel,
      audit_purpose: plan.purpose,
      template_id: plan.templateId ?? null,
      template_version: plan.templateVersion ?? null,
      template_snapshot: plan.templateSnapshot ?? {},
      assignment_mode: plan.mode,
      schedule_config: {
        recurrence: plan.recurrence ?? null,
        publishAt: plan.publishAt ?? null,
        dueConfig: plan.dueConfig,
      },
      location_scope: plan.locationScope,
      team_scope: plan.teamScope,
      distribution_strategy: plan.distributionStrategy,
      distribution_plan: plan.distribution,
      evidence_policy: plan.evidencePolicy ?? null,
      require_rca: plan.requireRca,
      reviewer_id: plan.reviewerId ?? null,
      instructions: plan.instructions ?? null,
      status,
      expected_assignment_count: plan.distribution.reduce((s, d) => s + d.storeCount, 0),
      created_by: userId,
    } as Record<string, unknown>)
    .select("id")
    .single();

  if (error) {
    if (error.code === "42P01") {
      throw new Error("Assignment campaigns not available. Apply universal assignment migration.");
    }
    dbError(error, "Could not create assignment campaign.");
  }
  return data!.id as string;
}

export async function saveAssignmentDraft(plan: AssignmentPlan): Promise<string> {
  return createCampaignDraft(plan, "draft");
}

async function createUniversalSchedule(plan: AssignmentPlan): Promise<string> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const timezone = plan.recurrence?.timezone ?? "Asia/Kolkata";

  let publishAt: Date;
  if (plan.mode === "schedule_once" && plan.publishAt) {
    publishAt = new Date(plan.publishAt);
  } else if (plan.recurrence) {
    publishAt = zonedDateTimeToUtc(
      plan.recurrence.startDate,
      plan.recurrence.startTime,
      timezone,
    );
  } else {
    publishAt = new Date();
  }

  const nextRun = plan.recurrence
    ? computeNextOccurrence(plan.recurrence, publishAt)
    : publishAt;

  const primaryStore = plan.locationScope.storeIds[0];
  const primaryAssignee = plan.teamScope.assigneeIds[0];
  if (!primaryStore || !primaryAssignee) {
    throw new Error("Select at least one location and one assignee.");
  }

  const { data, error } = await supabase
    .from("audit_schedules")
    .insert({
      org_id: orgId,
      store_id: primaryStore,
      store_ids: plan.locationScope.storeIds,
      assignee_id: primaryAssignee,
      assignee_ids: plan.teamScope.assigneeIds,
      hierarchy_node_ids: plan.locationScope.hierarchyNodeIds ?? [],
      scope_type: plan.scopeType,
      scope_values: plan.scopeValues,
      audit_mode: plan.auditMode,
      cadence: plan.recurrence?.frequency === "monthly" ? "monthly" : plan.recurrence?.frequency === "daily" ? "daily" : "weekly",
      day_of_week: plan.recurrence?.daysOfWeek?.[0] ?? null,
      day_of_month: plan.recurrence?.dayOfMonth ?? null,
      next_run_at: (plan.mode === "schedule_once" ? publishAt : nextRun).toISOString(),
      publish_at: publishAt.toISOString(),
      instructions: plan.instructions?.trim() || null,
      created_by: userId,
      active: plan.mode === "recurring",
      name: plan.campaignName ?? plan.templateName ?? "Scheduled Audit",
      status: (plan.mode === "schedule_once" ? "scheduled" : "active") as ScheduleStatus,
      template_id: plan.templateId ?? null,
      template_version: plan.templateVersion ?? null,
      template_snapshot: plan.templateSnapshot ?? null,
      assignment_mode: plan.mode,
      timezone,
      recurrence_config: plan.recurrence ?? {},
      due_config: plan.dueConfig,
      distribution_strategy: plan.distributionStrategy,
      distribution_plan: plan.distribution,
      operating_model: plan.operatingModel,
      evidence_policy: plan.evidencePolicy ?? null,
      require_rca: plan.requireRca,
      reviewer_id: plan.reviewerId ?? null,
      end_at: plan.recurrence?.endDate ? `${plan.recurrence.endDate}T23:59:59` : null,
      max_occurrences: plan.recurrence?.maxOccurrences ?? null,
    } as Record<string, unknown>)
    .select("id")
    .single();

  if (error) {
    const rlsBlocked = /row-level security/i.test(error.message ?? "");
    dbError(
      error,
      rlsBlocked
        ? "Only managers can create Schedule Once or Recurring audits. Use Assign Now, or ask an org owner/admin to schedule."
        : "Could not create audit schedule.",
    );
  }
  return data!.id as string;
}

/**
 * @deprecated Use server-side process_due_audit_schedules RPC via triggerScheduleRun().
 * Kept for backward compatibility — delegates to server RPC.
 */
export async function processUniversalSchedules(): Promise<number> {
  const { triggerScheduleRun } = await import("./scheduler");
  const result = await triggerScheduleRun();
  return result.assignmentsCreated;
}

export async function bulkReassignAssignments(input: {
  assignmentIds: string[];
  newAssigneeId: string;
  newAssigneeName: string;
}): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase
    .from("scan_assignments")
    .update({
      assignee_id: input.newAssigneeId,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("org_id", orgId)
    .in("id", input.assignmentIds)
    .in("status", ["pending", "in_progress"]);

  if (error) dbError(error, "Could not reassign assignments.");

  for (const id of input.assignmentIds) {
    await notifyMember({
      userId: input.newAssigneeId,
      type: "scan_assigned",
      title: "Audit reassigned to you",
      body: "A manager reassigned an audit to you.",
      payload: { assignment_id: id },
    });
  }
}

export async function bulkCancelAssignments(assignmentIds: string[]): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase
    .from("scan_assignments")
    .update({
      status: "cancelled",
      assignment_state: "cancelled",
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("org_id", orgId)
    .in("id", assignmentIds)
    .in("status", ["pending", "in_progress"]);

  if (error) dbError(error, "Could not cancel assignments.");
}

export async function bulkExtendDueDate(input: {
  assignmentIds: string[];
  newDueAt: string;
}): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase
    .from("scan_assignments")
    .update({
      due_at: input.newDueAt,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("org_id", orgId)
    .in("id", input.assignmentIds);

  if (error) dbError(error, "Could not extend due dates.");
}
