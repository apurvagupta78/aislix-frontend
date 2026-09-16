import { describe, expect, it } from "vitest";

import type { TemplateField } from "./types";
import {
  ensureFieldRole,
  isNonExecutableFieldRole,
  resolveFieldRole,
  summarizeRequiredInputs,
} from "./ensure-field-roles";

describe("ensure field roles", () => {
  it("infers reference from readOnly config", () => {
    const field: TemplateField = {
      id: "1",
      key: "sku_id",
      type: "sku_id",
      label: "SKU",
      section: "qc",
      order: 0,
      required: true,
      config: { readOnly: true },
    };
    const next = ensureFieldRole(field);
    expect(resolveFieldRole(next)).toBe("reference");
    expect(next.config.readOnly).toBe(true);
  });

  it("excludes reference fields from required input summary", () => {
    const definition = {
      sections: [{ key: "qc", title: "QC", order: 0, repeatable: true }],
      fields: [
        ensureFieldRole({
          id: "1",
          key: "sku_id",
          type: "sku_id",
          label: "SKU ID",
          section: "qc",
          order: 0,
          required: true,
          fieldRole: "reference",
          config: { readOnly: true },
        }),
        ensureFieldRole({
          id: "2",
          key: "actual_qty",
          type: "number",
          label: "Actual Qty",
          section: "qc",
          order: 1,
          required: true,
          fieldRole: "auditor_input",
          config: {},
        }),
      ],
      rules: [],
      workflow: { submission: "manager_approval" as const },
      scoring: { enabled: false },
      ai: { enabled: false, features: {} },
      evidence: { photoRequired: true },
      calculatedFields: [],
      auditLevel: "one_per_sku" as const,
    };

    const summary = summarizeRequiredInputs(definition);
    expect(summary.executableFieldCount).toBe(1);
    expect(summary.fieldLabels).toEqual(["Actual Qty"]);
    expect(isNonExecutableFieldRole("reference")).toBe(true);
  });
});
