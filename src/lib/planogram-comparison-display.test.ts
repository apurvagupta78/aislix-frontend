import { describe, expect, it } from "vitest";
import { buildPositionComparisons, buildShelfExecutionSummary } from "@/lib/planogram-comparison-display";
import { emptyRow, type PlanogramRow } from "@/lib/planogram";
import type { ScanResult } from "@/lib/scan-results";

function docRow(brand: string, product: string): PlanogramRow {
  return { ...emptyRow(), brand, product_name: product, expected_facings: 1, expected_qty: 1, shelf_position: "" };
}

describe("buildPositionComparisons", () => {
  it("pairs document lines without shelf positions with their own match line", () => {
    const rows = [
      docRow("Trident", "Spearmint Gum"),
      docRow("Rolo", "Chocolate 24 pack"),
      docRow("Mentos", "Mint Roll"),
    ];
    const result = {
      scan_id: "scan-1",
      planogram: { requested: true, summary: { configured_rows: rows } },
      inventory: [{ brand: "Trident", product: "Spearmint Gum", quantity: 8 }],
    } as unknown as ScanResult;

    const positions = buildPositionComparisons(result);
    expect(positions.map((p) => p.status)).toEqual(["match", "missing", "missing"]);
    expect(buildShelfExecutionSummary(positions).matched).toBe(1);
  });
});
