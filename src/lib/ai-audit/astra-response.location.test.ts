import { describe, expect, it } from "vitest";

import { normalizeAstraAnalysis } from "./astra-response";

const locationAnalysis = {
  available: true,
  locations: [
    { label: "AMB-D0703", rack_marker: "B", label_status: "READ", facings: 9, visible_units: 9, products: 2, empty: false },
    { label: "AMB-D0713", rack_marker: "B", label_status: "READ", facings: 0, visible_units: 0, products: 0, empty: true },
  ],
  empty_locations: [
    { label: "AMB-D0713", rack_marker: "B", label_status: "READ", facings: 0, visible_units: 0, products: 0, empty: true },
  ],
  metrics: {
    location_labels_read: 2,
    empty_locations: 1,
    racks_detected: 1,
    products_without_location: 1,
    prices_read: 1,
  },
};

describe("shelf-edge location, rack and price parsing", () => {
  it("reads per-product location fields and the location rollup", () => {
    const analysis = normalizeAstraAnalysis({
      analysis_mode: "shelf_only",
      aislix_shelf_analysis: {
        analysis_type: "shelf_cv",
        products: [
          {
            brand: "Catch",
            product_name: "Pink Rock Salt",
            actual_facings: 3,
            actual_visible_units: 3,
            location_label: "AMB-D0703",
            location_label_status: "read",
            rack_marker: "B",
            visible_price: "85",
            price_source: "shelf_tag",
          },
          {
            brand: "Zandu",
            product_name: "Pure Honey",
            actual_facings: 1,
            actual_visible_units: 1,
            location_label: null,
            location_label_status: "NOT_VISIBLE",
            rack_marker: "null",
            visible_price: null,
            price_source: "NONE",
          },
        ],
        location_analysis: locationAnalysis,
      },
    });
    expect(analysis.mode).toBe("shelf_only");
    if (analysis.mode !== "shelf_only") return;
    const [catchRow, zandu] = analysis.products;
    expect(catchRow?.location_label).toBe("AMB-D0703");
    expect(catchRow?.location_label_status).toBe("READ");
    expect(catchRow?.visible_price).toBe("85");
    expect(catchRow?.price_source).toBe("SHELF_TAG");
    expect(zandu?.location_label).toBeNull();
    expect(zandu?.rack_marker).toBeNull();
    expect(analysis.location_analysis?.empty_locations.map((row) => row.label)).toEqual(["AMB-D0713"]);
    expect(analysis.location_analysis?.metrics.racks_detected).toBe(1);
    expect(analysis.summary.prices_read).toBe(1);
  });

  it("leaves location_analysis undefined for scans made before location reading", () => {
    const analysis = normalizeAstraAnalysis({
      analysis_mode: "shelf_only",
      astra_cv_analysis: {
        analysis_type: "shelf_cv",
        products: [{ brand: "Pepsi", actual_facings: 2, actual_visible_units: 2 }],
      },
    });
    if (analysis.mode !== "shelf_only") throw new Error("expected shelf_only");
    expect(analysis.location_analysis).toBeUndefined();
    expect(analysis.products[0]?.location_label).toBeNull();
  });

  it("reads planogram location and price status", () => {
    const analysis = normalizeAstraAnalysis({
      analysis_mode: "planogram_comparison",
      aislix_planogram_analysis: {
        products: [
          {
            brand: "Catch",
            product_name: "Pink Rock Salt",
            expected_facings: 3,
            actual_facings: 3,
            expected_location: "AMB-D0703",
            actual_location_label: "AMB-D0702",
            location_status: "WRONG_LOCATION",
            expected_mrp_inr: 90,
            visible_price: "85",
            price_status: "MISMATCH",
            price_difference: -5,
            additional_location_labels: ["AMB-D0704"],
          },
        ],
        location_analysis: locationAnalysis,
      },
    });
    if (analysis.mode !== "planogram") throw new Error("expected planogram");
    const row = analysis.products[0]!;
    expect(row.expected_location).toBe("AMB-D0703");
    expect(row.actual_location_label).toBe("AMB-D0702");
    expect(row.location_status).toBe("WRONG_LOCATION");
    expect(row.price_status).toBe("MISMATCH");
    expect(row.price_difference).toBe(-5);
    expect(row.additional_location_labels).toEqual(["AMB-D0704"]);
    expect(analysis.location_analysis?.metrics.location_labels_read).toBe(2);
  });
});
