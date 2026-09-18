import { describe, expect, it } from "vitest";

import { FALLBACK_CATEGORIES } from "@/lib/categories.data";

import { mergeHelpAskCategories, resolveSubCategoryLabel } from "./help-ask-aislix.categories";

describe("help-ask-aislix categories", () => {
  it("merges master categories with scan-derived categories", () => {
    const { categories, categoryCatalog } = mergeHelpAskCategories(FALLBACK_CATEGORIES, [
      { category: "Beverages", sub_category: "Soft drinks" },
      { category: "Custom Org Category", sub_category: "Specialty" },
    ]);
    expect(categories).toContain("Beverages");
    expect(categories).toContain("Custom Org Category");
    expect(categoryCatalog.length).toBeGreaterThan(FALLBACK_CATEGORIES.length);
  });

  it("resolves Others sub-category from custom text", () => {
    const label = resolveSubCategoryLabel(
      FALLBACK_CATEGORIES,
      "Beverages",
      "others",
      "Sparkling water",
    );
    expect(label).toBe("Sparkling water");
  });
});
