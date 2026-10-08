import { describe, expect, it } from "vitest";

import { collapseRepeatedWords, findingRecurrenceKey, findingSubjectLabel } from "./finding-subject";

describe("collapseRepeatedWords", () => {
  it("drops a brand repeated in front of the product name", () => {
    expect(collapseRepeatedWords("Texas Texas Mixed Drops Candy")).toBe("Texas Mixed Drops Candy");
    expect(collapseRepeatedWords("Below planned quantity — Trident Trident Watermelon Twist Gum")).toBe(
      "Below planned quantity — Trident Watermelon Twist Gum",
    );
    expect(collapseRepeatedWords("Missing product — Mentos Mentos Mint Roll")).toBe("Missing product — Mentos Mint Roll");
  });

  it("collapses repeated multi-word brands", () => {
    expect(collapseRepeatedWords("Ice Breakers Ice Breakers Mints")).toBe("Ice Breakers Mints");
  });

  it("leaves short or non-repeated names alone", () => {
    expect(collapseRepeatedWords("Bon Bon Biscuits")).toBe("Bon Bon Biscuits");
    expect(collapseRepeatedWords("India Gate Basmati Rice Classic 1 kg")).toBe("India Gate Basmati Rice Classic 1 kg");
  });
});

describe("findingRecurrenceKey", () => {
  it("groups AI findings by product name when there is no SKU", () => {
    const a = { id: "1", store_id: "s", sku: null, product_name: "Trident Gum", finding_type: "out_of_stock" };
    const b = { id: "2", store_id: "s", sku: null, product_name: "trident gum", finding_type: "out_of_stock" };
    const c = { id: "3", store_id: "s", sku: null, product_name: "Orbit Gum", finding_type: "out_of_stock" };
    expect(findingRecurrenceKey(a)).toBe(findingRecurrenceKey(b));
    expect(findingRecurrenceKey(a)).not.toBe(findingRecurrenceKey(c));
  });

  it("never treats two whole-shelf findings as a repeat", () => {
    const a = { id: "1", store_id: "s", finding_type: "wrong_placement" };
    const b = { id: "2", store_id: "s", finding_type: "wrong_placement" };
    expect(findingRecurrenceKey(a)).not.toBe(findingRecurrenceKey(b));
  });
});

describe("findingSubjectLabel", () => {
  it("falls back to SKU then whole shelf", () => {
    expect(findingSubjectLabel({ product_name: "Rolo Rolo Chocolate", sku: "X1" })).toBe("Rolo Chocolate");
    expect(findingSubjectLabel({ product_name: " ", sku: "X1" })).toBe("X1");
    expect(findingSubjectLabel({ product_name: null, sku: null })).toBe("Whole shelf");
  });
});
