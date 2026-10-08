import { describe, expect, it } from "vitest";

import {
  brandShareScopeText,
  buildLunaEvidence,
  shelfProductsFromRows,
  shelfPromotionsFromAstra,
} from "@/lib/ai-audit/luna-evidence";
import { buildDemoSampleDocumentContext, demoSampleDocument } from "@/lib/ai-audit/demo-sample-document";
import { usableReferenceRows } from "@/lib/ai-audit/reference-document";
import { aiAnalysisReady } from "@/lib/ai-audit/ai-analysis";

describe("shelfProductsFromRows", () => {
  it("maps landing inventory rows and drops nameless rows", () => {
    const products = shelfProductsFromRows([
      { product_name: "MaxFresh", brand: "Colgate", facings: 3.4, price: "2.99", status_label: "In stock", confidence: 0.9 },
      { brand: "Odol" },
      null,
    ]);
    expect(products).toEqual([
      {
        name: "MaxFresh",
        brand: "Colgate",
        variant: null,
        facings: 3,
        price_inr: 2.99,
        stock_status: "In stock",
        confidence: 0.9,
      },
    ]);
  });
});

describe("brandShareScopeText", () => {
  it("names the audited sub-category when share excludes other categories", () => {
    const text = brandShareScopeText(
      { audit_scope: { audited_sub_category: "biscuits" } },
      { brand_share_scope: "eligible_category", brand_share_denominator: 22 },
    );
    expect(text).toBe(
      "Share of the 22 facings in the audited sub-category (biscuits) only; products from other categories in the photo are excluded.",
    );
  });

  it("returns null when the backend sent no scope", () => {
    expect(brandShareScopeText({}, null)).toBeNull();
  });
});

describe("buildLunaEvidence", () => {
  it("works without a document comparison and never invents document metrics", () => {
    const evidence = buildLunaEvidence({
      referenceMatch: undefined,
      products: shelfProductsFromRows([{ product: "MaxFresh", brand: "Colgate", facings: 4 }]),
      brandShare: [{ brand: "Colgate", share: 100 }],
      totalFacings: 4,
      countPending: false,
      photoCount: null,
    });
    expect(evidence.documentLines).toEqual([]);
    expect(evidence.notOnDocument).toEqual([]);
    expect(evidence.shelfProducts).toEqual([{ product: "Colgate MaxFresh", facings: 4 }]);
    expect(evidence.metrics).not.toHaveProperty("lines_total");
    expect(evidence.countPending).toBe(false);
    expect(evidence.promotions).toEqual([]);
  });

  it("passes the offers read on the shelf to the analysis", () => {
    const promotions = shelfPromotionsFromAstra({
      products: [
        { brand: "Colgate", product: "MaxFresh", promotion_text: "Buy 2 Get 1", promotion_type: "multi_buy", promo_price: null, location_label: "A-01" },
        { brand: "Pepsodent", product: "Germicheck", promotion_text: null, promotion_type: "NONE" },
        { brand: "Close-Up", product: "Red Hot", promotion_text: "null" },
      ],
      visible_promotions: [
        { brand: "Colgate", product_name: "MaxFresh", promotion_text: "Buy 2 Get 1" },
        { promotion_text: "20% OFF", promotion_type: "PRICE_OFF", promo_price: "99" },
      ],
    });
    expect(promotions).toEqual([
      { product: "Colgate MaxFresh", promotion: "Buy 2 Get 1", promotion_type: "MULTI_BUY", promo_price: null, location: "A-01" },
      { product: null, promotion: "20% OFF", promotion_type: "PRICE_OFF", promo_price: "99", location: null },
    ]);
    const evidence = buildLunaEvidence({
      referenceMatch: undefined,
      products: [],
      brandShare: [],
      totalFacings: 0,
      countPending: false,
      photoCount: 1,
      promotions,
    });
    expect(evidence.promotions[1]).toEqual({ promotion: "20% OFF", promotion_type: "PRICE_OFF", promo_price: "99" });
    expect(shelfPromotionsFromAstra(null)).toEqual([]);
  });
});

describe("demo sample document", () => {
  it("is a usable stock list with qty, price and location", () => {
    const doc = demoSampleDocument();
    const rows = usableReferenceRows(doc.rows);
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.every((r) => r.product && (r.qty ?? 0) > 0)).toBe(true);
    expect(new Set(rows.map((r) => `${r.brand}|${r.product}|${r.pack_size}`)).size).toBe(rows.length);
  });

  it("pre-fills a document audit context, not the demo planogram", () => {
    const ctx = buildDemoSampleDocumentContext();
    expect(ctx.planogramRows).toEqual([]);
    expect(ctx.planogramMeta?.is_demo).not.toBe(true);
    expect(ctx.reference?.rows.length).toBeGreaterThan(0);
    expect(ctx.aiAnalysis && aiAnalysisReady(ctx.aiAnalysis)).toBe(true);
  });
});
