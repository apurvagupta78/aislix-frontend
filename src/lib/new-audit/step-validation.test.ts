import { describe, expect, it } from "vitest";

import { displayStepStatus, type StepValidationResult } from "@/lib/new-audit/step-validation";

const status = (patch: Partial<StepValidationResult>): StepValidationResult => ({
  1: false,
  2: true,
  3: false,
  4: false,
  5: true,
  6: false,
  7: false,
  8: false,
  ...patch,
});

describe("step bar ticks", () => {
  it("does not tick Perform or When on a fresh form just because of their defaults", () => {
    const shown = displayStepStatus(status({}), { method: false, schedule: false });
    expect(shown[2]).toBe(false);
    expect(shown[5]).toBe(false);
  });

  it("ticks them once the user picks a method or touches the schedule", () => {
    const shown = displayStepStatus(status({}), { method: true, schedule: true });
    expect(shown[2]).toBe(true);
    expect(shown[5]).toBe(true);
  });

  it("ticks them once the steps after or around them are complete", () => {
    const shown = displayStepStatus(status({ 3: true, 4: true }), { method: false, schedule: false });
    expect(shown[2]).toBe(true);
    expect(shown[5]).toBe(true);
  });

  it("never ticks a step that is not valid", () => {
    const shown = displayStepStatus(status({ 2: false, 5: false, 3: true, 4: true }), { method: true, schedule: true });
    expect(shown[2]).toBe(false);
    expect(shown[5]).toBe(false);
  });
});
