import type { Assignment } from "@/lib/assignments";
import type { AssignmentConflict, AssignmentPlan, OrgAssignmentSettings } from "./types";

export function detectAssignmentConflicts(input: {
  plan: AssignmentPlan;
  existingAssignments: Assignment[];
  settings?: OrgAssignmentSettings | null;
}): AssignmentConflict[] {
  const { plan, existingAssignments, settings } = input;
  const conflicts: AssignmentConflict[] = [];
  const publishTime = plan.publishAt ? new Date(plan.publishAt) : new Date();

  for (const entry of plan.distribution) {
    const sameTime = existingAssignments.filter(
      (a) =>
        a.assignee_id === entry.assigneeId &&
        a.status !== "cancelled" &&
        a.status !== "completed" &&
        a.due_at &&
        Math.abs(new Date(a.due_at).getTime() - publishTime.getTime()) < 60 * 60 * 1000,
    );
    if (sameTime.length >= 3) {
      conflicts.push({
        id: `overlap-${entry.assigneeId}`,
        severity: settings?.blockOnConflict ? "blocking" : "warning",
        type: "employee_overlap",
        message: `${entry.assigneeName} already has ${sameTime.length} audits scheduled around this time.`,
        assigneeId: entry.assigneeId,
        assigneeName: entry.assigneeName,
      });
    }

    if (
      settings?.maxDailyAssignmentsPerEmployee != null &&
      entry.storeCount > settings.maxDailyAssignmentsPerEmployee
    ) {
      conflicts.push({
        id: `capacity-${entry.assigneeId}`,
        severity: settings.blockOnConflict ? "blocking" : "warning",
        type: "capacity_exceeded",
        message: `${entry.assigneeName} would receive ${entry.storeCount} assignments (max ${settings.maxDailyAssignmentsPerEmployee}/day).`,
        assigneeId: entry.assigneeId,
        assigneeName: entry.assigneeName,
      });
    }
  }

  for (const entry of plan.distribution) {
    for (const storeId of entry.storeIds) {
      const storeName =
        plan.locationScope.stores?.find((s) => s.id === storeId)?.name ?? storeId;
      const duplicate = existingAssignments.find(
        (a) =>
          a.store_id === storeId &&
          a.status !== "cancelled" &&
          a.status !== "completed" &&
          plan.templateId &&
          a.template_id === plan.templateId,
      );
      if (duplicate) {
        conflicts.push({
          id: `dup-${storeId}`,
          severity: "warning",
          type: "duplicate_schedule",
          message: `${storeName} already has an open assignment for this template.`,
          storeId,
          storeName,
        });
      }
    }
  }

  return conflicts;
}

export function hasBlockingConflicts(conflicts: AssignmentConflict[]): boolean {
  return conflicts.some((c) => c.severity === "blocking");
}
