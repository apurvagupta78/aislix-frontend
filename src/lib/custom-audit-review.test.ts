import { describe, expect, it } from "vitest";

import type { TemplateDefinition } from "@/lib/audit-builder/types";
import type { ResponseMap } from "@/lib/custom-audit";
import {
  buildDigitalAuditLineDraftsFromResponses,
  buildDigitalAuditLineRow,
} from "@/lib/custom-audit-review";
import { computeLineVariance } from "@/lib/digital-audit";

const INVENTORY_DEFINITION = {
  sections: [{ key: "records", title: "Inventory Line", repeatable: true, order: 0 }],
  fields: [
    { key: "store", section: "records", type: "store", label: "Store", required: true, config: {} },
    { key: "sku", section: "records", type: "sku_id", label: "SKU", required: true, config: {} },
    { key: "expected_qty", section: "records", type: "expected_qty", label: "Expected Qty", required: true, config: {} },
    { key: "actual_qty", section: "records", type: "actual_qty", label: "Actual Qty", required: true, config: {} },
    { key: "rca", section: "records", type: "rca", label: "RCA", required: false, config: {} },
  ],
  rules: [],
  workflow: { submission: "manager_approval" },
  scoring: {},
  ai: { features: {} },
  evidence: {},
  calculatedFields: [],
} as TemplateDefinition;

describe("custom audit review materialization", () => {
  it("maps Expected 10 / Actual 8 to variance -2 for Review & Approval", () => {
    const responses: ResponseMap = {
      records: {
        0: {
          store: "Aislix",
          sku: "QA-LIFECYCLE-01",
          expected_qty: 10,
          actual_qty: 8,
          rca: "Missing",
        },
      },
    };

    const drafts = buildDigitalAuditLineDraftsFromResponses(INVENTORY_DEFINITION, responses);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      sku: "QA-LIFECYCLE-01",
      expected_qty: 10,
      actual_qty: 8,
      rca_code: "missing",
      location: "Aislix",
    });

    const row = buildDigitalAuditLineRow(drafts[0]!, {
      scanId: "scan-1",
      assignmentId: "asn-1",
      orgId: "org-1",
      storeId: "store-1",
      userId: "user-1",
    });

    expect(row.expected_qty).toBe(10);
    expect(row.actual_qty).toBe(8);
    expect(row.variance_qty).toBe(-2);
    expect(computeLineVariance(10, 8, null).variance_qty).toBe(-2);
  });

  it("maps Expected/Actual when CSV template uses type number + standardConcept", () => {
    const csvStyleDefinition = {
      ...INVENTORY_DEFINITION,
      fields: [
        {
          key: "sku_id",
          section: "records",
          type: "short_text",
          label: "SKU",
          required: true,
          config: {},
          standardConcept: "sku_id",
        },
        {
          key: "expected_qty",
          section: "records",
          type: "number",
          label: "Expected Qty",
          required: true,
          config: {},
          standardConcept: "expected_quantity",
        },
        {
          key: "actual_qty",
          section: "records",
          type: "number",
          label: "Actual Qty",
          required: true,
          config: {},
          standardConcept: "actual_quantity",
        },
      ],
    } as TemplateDefinition;

    const drafts = buildDigitalAuditLineDraftsFromResponses(csvStyleDefinition, {
      records: { 0: { sku_id: "SKU-1", expected_qty: 12, actual_qty: 9 } },
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ sku: "SKU-1", expected_qty: 12, actual_qty: 9 });
  });
});
