import { describe, expect, it } from "vitest";

import { buildLunaEvidence, shelfProductsFromRows } from "@/lib/ai-audit/luna-evidence";
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
