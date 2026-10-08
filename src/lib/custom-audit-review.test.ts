import { describe, expect, it } from "vitest";

import type { TemplateDefinition } from "@/lib/audit-builder/types";
import type { ResponseMap } from "@/lib/custom-audit";
import {
  buildDigitalAuditLineDraftsFromResponses,
  buildDigitalAuditLineRow,
  collectCustomAuditEvidenceDrafts,
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

  it("values the variance from a Unit Price column when there is no MRP", () => {
    const text = (key: string, label: string) =>
      ({ key, section: "records", type: "short_text", label, required: false, config: {} }) as const;
    const digitalCsv = {
      ...INVENTORY_DEFINITION,
      fields: [
        text("item_name", "Product"),
        text("expected_qty", "Expected Qty"),
        text("unit_price", "Unit Price"),
        text("actual_qty", "Actual Qty"),
        text("mrp", "MRP"),
      ],
    } as TemplateDefinition;
    const ctx = { scanId: "s", assignmentId: "a", orgId: "o", storeId: "st", userId: "u" };
    const [priced, both] = buildDigitalAuditLineDraftsFromResponses(digitalCsv, {
      records: {
        0: { item_name: "Oreo Vanilla 120g", expected_qty: "10", unit_price: "₹1,030.50", actual_qty: "7" },
        1: { item_name: "Good Day 200g", expected_qty: "18", unit_price: "40", mrp: "50", actual_qty: "15" },
      },
    });
    const pricedRow = buildDigitalAuditLineRow(priced!, ctx);
    expect(pricedRow.variance_value_inr).toBe(-3091.5);
    expect(pricedRow.mrp_inr).toBeNull();
    expect(buildDigitalAuditLineRow(both!, ctx).variance_value_inr).toBe(-150);
  });

  it("leaves variance empty when the line has no expected value (expiry checks)", () => {
    const expiryDefinition = {
      ...INVENTORY_DEFINITION,
      fields: INVENTORY_DEFINITION.fields.filter((f) => f.key !== "expected_qty"),
    } as TemplateDefinition;
    const [draft] = buildDigitalAuditLineDraftsFromResponses(expiryDefinition, {
      records: { 0: { store: "Main Store", sku: "MILK-500", actual_qty: 6 } },
    });
    const row = buildDigitalAuditLineRow(draft!, {
      scanId: "scan-1",
      assignmentId: "asn-1",
      orgId: "org-1",
      storeId: "store-1",
      userId: "user-1",
    });
    expect(row.actual_qty).toBe(6);
    expect(row.variance_qty).toBeNull();
  });

  it("gives every evidence photo its own bin key when rows share a store", () => {
    const withImages = {
      ...INVENTORY_DEFINITION,
      fields: [
        ...INVENTORY_DEFINITION.fields,
        { key: "images", section: "records", type: "multiple_images", label: "Images", required: true, config: {} },
      ],
    } as TemplateDefinition;
    const entries = collectCustomAuditEvidenceDrafts(withImages, {
      records: {
        0: { store: "Main Store", sku: "A", images: ["a.jpg"] },
        1: { store: "Main Store", sku: "B", images: ["b1.jpg", "b2.jpg"] },
        2: { store: "Main Store", sku: "C", images: ["c.jpg"] },
      },
    });
    expect(entries).toHaveLength(4);
    expect(new Set(entries.map((e) => e.bin_key)).size).toBe(4);
  });
});
