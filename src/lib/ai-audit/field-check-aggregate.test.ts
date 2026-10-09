import { describe, expect, it } from "vitest";
import type { FieldVerification } from "@/lib/ai-audit/field-verifications";
import {
  aggregateAiAccuracy,
  aggregateFieldMatchRates,
  openFindingsByField,
} from "@/lib/ai-audit/field-check-aggregate";

function ver(over: Partial<FieldVerification>): FieldVerification {
  return {
    id: "v",
    scan_id: "s1",
    row_key: "dp:1",
    detected_product_id: "1",
    field_key: "facings",
    ai_value: null,
    verified_value: null,
    ai_text: null,
    verified_text: null,
    verified_by: null,
    verified_at: null,
    ...over,
  };
}

describe("aggregateAiAccuracy", () => {
  it("counts verified fields where the AI read the same value", () => {
    const rows = aggregateAiAccuracy([
      ver({ field_key: "facings", ai_value: 6, verified_value: 6 }),
      ver({ field_key: "facings", ai_value: 5, verified_value: 6 }),
      ver({ field_key: "location", ai_text: "AMB-D0303", verified_text: "amb d0303" }),
      ver({ field_key: "price", ai_value: 20, verified_value: null }),
    ]);
    expect(rows).toEqual([
      { field: "facings", label: "Facings", agreed: 1, verified: 2 },
      { field: "location", label: "Location", agreed: 1, verified: 1 },
    ]);
  });
});

describe("openFindingsByField", () => {
  it("groups open findings by the field they are about", () => {
    expect(
      openFindingsByField([
        { finding_type: "pricing_issue" },
        { finding_type: "missing_product" },
        { finding_type: "out_of_stock" },
        { finding_type: "damaged_product" },
      ]),
    ).toEqual([
      { label: "Product found", value: 2 },
      { label: "Price", value: 1 },
      { label: "Other shelf issues", value: 1 },
    ]);
  });
});

describe("aggregateFieldMatchRates", () => {
  it("ignores scans without a planogram", () => {
    const rates = aggregateFieldMatchRates([null, { analysis_mode: "shelf_only" }]);
    expect(rates.every((r) => r.checked === 0)).toBe(true);
  });
});
