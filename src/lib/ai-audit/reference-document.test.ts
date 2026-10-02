import { describe, expect, it } from "vitest";

import {
  parseLunaDocument,
  referenceItemsForScan,
  referenceRowsFromTable,
  referenceRowsToPlanogramRows,
  shelfQuantity,
} from "@/lib/ai-audit/reference-document";
import { normalizeReferenceMatch } from "@/lib/ai-audit/reference-match";

const INVOICE = {
  document_type: "invoice",
  document_meta: { supplier_name: "Sharma Wholesale", document_number: "INV-2231", document_date: "2026-09-28" },
  line_items: [
    {
      line_no: 1,
      raw_text: "CATCH PINK ROCK SALT 1KG 2CS",
      brand: "Catch",
      product: "Pink Rock Salt",
      pack_size: "1 kg",
      quantity: 2,
      quantity_unit: "cs",
      units_per_case: 6,
      free_quantity: null,
      unit_price: 70,
      mrp: 85,
      location: "AMB-D0703",
      confidence: 0.95,
      unreadable_fields: [],
    },
    {
      line_no: 2,
      raw_text: "KISSAN JAM 500G 6 PCS",
      brand: null,
      product: "Kissan Mixed Fruit Jam",
      quantity: 6,
      quantity_unit: "pcs",
      unit_price: 140,
      mrp: null,
      confidence: 0.6,
      unreadable_fields: ["mrp"],
    },
    { line_no: 3, raw_text: "CGST 9%", brand: null, product: null, confidence: 0.9 },
  ],
  totals: { printed_line_count: 2 },
  reading_quality: "GOOD",
  warnings: [],
};

describe("parseLunaDocument", () => {
  it("converts cases to units, keeps MRP as price and skips tax lines", () => {
    const { rows, meta } = parseLunaDocument(INVOICE, "inv.jpg");
    expect(meta.supplier_name).toBe("Sharma Wholesale");
    expect(meta.document_type).toBe("invoice");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ brand: "Catch", qty: 12, unit: "units", price: 85, location: "AMB-D0703" });
    expect(rows[0]!.check_fields).toEqual([]);
  });

  it("fills price from the invoice rate when no MRP is printed and flags it to confirm", () => {
    const { rows } = parseLunaDocument(INVOICE, "inv.jpg");
    expect(rows[1]!.price).toBe(140);
    expect(rows[1]!.check_fields).toEqual(expect.arrayContaining(["price", "brand", "qty"]));
  });

  it("reads comma-formatted rates", () => {
    const { rows } = parseLunaDocument(
      { document_type: "invoice", line_items: [{ product: "Lathe Machine", quantity: 2, unit_price: "1,50,000.00" }] },
      null,
    );
    expect(rows[0]!.price).toBe(150000);
    expect(rows[0]!.check_fields).toContain("price");
  });

  it("flags lines where rate × quantity disagrees with the printed amount", () => {
    const { rows, meta } = parseLunaDocument(
      {
        document_type: "price_list",
        line_items: [
          { brand: "Acme", product: "Lathe", quantity: 2, unit_price: 100000, line_total: 300000, confidence: 0.9 },
          { brand: "Acme", product: "Mixer", quantity: 2, unit_price: 150000, line_total: 300000, confidence: 0.9 },
        ],
      },
      null,
    );
    expect(rows[0]!.check_fields).toEqual(expect.arrayContaining(["price", "qty"]));
    expect(rows[1]!.check_fields).toEqual([]);
    expect(meta.warnings).toHaveLength(1);
    expect(meta.warnings[0]).toMatch(/^Line 1:/);
  });

  it("uses the listed price on price lists", () => {
    const { rows } = parseLunaDocument(
      { document_type: "price_list", line_items: [{ product: "Tea 250g", unit_price: 120, confidence: 0.9 }] },
      null,
    );
    expect(rows[0]!.price).toBe(120);
  });
});

describe("shelfQuantity", () => {
  it("keeps the printed unit when there is no case size", () => {
    expect(shelfQuantity({ quantity: 3, quantity_unit: "cs" })).toEqual({ qty: 3, unit: "cs" });
    expect(shelfQuantity({ quantity: 4, quantity_unit: "pcs", free_quantity: 1 })).toEqual({ qty: 5, unit: "pcs" });
  });
});

describe("CSV rows", () => {
  it("maps common headers and rejects files with no product column", () => {
    const ok = referenceRowsFromTable(
      ["Item Name", "Brand", "Qty", "MRP", "Bin"],
      [{ "Item Name": "Basmati Rice", Brand: "India Gate", Qty: "20", MRP: "145", Bin: "AMB-D0703" }],
    );
    expect(ok.missingColumns).toEqual([]);
    expect(ok.rows[0]).toMatchObject({ product: "Basmati Rice", brand: "India Gate", qty: 20, price: 145, location: "AMB-D0703" });
    expect(referenceRowsFromTable(["Qty"], [{ Qty: "2" }]).missingColumns).toEqual(["product"]);
  });
});

describe("scan payload", () => {
  it("builds presence-only planogram rows and full reference items", () => {
    const { rows } = parseLunaDocument(INVOICE, "inv.jpg");
    const scope = { category: "Grocery", subCategory: "Salt" };
    const plan = referenceRowsToPlanogramRows(rows, scope);
    expect(plan[0]).toMatchObject({
      expected_facings: 1,
      location: "AMB-D0703",
      mrp_inr: 85,
      product_name: "Pink Rock Salt",
      variant: "1 kg",
    });
    expect(plan[1]!.location).toBe("—");
    const items = referenceItemsForScan(rows, scope);
    expect(items[0]).toMatchObject({ invoice_qty: 12, expected_price: 85, expected_location: "AMB-D0703" });
  });
});

describe("normalizeReferenceMatch", () => {
  it("returns undefined unless available and keeps N/A percentages as null", () => {
    expect(normalizeReferenceMatch({ available: false })).toBeUndefined();
    const out = normalizeReferenceMatch({
      available: true,
      verdict: "PARTIAL",
      metrics: { lines_total: 2, lines_found: 1, price_match_percent: null },
      lines: [{ line_no: 1, presence_status: "found", qty_status: "covered" }],
    });
    expect(out?.verdict).toBe("PARTIAL");
    expect(out?.metrics.price_match_percent).toBeNull();
    expect(out?.lines[0]).toMatchObject({ presence_status: "FOUND", qty_status: "COVERED" });
  });
});
