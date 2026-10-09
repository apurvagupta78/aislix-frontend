import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { matchesActionProduct } from "@/lib/action-evidence";
import { UNREVIEWED_STATUS_FILTER, isUnreviewedAction } from "@/lib/corrective-action-catalog";

describe("matchesActionProduct", () => {
  it("matches on SKU regardless of case and punctuation", () => {
    expect(matchesActionProduct({ sku: "LAY-52G", name: "x" }, { sku: "lay 52g" })).toBe(true);
  });

  it("matches a product name contained in the detected name", () => {
    expect(
      matchesActionProduct(
        { sku: null, name: "Lay's Magic Masala Potato Chips 52g" },
        { productName: "Lay's Magic Masala" },
      ),
    ).toBe(true);
  });

  it("does not match short or unrelated names", () => {
    expect(matchesActionProduct({ sku: null, name: "Kurkure Masala" }, { productName: "Lay's Magic Masala" })).toBe(
      false,
    );
    expect(matchesActionProduct({ sku: null, name: "Lays" }, { productName: "Lay" })).toBe(false);
    expect(matchesActionProduct({ sku: null, name: "Lays" }, {})).toBe(false);
  });
});

describe("unreviewed actions", () => {
  it("treats proposed and dismissed fixes as not yet actions", () => {
    expect(isUnreviewedAction("proposed")).toBe(true);
    expect(isUnreviewedAction("dismissed")).toBe(true);
    expect(isUnreviewedAction("open")).toBe(false);
    expect(isUnreviewedAction("assigned")).toBe(false);
    expect(UNREVIEWED_STATUS_FILTER).toBe("(proposed,dismissed)");
  });
});
