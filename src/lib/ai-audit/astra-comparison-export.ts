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
        "brand",
        "brand_status",
        "product_name",
        "product_status",
        "variant",
        "variant_status",
        "expected_facings",
        "actual_facings",
        "facing_variance",
        "facing_compliance_percent",
        "expected_shelf_units",
        "actual_visible_units",
        "shelf_unit_variance",
        "facings_range_status",
        "overall_row_status",
        "confidence",
        "evidence_note",
      ],
      analysis.rows.map((row) => [
        row.location,
        row.brand,
        row.brand_status,
        row.product_name,
        row.product_status,
        row.variant,
        row.variant_status,
        String(row.expected_facings),
        String(row.actual_facings),
        String(row.facing_variance),
        String(row.facing_compliance_percent),
        String(row.expected_shelf_units),
        String(row.actual_visible_units),
        String(row.shelf_unit_variance),
        row.facings_range_status,
        row.overall_row_status,
        String(row.confidence),
        row.evidence_note,
      ]),
    );
    return true;
  }

  if (analysis.mode === "expected_products") {
    downloadCsv(
      `aislix-${scanId}-expected-products-comparison.csv`,
      [
        "location",
        "category",
        "category_status",
        "sub_category",
        "subcategory_status",
        "brand",
        "brand_status",
        "product_name",
        "product_status",
        "variant",
        "variant_status",
        "expected_facings",
        "actual_facings",
        "facing_variance",
        "facing_status",
        "expected_shelf_units",
        "actual_visible_units",
        "shelf_unit_variance",
        "shelf_unit_status",
        "overall_status",
        "confidence",
        "evidence_note",
      ],
      analysis.products.map((row) => [
        row.location,
        row.category,
        row.category_status,
        row.sub_category,
        row.subcategory_status,
        row.brand,
        row.brand_status,
        row.product_name,
        row.product_status,
        row.variant,
        row.variant_status,
        String(row.expected_facings),
        String(row.actual_facings),
        String(row.facing_variance),
        row.facing_status,
        String(row.expected_shelf_units),
        String(row.actual_visible_units),
        String(row.shelf_unit_variance),
        row.shelf_unit_status,
        row.overall_status,
        String(row.confidence),
        row.evidence_note,
      ]),
    );
    return true;
  }

  return false;
}
