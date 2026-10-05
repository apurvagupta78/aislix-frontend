import { describe, expect, it } from "vitest";

import { policyForLevel } from "@/lib/audit-evidence-policy";
import { EMPTY_SCAN_CONTEXT } from "@/lib/scan-context";
import {
  displayStepStatus,
  getNewAuditNavSteps,
  validateNewAuditSteps,
  type StepValidationInput,
  type StepValidationResult,
} from "@/lib/new-audit/step-validation";

const status = (patch: Partial<StepValidationResult>): StepValidationResult => ({
  1: false,
  2: true,
  3: false,
  4: false,
  5: false,
  6: true,
  7: false,
  8: false,
  ...patch,
});

describe("step bar ticks", () => {
  it("does not tick Perform or When on a fresh form just because of their defaults", () => {
    const shown = displayStepStatus(status({}), { method: false, schedule: false });
    expect(shown[2]).toBe(false);
    expect(shown[6]).toBe(false);
  });

  it("ticks them once the user picks a method or touches the schedule", () => {
    const shown = displayStepStatus(status({}), { method: true, schedule: true });
    expect(shown[2]).toBe(true);
    expect(shown[6]).toBe(true);
  });

  it("ticks them once the steps after or around them are complete", () => {
    const shown = displayStepStatus(status({ 3: true, 4: true, 5: true }), {
      method: false,
      schedule: false,
    });
    expect(shown[2]).toBe(true);
    expect(shown[6]).toBe(true);
  });

  it("never ticks a step that is not valid", () => {
    const shown = displayStepStatus(status({ 2: false, 6: false, 3: true, 4: true, 5: true }), {
      method: true,
      schedule: true,
    });
    expect(shown[2]).toBe(false);
    expect(shown[6]).toBe(false);
  });
});

describe("Where step", () => {
  const input = (patch: Partial<StepValidationInput>): StepValidationInput => ({
    auditName: "Weekly shelf check",
    startChoice: "custom",
    startReady: true,
    method: "digital",
    aiPlanogramChoice: null,
    demoScanContext: EMPTY_SCAN_CONTEXT,
    locationCount: 1,
    assignToSelf: true,
    teamScope: { assigneeIds: [] },
    assigneeId: "",
    assignmentMode: "assign_now",
    publishAt: "",
    evidenceLevel: "standard",
    evidencePolicy: policyForLevel("standard"),
    reviewerId: "",
    hasBlockingConflicts: false,
    ...patch,
  });

  it("is shown for both Digital and AI audits", () => {
    expect(getNewAuditNavSteps("digital", false).map((s) => s.label)).toContain("Where");
    expect(getNewAuditNavSteps("ai", false).map((s) => s.label)).toContain("Where");
    expect(getNewAuditNavSteps("ai", true).map((s) => s.label)).toEqual([
      "Details",
      "Perform",
      "Start",
      "Where",
      "Who",
      "When",
      "Preview",
      "Capture",
    ]);
  });

  it("blocks Preview until at least one store is chosen", () => {
    const none = validateNewAuditSteps(input({ locationCount: 0 }));
    expect(none[4]).toBe(false);
    expect(none[7]).toBe(false);

    const several = validateNewAuditSteps(input({ locationCount: 3 }));
    expect(several[4]).toBe(true);
    expect(several[7]).toBe(true);
  });
});
