import { describe, expect, it } from "vitest";

import { availableAiChecks, parseAiAnalysisRequest, parseLunaAnalysis } from "@/lib/ai-audit/ai-analysis";
import {
  blankProductList,
  emptyReferenceRow,
  referenceItemsForScan,
  referencePromo,
  usableReferenceRows,
} from "@/lib/ai-audit/reference-document";

describe("typed product list (AI Audit · Start from scratch)", () => {
  it("starts empty with a Promo column and counts as saved", () => {
    const list = blankProductList();
    expect(list.meta.source).toBe("manual");
    expect(list.meta.extra_columns).toEqual(["Promo"]);
    expect(list.rows).toHaveLength(3);
    expect(list.saved).toBe(true);
    expect(usableReferenceRows(list.rows)).toEqual([]);
  });

  it("sends the line's promo to the shelf comparison", () => {
    const row = { ...emptyReferenceRow(1), product: "MaxFresh", brand: "Colgate", extra: { Promo: "Buy 2 Get 1" } };
    expect(referencePromo(row)).toBe("Buy 2 Get 1");
    expect(referencePromo({ extra: { "Scheme / offer": " 10% off " } })).toBe("10% off");
    expect(referencePromo({ extra: { Promo: "n/a", HSN: "3306" } })).toBeNull();
    expect(referenceItemsForScan([row], {})[0]).toMatchObject({ product_name: "MaxFresh", expected_promo: "Buy 2 Get 1" });
  });
});

describe("Promotion check", () => {
  it("can be ticked with or without a document and survives parsing", () => {
    expect(availableAiChecks(null).has("promotion")).toBe(true);
    expect(parseAiAnalysisRequest({ checks: ["promotion", "bogus"], question: "" })?.checks).toEqual(["promotion"]);
    const analysis = parseLunaAnalysis({
      answer: "One offer seen.",
      findings: [{ check: "promotion", status: "ok", title: "Offer seen", note: "Buy 2 Get 1 on line 1", rows: [1] }],
    });
    expect(analysis?.findings[0]?.check).toBe("promotion");
  });
});
