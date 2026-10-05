import { describe, expect, it } from "vitest";

import {
  referenceDocumentScope,
  referenceItemsForScan,
  referenceRowsFromTable,
  referenceRowsToPlanogramRows,
} from "@/lib/ai-audit/reference-document";

const HEADERS = [
  "location",
  "category",
  "sub_category",
  "brand",
  "product_name",
  "variant",
  "expected_facings",
  "min_facings",
  "max_facings",
  "expected_shelf_units",
  "price",
  "avg_daily_sales",
  "product id",
  "shelf_position",
];

const RECORDS = [
  ["A-1-Z", "packaged food & snacks", "chips", "lays", "potato chips", "Magic Masala", "19", "12", "19", "19", "20", "10", "lays-mm", "1"],
  ["A-1-Z", "packaged food & snacks", "chips", "lays", "potato chips", "Cream & Onion", "12", "12", "12", "12", "20", "10", "lays-co", "3"],
].map((values) => Object.fromEntries(HEADERS.map((h, i) => [h, values[i] ?? ""])) as Record<string, string>);

describe("planogram CSV uploaded as an AI Audit document", () => {
  const { rows } = referenceRowsFromTable(HEADERS, RECORDS);

  it("reads shelf units as the line quantity", () => {
    expect(rows[0]).toMatchObject({ brand: "lays", product: "potato chips", qty: 19, price: 20, location: "A-1-Z" });
  });

  it("uses the document's facings, range, category and position as planogram targets", () => {
    const plan = referenceRowsToPlanogramRows(rows, { category: "Personal Care", subCategory: null });
    expect(plan[0]).toMatchObject({
      category: "packaged food & snacks",
      sub_category: "chips",
      expected_facings: 19,
      expected_qty: 19,
      min_facings: 12,
      max_facings: 19,
      expected_shelf_units: 19,
      avg_daily_sales: 10,
      sku: "lays-mm",
      shelf_position: "1",
    });
    expect(plan[1]).toMatchObject({ expected_facings: 12, min_facings: 12, max_facings: 12, shelf_position: "3" });
  });

  it("takes the audit category from the document", () => {
    expect(referenceDocumentScope(rows)).toEqual({ category: "packaged food & snacks", subCategory: "chips" });
    expect(referenceItemsForScan(rows, { category: "Personal Care" })[0]).toMatchObject({
      category: "packaged food & snacks",
      sub_category: "chips",
      invoice_qty: 19,
    });
  });

  it("keeps presence-only targets for documents without facings", () => {
    const invoice = referenceRowsFromTable(["Item", "Qty", "Rate"], [{ Item: "Kissan Jam 500g", Qty: "6", Rate: "120" }]);
    const plan = referenceRowsToPlanogramRows(invoice.rows, { category: "Grocery" });
    expect(plan[0]).toMatchObject({ category: "Grocery", expected_facings: 1, expected_qty: 1 });
    expect(plan[0]?.expected_shelf_units).toBeUndefined();
    expect(referenceDocumentScope(invoice.rows)).toEqual({ category: null, subCategory: null });
  });
});
