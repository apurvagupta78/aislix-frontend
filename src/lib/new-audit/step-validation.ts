import type { AuditEvidencePolicy, EvidenceLevel } from "@/lib/audit-evidence-policy";
import type { AssignmentMode, TeamScope } from "@/lib/assignment-engine";
import type { NewAuditPlanogramChoice } from "@/lib/new-audit/planogram-setup";
import type { CaptureMethod, StartChoice } from "@/lib/new-audit/summary";
import type { ScanContextState } from "@/lib/scan-context";

/** Live Step 3 readiness for AI audits — no separate “continue” gate. */
export function isAiStep3Ready(
  choice: NewAuditPlanogramChoice | null,
  ctx: ScanContextState,
): boolean {
  if (!choice) return false;
  const category = ctx.planogramMeta?.category?.trim();
  const sub = ctx.planogramMeta?.sub_category?.trim();
  if (!category || !sub) return false;
  if (choice === "with_demo") return ctx.planogramRows.length > 0;
  return true;
}

export type NewAuditStepId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type NewAuditNavStep = {
  id: NewAuditStepId;
  label: string;
  anchor: string;
};

export const DIGITAL_AUDIT_STEPS: NewAuditNavStep[] = [
  { id: 1, label: "Details", anchor: "step-1-details" },
  { id: 2, label: "Perform", anchor: "step-2-perform" },
  { id: 3, label: "Start", anchor: "step-3-start" },
  { id: 4, label: "Who", anchor: "step-4-who" },
  { id: 5, label: "When", anchor: "step-5-when" },
  { id: 6, label: "Evidence", anchor: "step-6-evidence" },
  { id: 7, label: "Preview", anchor: "step-7-preview" },
];

export const AI_AUDIT_STEPS: NewAuditNavStep[] = [
  { id: 1, label: "Details", anchor: "step-1-details" },
  { id: 2, label: "Perform", anchor: "step-2-perform" },
  { id: 3, label: "Start", anchor: "step-3-start" },
  { id: 4, label: "Who", anchor: "step-4-who" },
  { id: 5, label: "When", anchor: "step-5-when" },
  { id: 6, label: "Preview", anchor: "step-6-preview" },
  { id: 7, label: "Capture", anchor: "step-7-capture" },
];

/** @deprecated use getNewAuditNavSteps */
export const NEW_AUDIT_STEPS = DIGITAL_AUDIT_STEPS;

export function getNewAuditNavSteps(
  method: CaptureMethod,
  assignToSelf: boolean,
  assignmentMode: AssignmentMode = "assign_now",
): NewAuditNavStep[] {
  if (method !== "ai") return DIGITAL_AUDIT_STEPS;
  const needsImmediateCapture = assignToSelf && assignmentMode === "assign_now";
  if (needsImmediateCapture) return AI_AUDIT_STEPS;
  return AI_AUDIT_STEPS.filter((step) => step.id <= 6);
}

export type StepValidationInput = {
  auditName: string;
  startChoice: StartChoice;
  startReady: boolean;
  method: CaptureMethod;
  aiPlanogramChoice: NewAuditPlanogramChoice | null;
  demoScanContext: ScanContextState;
  assignToSelf: boolean;
  teamScope: TeamScope;
  assigneeId: string;
  assignmentMode: AssignmentMode;
  publishAt: string;
  evidenceLevel: EvidenceLevel;
  evidencePolicy: AuditEvidencePolicy;
  reviewerId: string;
  hasBlockingConflicts: boolean;
  captureReady?: boolean;
};

export type StepValidationResult = Record<NewAuditStepId, boolean>;

export function validateNewAuditSteps(input: StepValidationInput): StepValidationResult {
  const step1 = input.auditName.trim().length > 0;
  const step2 = input.method === "digital" || input.method === "ai";
  const step3 =
    input.method === "digital"
      ? input.startReady
      : input.method === "ai"
        ? isAiStep3Ready(input.aiPlanogramChoice, input.demoScanContext)
        : false;
  const step4 =
    input.assignToSelf ||
    input.teamScope.assigneeIds.length > 0 ||
    Boolean(input.assigneeId);

  const step5 =
    (input.assignmentMode !== "schedule_once" || Boolean(input.publishAt)) &&
    !input.hasBlockingConflicts;

  if (input.method === "ai") {
    const step6 = step1 && step2 && step3 && step4 && step5;
    const needsImmediateCapture =
      input.assignToSelf && input.assignmentMode === "assign_now";
    const step7 = step6 && needsImmediateCapture && Boolean(input.captureReady);
    return {
      1: step1,
      2: step2,
      3: step3,
      4: step4,
      5: step5,
      6: step6,
      7: step7,
      8: false,
    };
  }

  const step6 =
    Boolean(input.evidenceLevel) &&
    (input.evidencePolicy.reviewMode !== "independent" || Boolean(input.reviewerId));
  const step7 = step1 && step2 && step3 && step4 && step5 && step6;

  return {
    1: step1,
    2: step2,
    3: step3,
    4: step4,
    5: step5,
    6: step6,
    7: step7,
    8: false,
  };
}

export function scrollToNewAuditStep(anchor: string) {
  document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
