import { describe, expect, it } from "vitest";

import { emptyReferenceMeta, emptyReferenceRow } from "@/lib/ai-audit/reference-document";
import { referenceStateToDataset } from "./document-dataset";

describe("referenceStateToDataset", () => {
  it("keeps used standard columns plus every extra printed column", () => {
    const row = {
      ...emptyReferenceRow(1),
      product: "Lathe Machine",
      qty: 2,
      price: 150000,
      extra: { HSN: "8458", Amount: "300000" },
    };
    const empty = { ...emptyReferenceRow(2), product: "Drill" };
    const dataset = referenceStateToDataset({
      meta: { ...emptyReferenceMeta("document", "invoice.jpg"), extra_columns: ["HSN", "Amount"] },
      rows: [row, empty],
    });

    expect(dataset.columns.map((c) => c.name)).toEqual(["Product", "Qty", "Price", "HSN", "Amount"]);
    expect(dataset.columns.find((c) => c.name === "Qty")?.type).toBe("number");
    expect(dataset.filename).toBe("invoice.jpg");
    expect(dataset.rows).toHaveLength(2);
    const [qty, hsn] = [dataset.columns[1]!.id, dataset.columns[3]!.id];
    expect(dataset.rows[0]!.values[qty]).toBe("2");
    expect(dataset.rows[0]!.values[hsn]).toBe("8458");
    expect(dataset.rows[1]!.values[qty]).toBe("");
  });

  it("drops an extra column that duplicates a standard column name", () => {
    const dataset = referenceStateToDataset({
      meta: { ...emptyReferenceMeta("document", null), extra_columns: ["product", "Promo"] },
      rows: [{ ...emptyReferenceRow(1), product: "Soap", extra: { Promo: "1+1" } }],
    });
    expect(dataset.columns.map((c) => c.name)).toEqual(["Product", "Promo"]);
  });
});
