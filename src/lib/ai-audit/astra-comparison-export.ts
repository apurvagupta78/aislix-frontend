import type { NormalizedAstraAnalysis } from "@/lib/ai-audit/astra-response";

function escapeCsv(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  if (typeof window === "undefined") return;
  const lines = [headers.map(escapeCsv).join(","), ...rows.map((row) => row.map(escapeCsv).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadAstraComparisonCsv(
  analysis: NormalizedAstraAnalysis,
  scanId = "audit",
): boolean {
  if (analysis.mode === "planogram") {
    downloadCsv(
      `aislix-${scanId}-planogram-comparison.csv`,
      [
        "location",
        "category",
        "subcategory",
        "brand",
        "brand_status",
        "product_name",
        "product_status",
        "variant",
        "variant_status",
        "sku",
        "sku_status",
        "expected_facings",
        "actual_facings",
        "facing_variance",
        "facing_compliance_percent",
        "min_facings",
        "max_facings",
        "facing_range_status",
        "expected_shelf_units",
        "actual_visible_units",
        "shelf_unit_variance",
        "shelf_unit_compliance_percent",
        "expected_shelf_position",
        "actual_shelf_position",
        "placement_status",
        "expected_mrp_inr",
        "visible_price",
        "price_status",
        "avg_daily_sales",
        "estimated_visible_shelf_coverage_days",
        "visible_unit_shortfall",
        "potential_visible_unit_value_gap_inr",
        "risk_status",
        "overall_status",
        "confidence",
        "evidence_note",
      ],
      analysis.products.map((row) => [
        row.location,
        row.category,
        row.subcategory,
        row.brand,
        row.brand_status,
        row.product_name,
        row.product_status,
        row.variant,
        row.variant_status,
        row.sku,
        row.sku_status,
        String(row.expected_facings),
        String(row.actual_facings),
        String(row.facing_variance),
        String(row.facing_compliance_percent ?? ""),
        String(row.min_facings),
        String(row.max_facings),
        row.facing_range_status,
        String(row.expected_shelf_units),
        String(row.actual_visible_units),
        String(row.shelf_unit_variance),
        String(row.shelf_unit_compliance_percent ?? ""),
        row.expected_shelf_position,
        row.actual_shelf_position,
        row.placement_status,
        String(row.expected_mrp_inr),
        row.visible_price ?? "",
        row.price_status,
        String(row.avg_daily_sales),
        String(row.estimated_visible_shelf_coverage_days ?? ""),
        String(row.visible_unit_shortfall),
        String(row.potential_visible_unit_value_gap_inr),
        row.risk_status,
        row.overall_status,
        String(row.confidence),
        row.evidence_note,
      ]),
    );
    return true;
  }

  if (analysis.mode === "shelf_only") {
    downloadCsv(
      `aislix-${scanId}-shelf-analysis.csv`,
      [
        "brand",
        "brand_status",
        "product_name",
        "product_status",
        "variant",
        "variant_status",
        "category",
        "category_status",
        "subcategory",
        "subcategory_status",
        "shelf_position",
        "actual_facings",
        "actual_visible_units",
        "confidence",
        "evidence_note",
      ],
      analysis.products.map((row) => [
        row.brand,
        row.brand_status,
        row.product_name,
        row.product_status,
        row.variant,
        row.variant_status,
        row.category,
        row.category_status,
        row.subcategory,
        row.subcategory_status,
        row.shelf_position,
        String(row.actual_facings),
        String(row.actual_visible_units),
        String(row.confidence),
        row.evidence_note,
      ]),
    );
    return true;
  }

  return false;
}
