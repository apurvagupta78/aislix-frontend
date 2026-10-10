import type { AuditEvidencePolicy, EvidenceLevel } from "@/lib/audit-evidence-policy";
import type { AssignmentMode, TeamScope } from "@/lib/assignment-engine";
import type { NewAuditPlanogramChoice } from "@/lib/new-audit/planogram-setup";
import type { CaptureMethod, StartChoice } from "@/lib/new-audit/summary";
import type { ScanContextState } from "@/lib/scan-context";
import { usableReferenceRows } from "@/lib/ai-audit/reference-document";

/** Live Step 3 readiness for AI audits — no separate “continue” gate. */
export function isAiStep3Ready(
  choice: NewAuditPlanogramChoice | null,
  ctx: ScanContextState,
): boolean {
  if (!choice) return false;
  if (choice === "reference") {
    return ctx.reference?.saved !== false && usableReferenceRows(ctx.reference?.rows ?? []).length > 0;
  }
  const category = ctx.planogramMeta?.category?.trim();
  const sub = ctx.planogramMeta?.sub_category?.trim();
  if (!category || !sub) return false;
  if (choice === "with_demo") return ctx.planogramRows.length > 0;
  return true;
}

/** What is still missing in AI audit Step 3, or null when ready. */
export function aiStep3Error(
  choice: NewAuditPlanogramChoice | null,
  ctx: ScanContextState,
  analysisReady: boolean,
): string | null {
  if (!choice) return "Upload your document to continue.";
  if (!isAiStep3Ready(choice, ctx)) {
    if (choice === "with_demo") return "Complete category, sub-category, and planogram upload.";
    if (choice === "reference") {
      if (ctx.reference?.saved === false) return "Save your document lines to continue.";
      return ctx.reference?.meta?.source === "manual"
        ? "Type at least one product to continue."
        : "Upload your document or CSV to continue.";
    }
    return "Choose a category and sub-category.";
  }
  if (!analysisReady) return "Tick at least one thing for AI to analyse, or ask a question.";
  return null;
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
  { id: 4, label: "Where", anchor: "step-4-where" },
  { id: 5, label: "Who", anchor: "step-5-who" },
  { id: 6, label: "When", anchor: "step-6-when" },
  { id: 7, label: "Preview", anchor: "step-7-preview" },
];

export const AI_AUDIT_STEPS: NewAuditNavStep[] = [
  ...DIGITAL_AUDIT_STEPS,
  { id: 8, label: "Capture", anchor: "step-8-capture" },
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
  return DIGITAL_AUDIT_STEPS;
}

export type StepValidationInput = {
  auditName: string;
  startChoice: StartChoice;
  startReady: boolean;
  method: CaptureMethod;
  aiPlanogramChoice: NewAuditPlanogramChoice | null;
  demoScanContext: ScanContextState;
  /** Stores (or hierarchy nodes) the audit goes to — one audit is created per store. */
  locationCount: number;
  assignToSelf: boolean;
  teamScope: TeamScope;
  assigneeId: string;
  assignmentMode: AssignmentMode;
  publishAt: string;
  evidenceLevel: EvidenceLevel;
  evidencePolicy: AuditEvidencePolicy;
  reviewerId: string;
  /** Evidence setup problem shown under Step 3 (e.g. a required column not chosen). */
  evidenceError?: string | null;
  hasBlockingConflicts: boolean;
  captureReady?: boolean;
  /** AI audits: at least one check ticked or a question asked. */
  aiAnalysisReady?: boolean;
  /** Editing an audit that keeps its saved setup — nothing to pick in Step 3. */
  keepSetup?: boolean;
};

export type StepValidationResult = Record<NewAuditStepId, boolean>;

export function validateNewAuditSteps(input: StepValidationInput): StepValidationResult {
  const step1 = input.auditName.trim().length > 0;
  const step2 = input.method === "digital" || input.method === "ai";
  const evidenceReady =
    Boolean(input.evidenceLevel) &&
    (input.evidencePolicy.reviewMode !== "independent" || Boolean(input.reviewerId)) &&
    !input.evidenceError;
  const step3 = input.keepSetup
    ? input.method === "ai" || evidenceReady
    : input.method === "digital"
      ? input.startReady && evidenceReady
      : input.method === "ai"
        ? isAiStep3Ready(input.aiPlanogramChoice, input.demoScanContext) && input.aiAnalysisReady !== false
        : false;
  const step4 = input.locationCount > 0;
  const step5 =
    input.assignToSelf ||
    input.teamScope.assigneeIds.length > 0 ||
    Boolean(input.assigneeId);

  const step6 =
    (input.assignmentMode !== "schedule_once" || Boolean(input.publishAt)) &&
    !input.hasBlockingConflicts;

  const step7 = step1 && step2 && step3 && step4 && step5 && step6;
  const needsImmediateCapture =
    input.method === "ai" && input.assignToSelf && input.assignmentMode === "assign_now";
  const step8 = step7 && needsImmediateCapture && Boolean(input.captureReady);

  return {
    1: step1,
    2: step2,
    3: step3,
    4: step4,
    5: step5,
    6: step6,
    7: step7,
    8: step8,
  };
}

/**
 * Ticks shown in the step bar and section headers. Steps that pass only because of a default
 * (method = digital, schedule = assign now) stay unticked until the user touches them or has
 * completed the steps around them. Submit readiness still uses the raw validation result.
 */
export function displayStepStatus(
  status: StepValidationResult,
  touched: { method: boolean; schedule: boolean },
): StepValidationResult {
  return {
    ...status,
    2: status[2] && (touched.method || status[3]),
    6: status[6] && (touched.schedule || (status[3] && status[4] && status[5])),
  };
}

export function scrollToNewAuditStep(anchor: string) {
  document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
