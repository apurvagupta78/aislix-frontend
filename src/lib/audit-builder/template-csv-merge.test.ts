import { describe, expect, it } from "vitest";

import { createManualAuditDataset } from "@/lib/audit-input-dataset";
import { buildInputSchema } from "@/lib/audit-builder/input-schema";
import type { ColumnMapping } from "@/lib/audit-builder/field-roles";
import { buildFnvQcAudit } from "@/lib/audit-engine/template-factory/builders";
import { definitionToPatch } from "@/lib/audit-templates";
import {
  applyReferenceRolesFromCsv,
  buildMergedTemplateSnapshot,
  buildTemplateFieldBindings,
  filterDatasetForStore,
} from "./template-csv-merge";

describe("template + CSV merge", () => {
  it("binds CSV columns to template field keys", () => {
    const def = buildFnvQcAudit("local_store");
    const dataset = createManualAuditDataset();
    dataset.columns = [
      { id: "c1", name: "SKU ID", type: "text" },
      { id: "c2", name: "Product", type: "text" },
    ];
    const mappings: ColumnMapping[] = [
      {
        columnId: "c1",
        columnName: "SKU ID",
        dataType: "text",
        fieldRole: "reference",
        aislixMapping: "sku_id",
        auditorFills: false,
        required: true,
        evidenceRequired: false,
      },
      {
        columnId: "c2",
        columnName: "Product",
        dataType: "text",
        fieldRole: "reference",
        aislixMapping: "product_name",
        auditorFills: false,
        required: true,
        evidenceRequired: false,
      },
    ];
    const inputSchema = buildInputSchema(dataset, "sku", mappings);
    const bindings = buildTemplateFieldBindings(def, inputSchema);
    expect(bindings.some((b) => b.templateFieldKey === "sku")).toBe(true);
    expect(bindings.some((b) => b.templateFieldKey === "product")).toBe(true);
  });

  it("marks template sku field read-only when CSV supplies reference", () => {
    const def = buildFnvQcAudit("local_store");
    const patch = definitionToPatch(def);
    const template = {
      id: "tpl-1",
      name: "FNV QC",
      version: 1,
      ...patch,
      field_definitions: patch.field_definitions ?? [],
      sections: patch.sections ?? [],
      rules: patch.rules ?? [],
      workflow_settings: patch.workflow_settings ?? {},
      scoring_config: patch.scoring_config ?? {},
      ai_config: patch.ai_config ?? {},
      evidence_config: patch.evidence_config ?? {},
      calculated_fields: patch.calculated_fields ?? [],
      purpose_config: {},
      template_type: "fnv_qc_audit",
      status: "published",
      is_system_template: true,
      operating_model: "local_store",
      audit_purpose: "fnv_qc",
      subject_type: "sku",
      audit_level: "one_per_sku",
      hierarchy_profile_id: null,
      short_description: null,
      created_by: null,
      updated_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const dataset = createManualAuditDataset();
    dataset.rows = [
      {
        id: "r1",
        values: { c1: "10001", c2: "MAGGI" },
      },
    ];
    dataset.columns = [
      { id: "c1", name: "SKU ID", type: "text" },
      { id: "c2", name: "Product", type: "text" },
    ];

    const inputSchema = buildInputSchema(dataset, "sku", [
      {
        columnId: "c1",
        columnName: "SKU ID",
        dataType: "text",
        fieldRole: "reference",
        aislixMapping: "sku_id",
        auditorFills: false,
        required: true,
        evidenceRequired: false,
      },
    ]);

    const merged = applyReferenceRolesFromCsv(template, inputSchema);
    const skuField = merged.field_definitions.find((f) => f.key === "sku");
    expect(skuField?.fieldRole).toBe("reference");
    expect(skuField?.config.readOnly).toBe(true);

    const snapshot = buildMergedTemplateSnapshot({
      template,
      inputSchema,
      dataset,
      dataInputMode: "template_plus_csv",
    });
    expect(snapshot.purpose_config).toBeTruthy();
  });

  it("filters multi-store CSV rows per store assignment", () => {
    const dataset = createManualAuditDataset();
    dataset.columns = [
      { id: "store", name: "Store", type: "text" },
      { id: "sku", name: "SKU", type: "text" },
    ];
    dataset.rows = [
      { id: "r1", values: { store: "Store A", sku: "1" } },
      { id: "r2", values: { store: "Store B", sku: "2" } },
    ];
    const inputSchema = buildInputSchema(dataset, "store", [
      {
        columnId: "store",
        columnName: "Store",
        dataType: "text",
        fieldRole: "reference",
        aislixMapping: "custom",
        auditorFills: false,
        required: true,
        evidenceRequired: false,
      },
      {
        columnId: "sku",
        columnName: "SKU",
        dataType: "text",
        fieldRole: "reference",
        aislixMapping: "sku_id",
        auditorFills: false,
        required: true,
        evidenceRequired: false,
      },
    ]);

    const filtered = filterDatasetForStore(dataset, inputSchema, "store-a-id", "Store A");
    expect(filtered.rows).toHaveLength(1);
    expect(filtered.rows[0]?.values.sku).toBe("1");
  });
});
