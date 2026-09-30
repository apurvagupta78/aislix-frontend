import { describe, expect, it } from "vitest";

import { buildVisibleUnitsLookup } from "@/lib/ai-audit/verification-units";

describe("buildVisibleUnitsLookup", () => {
  const lookup = buildVisibleUnitsLookup([
    { brand: "Coca-Cola", product_name: "Coca-Cola Cola", variant: "Original", units: 10 },
    { brand: "Real", product_name: "Real Fruit Beverage", variant: "Orange", units: 1 },
    { brand: "Real", product_name: "Real Fruit Beverage", variant: "Guava", units: 2 },
  ]);

  it("returns AI visible units, not facings, for an exact product match", () => {
    expect(lookup("Coca-Cola", "Coca-Cola Cola", "Original")).toBe(10);
    expect(lookup("coca cola", "coca-cola cola", "original")).toBe(10);
  });

  it("falls back to the only analysis row for a product when the variant differs", () => {
    expect(lookup("Coca-Cola", "Coca-Cola Cola", undefined)).toBe(10);
  });

  it("returns null when the product is ambiguous or unknown", () => {
    expect(lookup("Real", "Real Fruit Beverage", "Mango")).toBeNull();
    expect(lookup("Pepsi", "Pepsi Cola", "Original")).toBeNull();
  });
});
