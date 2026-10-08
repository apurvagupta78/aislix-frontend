import { describe, expect, it } from "vitest";
import { referenceExpectsFacings, type ReferenceMatch } from "@/lib/ai-audit/reference-match";

function match(document: Partial<ReferenceMatch["document"]>): ReferenceMatch {
  return { document: { extra_columns: [], ...document } } as unknown as ReferenceMatch;
}

describe("referenceExpectsFacings", () => {
  it("is true for planograms without a reference document", () => {
    expect(referenceExpectsFacings(null)).toBe(true);
  });

  it("is false for a stock list that only expects presence", () => {
    expect(referenceExpectsFacings(match({ source: "csv" }), [1, 1, 1])).toBe(false);
  });

  it("is true for planogram documents, a facings column or real facing targets", () => {
    expect(referenceExpectsFacings(match({ document_type: "planogram" }), [1])).toBe(true);
    expect(referenceExpectsFacings(match({ extra_columns: ["Expected facings"] }), [1])).toBe(true);
    expect(referenceExpectsFacings(match({ source: "csv" }), [1, 4])).toBe(true);
  });
});
