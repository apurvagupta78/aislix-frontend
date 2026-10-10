import { describe, expect, it } from "vitest";

import { availableAiChecks, parseAiAnalysisRequest, parseLunaAnalysis } from "@/lib/ai-audit/ai-analysis";
import {
  addReferenceColumn,
  blankProductList,
  emptyReferenceRow,
  referenceColumnLabel,
  referenceCsvHeaders,
  referenceItemsForScan,
  referencePayload,
  referencePromo,
  removeReferenceColumn,
  renameReferenceColumn,
  usableReferenceRows,
  type ReferenceDocumentState,
} from "@/lib/ai-audit/reference-document";

function applied(result: ReturnType<typeof renameReferenceColumn>): ReferenceDocumentState {
  if ("error" in result) throw new Error(result.error);
  return result.state;
}

describe("editable product list columns", () => {
  it("renames a standard column without changing what it checks", () => {
    const list = blankProductList(1);
    list.rows[0] = { ...list.rows[0]!, product: "MaxFresh", price: 99 };
    const renamed = applied(renameReferenceColumn(list, { field: "price" }, "MRP"));
    expect(referenceColumnLabel(renamed.meta, "price")).toBe("MRP");
    expect(referenceItemsForScan(renamed.rows, {})[0]).toMatchObject({ expected_price: 99 });
    expect(referenceCsvHeaders([], renamed.meta.column_labels)).toContain("MRP");
  });

  it("rejects empty and duplicate names", () => {
    const list = blankProductList(1);
    expect("error" in renameReferenceColumn(list, { field: "brand" }, "  ")).toBe(true);
    expect("error" in renameReferenceColumn(list, { field: "brand" }, "product")).toBe(true);
    expect("error" in renameReferenceColumn(list, { extra: "Promo" }, "Qty")).toBe(true);
  });

  it("keeps the promotion check when the Promo column is renamed", () => {
    const list = blankProductList(1);
    list.rows[0] = { ...list.rows[0]!, product: "MaxFresh", extra: { Promo: "Buy 2 Get 1" } };
    const renamed = applied(renameReferenceColumn(list, { extra: "Promo" }, "Notes"));
    expect(renamed.meta.extra_columns).toEqual(["Notes"]);
    expect(renamed.rows[0]!.extra).toEqual({ Notes: "Buy 2 Get 1" });
    expect(referencePayload(renamed, {}).items[0]).toMatchObject({ expected_promo: "Buy 2 Get 1" });
  });

  it("adds uniquely named columns and removes them with their values", () => {
    const first = addReferenceColumn(blankProductList(1));
    const second = addReferenceColumn(first.state);
    expect([first.header, second.header]).toEqual(["New column", "New column 2"]);
    const filled = {
      ...second.state,
      rows: second.state.rows.map((row) => ({ ...row, extra: { ...row.extra, "New column": "x" } })),
    };
    const removed = removeReferenceColumn(filled, "New column");
    expect(removed.meta.extra_columns).toEqual(["Promo", "New column 2"]);
    expect(removed.rows[0]!.extra).toEqual({});
  });
});

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
