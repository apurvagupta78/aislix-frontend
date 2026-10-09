import { describe, expect, it } from "vitest";
import type { AstraPlanogramProduct, NormalizedAstraAnalysis } from "@/lib/ai-audit/astra-response";
import type { FieldVerification } from "@/lib/ai-audit/field-verifications";
import { verificationMap } from "@/lib/ai-audit/field-verifications";
import type { ReferenceMatch, ReferenceMatchLine } from "@/lib/ai-audit/reference-match";
import {
  aiAgrees,
  buildVerificationRows,
  compareToPlan,
  fieldResult,
  priceNumber,
  verificationCsv,
} from "@/lib/ai-audit/verification-rows";

function planned(over: Partial<AstraPlanogramProduct>): AstraPlanogramProduct {
  return {
    location: "A-1",
    category: "Snacks",
    subcategory: "Chips",
    brand: "Lay's",
    brand_status: "MATCHED",
    product_name: "potato chips",
    product_status: "MATCHED",
    variant: "Classic Salted",
    variant_status: "MATCHED",
    sku: "",
    sku_status: "",
    expected_facings: 6,
    actual_facings: 6,
    facing_variance: 0,
    facing_compliance_percent: 100,
    min_facings: 0,
    max_facings: 0,
    facing_range_status: "",
    expected_shelf_units: 0,
    actual_visible_units: 12,
    shelf_unit_variance: null,
    shelf_unit_compliance_percent: null,
    expected_shelf_position: "",
    actual_shelf_position: "",
    placement_status: "",
    expected_mrp_inr: 20,
    visible_price: "₹20",
    price_status: "MATCH",
    price_difference: 0,
    price_source: "SHELF_TAG",
    expected_location: "AMB-D0303",
    actual_location_label: "AMB-D0303",
    actual_location_label_status: "READ",
    actual_rack_marker: null,
    additional_location_labels: [],
    location_status: "CORRECT",
    avg_daily_sales: 0,
    estimated_visible_shelf_coverage_days: null,
    visible_unit_shortfall: null,
    potential_visible_unit_value_gap_inr: null,
    risk_status: "",
    overall_status: "",
    match_status: "MATCHED",
    confidence: 0.9,
    evidence_note: "",
    ...over,
  };
}

function planogramAnalysis(products: AstraPlanogramProduct[], reference?: ReferenceMatch): NormalizedAstraAnalysis {
  return {
    mode: "planogram",
    products,
    brand_analysis: [],
    category_analysis: [],
    subcategory_analysis: [],
    observed_unplanned_products: [
      { brand: "Bingo", product_name: "Mad Angles", variant: "", actual_facings: 3, actual_visible_units: 6, confidence: 0.9 },
    ],
    summary: {} as never,
    reference_match: reference,
  };
}

describe("buildVerificationRows", () => {
  it("pairs planogram expected values with AI values and links detected products", () => {
    const rows = buildVerificationRows(
      planogramAnalysis([
        planned({}),
        planned({ variant: "Magic Masala", match_status: "NOT_FOUND", actual_facings: null, location_status: "" }),
      ]),
      [{ id: "11111111-1111-1111-1111-111111111111", brand: "Lay's", product: "potato chips", variant: "Classic Salted", facings: 6 }],
    );
    expect(rows).toHaveLength(3);
    const [salted, masala, bingo] = rows;
    expect(salted!.rowKey).toBe("dp:11111111-1111-1111-1111-111111111111");
    expect(salted!.expected.facings).toBe(6);
    expect(salted!.ai.location).toBe("AMB-D0303");
    expect(salted!.ai.price).toBe(20);
    expect(masala!.planned).toBe(true);
    expect(masala!.ai.present).toBe(0);
    expect(masala!.rowKey).toBe("k:lays|potatochips|magicmasala");
    expect(bingo!.planned).toBe(false);
    expect(bingo!.expected.facings).toBeNull();
    expect(bingo!.label).toBe("Bingo · Mad Angles");
  });

  it("uses document lines (with promotions) when a reference document was matched", () => {
    const line = {
      line_no: 1,
      raw_text: null,
      brand: "Trident",
      product_name: "Spearmint",
      variant: null,
      pack_size: null,
      invoice_qty: 6,
      quantity_unit: null,
      expected_price: 90,
      expected_location: "Bottom shelf",
      document_confidence: null,
      presence_status: "FOUND",
      actual_brand: "Trident",
      actual_product_name: "Spearmint",
      actual_variant: null,
      shelf_facings: 4,
      shelf_units: 8,
      qty_status: "COVERED",
      shelf_location_label: null,
      additional_location_labels: [],
      location_status: "NOT_READABLE",
      visible_price: "90",
      price_status: "MATCH",
      price_difference: 0,
      expected_promo: "Buy 2 get 1",
      shelf_promotion: null,
      shelf_promo_price: null,
      promo_status: "PROMO_NOT_SEEN",
    } satisfies ReferenceMatchLine;
    const reference = { lines: [line], not_on_document: [] } as unknown as ReferenceMatch;
    const [row] = buildVerificationRows(planogramAnalysis([], reference));
    expect(row!.expected.promotion).toBe("Buy 2 get 1");
    expect(fieldResult(row!, "promotion", null)).toBe("mismatch");
    expect(fieldResult(row!, "promotion", "Buy 2 get 1 free")).toBe("match");
    expect(fieldResult(row!, "location", null)).toBe("not_visible");
    expect(fieldResult(row!, "location", "bottom-shelf")).toBe("match");
  });

  it("falls back to detected products when there is no AI analysis", () => {
    const rows = buildVerificationRows({ mode: "incomplete", reason: "x" }, [
      { id: "a", brand: "Dove", product: "Shampoo", facings: 2 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rowKey).toBe("dp:a");
    expect(rows[0]!.ai.facings).toBe(2);
  });
});

describe("results", () => {
  it("compares numbers, prices and text against the plan", () => {
    expect(compareToPlan("facings", 6, 4)).toBe("below");
    expect(compareToPlan("facings", 6, 6)).toBe("match");
    expect(compareToPlan("price", 20, 20.0)).toBe("match");
    expect(compareToPlan("location", "AMB-D0303", "AMB-D0302")).toBe("mismatch");
    expect(compareToPlan("brand", null, "Lay's")).toBe("na");
    expect(compareToPlan("location", "A-1", null)).toBe("not_visible");
  });

  it("checks whether the AI agreed with the human", () => {
    expect(aiAgrees("facings", 5, 6)).toBe(false);
    expect(aiAgrees("facings", 6, 6)).toBe(true);
    expect(aiAgrees("location", "amb-d0303", "AMB D0303")).toBe(true);
    expect(aiAgrees("brand", null, "Lay's")).toBe(false);
    expect(aiAgrees("brand", "Lay's", null)).toBeNull();
  });

  it("reads prices", () => {
    expect(priceNumber("₹1,299.00")).toBe(1299);
    expect(priceNumber("Rs 45")).toBe(45);
    expect(priceNumber("no price")).toBeNull();
  });
});

describe("verificationCsv", () => {
  it("includes every row and the human-verified values", () => {
    const rows = buildVerificationRows(planogramAnalysis([planned({})]), [
      { id: "p1", brand: "Lay's", product: "potato chips", variant: "Classic Salted" },
    ]);
    const verifications: FieldVerification[] = [
      {
        id: "v1",
        scan_id: "s",
        row_key: "dp:p1",
        detected_product_id: "p1",
        field_key: "facings",
        ai_value: 6,
        verified_value: 5,
        ai_text: null,
        verified_text: null,
        verified_by: "u1",
        verified_at: "2026-10-09T06:00:00Z",
      },
    ];
    const csv = verificationCsv(rows, verificationMap(verifications), new Map([["u1", "Asha"]]));
    expect(csv.data).toHaveLength(2);
    const header = csv.headers;
    const first = csv.data[0]!;
    expect(first[header.indexOf("Facings human verified")]).toBe("5");
    expect(first[header.indexOf("Facings result")]).toBe("Below plan");
    expect(first[header.indexOf("Verified by")]).toBe("Asha");
    expect(csv.data[1]![header.indexOf("Planned")]).toBe("No");
  });
});
