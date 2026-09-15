import { describe, expect, it } from "vitest";

import { buildDefaultColumnMappings } from "./input-schema";
import { inferColumnRole, isFieldReadOnlyForAuditor } from "./field-roles";
import type { TemplateField } from "./types";

describe("field roles", () => {
  it("infers reference columns from CSV headers", () => {
    expect(inferColumnRole("SKU ID").role).toBe("reference");
    expect(inferColumnRole("Expected Qty").role).toBe("reference");
  });

  it("infers auditor input columns", () => {
    expect(inferColumnRole("Actual Qty").role).toBe("auditor_input");
    expect(inferColumnRole("Remarks").role).toBe("auditor_input");
  });

  it("marks reference fields read-only for auditors", () => {
    const field: TemplateField = {
      id: "1",
      key: "sku",
      type: "short_text",
      label: "SKU",
      section: "s",
      order: 0,
      required: true,
      config: {},
      fieldRole: "reference",
    };
    expect(isFieldReadOnlyForAuditor(field)).toBe(true);
  });

  it("builds default column mappings preserving all columns", () => {
    const mappings = buildDefaultColumnMappings({
      source: "csv",
      filename: "test.csv",
      columns: [
        { id: "c1", name: "SKU", type: "text" },
        { id: "c2", name: "Actual Qty", type: "integer" },
      ],
      rows: [],
    });
    expect(mappings).toHaveLength(2);
    expect(mappings[0]?.fieldRole).toBe("reference");
    expect(mappings[1]?.auditorFills).toBe(true);
  });
});
