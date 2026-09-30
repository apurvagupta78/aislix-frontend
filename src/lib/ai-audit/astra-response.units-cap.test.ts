import { describe, expect, it } from "vitest";

import { capUnitsToFacings, normalizeAstraAnalysis } from "./astra-response";

describe("visible units never exceed facings", () => {
  it("caps each shelf-only product and the summary total", () => {
    const analysis = normalizeAstraAnalysis({
      analysis_mode: "shelf_only",
      astra_cv_analysis: {
        analysis_type: "shelf_cv",
        products: [
          { brand: "Coca-Cola", category: "Cola", actual_facings: 5, actual_visible_units: 9 },
          { brand: "Pepsi", category: "Cola", actual_facings: 4, actual_visible_units: 8 },
          { brand: "Lay's", category: "Chips", actual_facings: 3, actual_visible_units: 2 },
        ],
        summary: { total_actual_facings: 12, total_actual_visible_units: 19 },
      },
    });
    expect(analysis.mode).toBe("shelf_only");
    if (analysis.mode !== "shelf_only") return;
    expect(analysis.products.map((p) => p.actual_visible_units)).toEqual([5, 4, 2]);
    expect(analysis.summary.visible_units).toBe(11);
  });

  it("leaves units alone when facings are unknown", () => {
    expect(capUnitsToFacings(6, null)).toBe(6);
    expect(capUnitsToFacings(6, 0)).toBe(6);
    expect(capUnitsToFacings(null, 4)).toBeNull();
    expect(capUnitsToFacings(3, 4)).toBe(3);
  });
});
