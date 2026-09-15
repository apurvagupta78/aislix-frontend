import { describe, expect, it } from "vitest";

import { datasetToDraftRows, parseAuditCsv, validateAuditDataset } from "@/lib/audit-input-dataset";

describe("audit input dataset", () => {
  it("preserves every CSV heading and quoted value", () => {
    const dataset = parseAuditCsv(
      'Product,SKU,Expected Qty,Active,Notes\n"Tea, Premium",TEA-1,12,true,"Top shelf"\n',
      "audit.csv",
    );

    expect(dataset.columns.map((column) => column.name)).toEqual([
      "Product",
      "SKU",
      "Expected Qty",
      "Active",
      "Notes",
    ]);
    expect(dataset.rows[0]?.values[dataset.columns[0]!.id]).toBe("Tea, Premium");
    expect(dataset.columns[2]?.type).toBe("integer");
    expect(dataset.columns[3]?.type).toBe("boolean");
  });

  it("maps recognized fields while retaining arbitrary source data", () => {
    const dataset = parseAuditCsv(
      "Product,SKU,Expected Qty,Manager Note\nBread,BR-1,8,Check display\n",
      "audit.csv",
    );
    const rows = datasetToDraftRows(dataset, { location: "Main shelf", category: "Bakery" });

    expect(rows[0]).toMatchObject({
      product_name: "Bread",
      sku: "BR-1",
      expected_qty: 8,
      location: "Main shelf",
      category: "Bakery",
    });
    expect(validateAuditDataset(dataset)).toBeNull();
  });
});
