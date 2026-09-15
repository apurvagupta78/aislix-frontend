import type { AssignmentPlan, AssignmentPreview } from "./types";
import { formatScheduleLabel } from "./recurrence";
import { summarizeLocationScope } from "./distribution";
import type { AssignmentConflict } from "./types";

export function buildAssignmentPreview(
  plan: AssignmentPlan,
  conflicts: AssignmentConflict[] = [],
): AssignmentPreview {
  const { cities, countries } = summarizeLocationScope(plan.locationScope);
  const expectedAssignments = plan.distribution.reduce((sum, d) => sum + d.storeCount, 0);

  let scheduleLabel = "Start immediately";
  if (plan.mode === "schedule_once" && plan.publishAt) {
    scheduleLabel = new Date(plan.publishAt).toLocaleString();
  } else if (plan.mode === "recurring" && plan.recurrence) {
    scheduleLabel = formatScheduleLabel(plan.recurrence);
  }

  let dueLabel = "No due date";
  if (plan.dueConfig.dueDate && plan.dueConfig.dueTime) {
    dueLabel = `${plan.dueConfig.dueDate} ${plan.dueConfig.dueTime}`;
  } else if (plan.dueConfig.dueOffsetHours != null) {
    dueLabel = `${plan.dueConfig.dueOffsetHours}h after publish`;
  }

  return {
    templateName: plan.templateName ?? "Custom Audit",
    mode: plan.mode,
    scheduleLabel,
    locationCount: plan.locationScope.storeIds.length,
    cities,
    countries,
    teamCount: plan.teamScope.assigneeIds.length,
    expectedAssignments,
    distribution: plan.distribution,
    conflicts,
    dueLabel,
  };
}
