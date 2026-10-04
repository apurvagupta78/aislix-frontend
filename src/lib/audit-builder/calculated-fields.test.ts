import { describe, expect, it } from "vitest";

import { computeCalculatedValues } from "@/lib/audit-builder/calculated-fields";
import type { TemplateDefinition } from "@/lib/audit-builder/types";

const definition = {
  sections: [{ key: "expiry", title: "Expiry Check", repeatable: true, order: 0 }],
  fields: [
    { key: "expiry_date", section: "expiry", type: "expiry_date", label: "Expiry Date", required: true, config: {} },
    {
      key: "expiry_days_remaining",
      section: "expiry",
      type: "expiry_days_remaining",
      label: "Days Remaining",
      required: false,
      config: {},
      calculated: true,
    },
  ],
  rules: [],
  workflow: { submission: "manager_approval" },
  scoring: {},
  ai: { features: {} },
  evidence: {},
  calculatedFields: [],
} as unknown as TemplateDefinition;

describe("computeCalculatedValues", () => {
  it("computes Days Remaining for template fields without an explicit formula", () => {
    const out = computeCalculatedValues(definition, { expiry_date: "2026-10-08", audit_date: "2026-10-04" });
    expect(out.expiry_days_remaining).toBe(4);
  });

  it("is negative once the product has expired", () => {
    const out = computeCalculatedValues(definition, { expiry_date: "2026-09-28", audit_date: "2026-10-04" });
    expect(out.expiry_days_remaining).toBe(-6);
  });
});
