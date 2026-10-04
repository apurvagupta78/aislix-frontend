import { describe, expect, it } from "vitest";

import { buildMergedTemplateSnapshot } from "@/lib/audit-builder/template-csv-merge";
import { buildInventoryAudit, buildStoreVisit } from "@/lib/audit-engine/template-factory";
import type { AuditTemplate } from "@/lib/audit-templates";
import { buildDigitalInputSchema } from "@/lib/new-audit/digital-columns";
import {
  buildTemplateDataset,
  fillTemplateDataset,
  templateHasLines,
  templateLineFields,
} from "@/lib/new-audit/template-dataset";

describe("template lines table", () => {
  const inventory = buildInventoryAudit("local_store");

  it("uses the template's line fields as columns, skipping store, calculated and photo fields", () => {
    const labels = templateLineFields(inventory).map((f) => f.label);
    expect(labels).toContain("SKU");
    expect(labels).toContain("Expected Qty");
    expect(labels).toContain("Actual Qty");
    expect(labels).not.toContain("Store");
    expect(labels).not.toContain("Variance");
    expect(labels).not.toContain("Image");
  });

  it("marks identity and expected values as provided, counts as auditee-filled, and pairs actual with expected", () => {
    const { dataset, mappings } = buildTemplateDataset(inventory, "Local Store Inventory Audit");
    const role = (name: string) => mappings.find((m) => m.columnName === name)?.fieldRole;
    expect(dataset.rows).toHaveLength(0);
    expect(role("SKU")).toBe("reference");
    expect(role("Expected Qty")).toBe("reference");
    expect(role("Actual Qty")).toBe("auditor_input");
    const expectedId = dataset.columns.find((c) => c.name === "Expected Qty")!.id;
    expect(mappings.find((m) => m.columnName === "Actual Qty")?.compareWithColumnId).toBe(expectedId);
  });

  it("binds every column back to its template field when the audit is created", () => {
    const { dataset, mappings } = buildTemplateDataset(inventory, "Inventory");
    const withRow = {
      ...dataset,
      rows: [{ id: "r1", values: Object.fromEntries(dataset.columns.map((c) => [c.id, c.name === "SKU" ? "SKU-1" : ""])) }],
    };
    const template = {
      id: "t1",
      name: "Inventory",
      sections: inventory.sections,
      field_definitions: inventory.fields,
      rules: inventory.rules,
      workflow_settings: inventory.workflow,
      scoring_config: inventory.scoring,
      ai_config: inventory.ai,
      evidence_config: inventory.evidence,
      purpose_config: {},
    } as unknown as AuditTemplate;
    const snapshot = buildMergedTemplateSnapshot({
      template,
      inputSchema: buildDigitalInputSchema(withRow, mappings),
      dataset: withRow,
      dataInputMode: "template_plus_csv",
    });
    const schema = (snapshot.purpose_config as { inputSchema: { templateFieldBindings: unknown[] } }).inputSchema;
    expect(schema.templateFieldBindings).toHaveLength(dataset.columns.length);
  });

  it("treats one-off checklist templates as having no lines", () => {
    expect(templateHasLines(buildStoreVisit("local_store"))).toBe(false);
    expect(templateHasLines(inventory)).toBe(true);
  });

  it("fills template columns from a file by header name and reports unknown columns", () => {
    const { dataset } = buildTemplateDataset(inventory, "Inventory");
    const file = {
      source: "csv" as const,
      filename: "stock.csv",
      columns: [
        { id: "a", name: "sku", type: "text" as const },
        { id: "b", name: "Expected qty", type: "text" as const },
        { id: "c", name: "Supplier", type: "text" as const },
      ],
      rows: [
        { id: "1", values: { a: "SKU-1", b: "12", c: "Acme" } },
        { id: "2", values: { a: "", b: "", c: "" } },
      ],
    };
    const filled = fillTemplateDataset(dataset, file);
    expect(filled.matched).toEqual(["SKU", "Expected Qty"]);
    expect(filled.skipped).toEqual(["Supplier"]);
    expect(filled.dataset.rows).toHaveLength(1);
    const sku = dataset.columns.find((c) => c.name === "SKU")!.id;
    expect(filled.dataset.rows[0]!.values[sku]).toBe("SKU-1");
  });
});
