import { describe, expect, it } from "vitest";
import { canMarkSellable, checkReconciliation } from "./reconciliation";

describe("checkReconciliation", () => {
  it("accepts 4 = 2 + 1 + 1 with 4 observations", () => {
    const r = checkReconciliation({
      physicalCount: 4,
      sellable: 2,
      remove: 1,
      unresolved: 1,
      observationsRecorded: 4,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects expected 4 actual 5 without 5 observations", () => {
    const r = checkReconciliation({
      physicalCount: 5,
      sellable: 2,
      remove: 1,
      unresolved: 1,
      observationsRecorded: 4,
    });
    expect(r.ok).toBe(false);
  });

  it("blocks unreadable sellable", () => {
    expect(canMarkSellable({ unreadable: true, classification: "sellable" })).toBe(false);
  });

  it("blocks unresolved sellable", () => {
    expect(canMarkSellable({ unreadable: false, classification: "unresolved" })).toBe(false);
  });
});
