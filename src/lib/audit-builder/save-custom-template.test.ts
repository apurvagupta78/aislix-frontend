import { describe, expect, it } from "vitest";

import { createManualAuditDataset } from "@/lib/audit-input-dataset";
import { buildInputSchema } from "@/lib/audit-builder/input-schema";
import type { ColumnMapping } from "@/lib/audit-builder/field-roles";
import { buildTemplateFromInputSchema } from "@/lib/audit-builder/input-schema";

describe("save custom CSV template", () => {
  it("builds calculated variance fields when expected and actual columns mapped", () => {
    const dataset = createManualAuditDataset();
    dataset.columns = [
      { id: "c1", name: "Expected Qty", type: "integer" },
      { id: "c2", name: "Actual Qty", type: "integer" },
    ];
    const mappings: ColumnMapping[] = [
      {
        columnId: "c1",
        columnName: "Expected Qty",
        dataType: "integer",
        fieldRole: "reference",
        aislixMapping: "expected_quantity",
        auditorFills: false,
        required: true,
        evidenceRequired: false,
      },
      {
        columnId: "c2",
        columnName: "Actual Qty",
        dataType: "integer",
        fieldRole: "auditor_input",
        aislixMapping: "actual_quantity",
        auditorFills: true,
        required: true,
        evidenceRequired: false,
      },
    ];
    const inputSchema = buildInputSchema(dataset, "sku", mappings);
    const def = buildTemplateFromInputSchema(inputSchema, dataset, {
      name: "Test CSV Audit",
      operatingModel: "local_store",
    });
    expect(def.fields.some((f) => f.standardConcept === "expected_quantity")).toBe(true);
    expect(def.fields.some((f) => f.standardConcept === "actual_quantity")).toBe(true);
    expect(def.fields.find((f) => f.fieldRole === "reference")?.config.readOnly).toBe(true);
  });
});
