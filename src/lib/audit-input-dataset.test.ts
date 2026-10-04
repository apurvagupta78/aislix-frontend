import { describe, expect, it } from "vitest";

import {
  datasetToDraftRows,
  digitalProductListIssue,
  packDatasetForStorage,
  parseAuditCsv,
  readStoredDataset,
  validateAuditDataset,
} from "@/lib/audit-input-dataset";

describe("stored dataset", () => {
  it("round-trips rows through the packed form and keeps every cell", () => {
    const dataset = parseAuditCsv("SKU,Qty,Note\nA-1,12,\nB-2,,top shelf\n", "stock.csv");
    const stored = packDatasetForStorage(dataset);
    expect(stored.rows).toEqual([]);
    expect(stored.packed_rows).toEqual([
      ["A-1", "12", ""],
      ["B-2", "", "top shelf"],
    ]);
    const read = readStoredDataset(JSON.parse(JSON.stringify(stored)))!;
    expect(read.columns).toEqual(dataset.columns);
    expect(read.rows.map((r) => r.values)).toEqual(dataset.rows.map((r) => r.values));
  });

  it("still reads datasets saved before packing, and ignores anything that isn't a dataset", () => {
    const dataset = parseAuditCsv("SKU\nA-1\n", "stock.csv");
    expect(readStoredDataset(dataset)?.rows).toEqual(dataset.rows);
    expect(readStoredDataset(null)).toBeUndefined();
    expect(readStoredDataset({ rows: [] })).toBeUndefined();
  });

  it("stores a 10,000 × 52 file at a fraction of the keyed size", () => {
    const columns = Array.from({ length: 52 }, (_, i) => ({ id: crypto.randomUUID(), name: `Col ${i}`, type: "text" as const }));
    const rows = Array.from({ length: 10000 }, (_, r) => ({
      id: crypto.randomUUID(),
      values: Object.fromEntries(columns.map((c, i) => [c.id, `v${r}_${i}`])),
    }));
    const dataset = { source: "csv" as const, filename: "big.csv", columns, rows };
    const keyed = JSON.stringify(dataset).length;
    const packed = JSON.stringify(packDatasetForStorage(dataset)).length;
    expect(packed).toBeLessThan(keyed / 3);
  });
});

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
    expect(digitalProductListIssue(dataset)).toBeNull();
  });

  it("rejects report-style files with no product or SKU column", () => {
    const dataset = parseAuditCsv("Field,Value\nReport ID,R-1\nStatus,Done\n", "report.csv");
    expect(digitalProductListIssue(dataset)).toMatch(/no Product Name or SKU column/);
  });
});
