/**
 * Planogram vs shelf comparison CSV exports.
 */

import {
  buildPositionComparisons,
  planogramComparisonMeta,
  type PositionComparisonRow,
} from "@/lib/planogram-comparison-display";
import { downloadCsvFile } from "@/lib/kpi-details-csv";
import type { PlanogramComparison } from "@/lib/planogram-compliance";
import type { ScanResult } from "@/lib/scan-results";

function csvEscape(value: string | number | undefined | null): string {
  let s = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(values: (string | number | undefined | null)[]): string {
  return values.map(csvEscape).join(",");
}

function formatTimestamp(iso?: string): string {
  if (!iso) return new Date().toISOString();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString();
}

function placementStatus(p: PositionComparisonRow): string {
  if (p.status === "match") return "Match";
  if (p.status === "moved") return "Moved";
  if (p.status === "missing") return "Missing";
  if (p.status === "review") return "Review";
  return "Partial";
}

function facingStatus(p: PositionComparisonRow): string {
  if (p.status === "low_facings") return "Low facings";
  if (p.status === "match") return "Match";
  if (p.observed_facings >= p.expected_facings) return "Match";
  if (p.observed_facings === 0) return "Not observed";
  return "Partial";
}

function overallStatus(p: PositionComparisonRow): string {
  const map: Record<string, string> = {
    match: "Match",
    moved: "Moved",
    low_facings: "Low facings",
    missing: "Missing",
    review: "Review",
  };
  return map[p.status] ?? p.status;
}

function issueType(p: PositionComparisonRow): string {
  if (p.status === "moved") return "wrong_location";
  if (p.status === "low_facings") return "qty_mismatch";
  if (p.status === "missing") return "missing";
  if (p.status === "review") return "needs_review";
  return "ok";
}

export function buildComparisonCsv(
  result: ScanResult,
  comparison?: PlanogramComparison | null,
): string {
  const meta = planogramComparisonMeta(result);
  const positions = buildPositionComparisons(result, comparison);
  const lines: string[] = [
    "# Aislix Shelf Comparison Export",
    row(["Audit ID", meta.audit_id]),
    row(["Audit Date", formatTimestamp(meta.audit_date)]),
    row(["Store", meta.store]),
    row(["Fixture", meta.fixture]),
    row(["Category", meta.category]),
    row(["Sub-category", meta.sub_category]),
    row(["Planogram Version", meta.planogram_version]),
    row(["Calculation Timestamp", formatTimestamp(meta.audit_date)]),
    "",
    row([
      "Audit ID",
      "Audit Date",
      "Store",
      "Fixture",
      "Shelf",
      "Position ID",
      "Expected SKU",
      "Expected Product",
      "Expected Brand",
      "Expected Facings",
      "Observed SKU",
      "Observed Product",
      "Observed Brand",
      "Observed Facings",
      "Expected Location",
      "Observed Location",
      "Placement Status",
      "Facing Status",
      "Orientation Status",
      "Overall Position Status",
      "Confidence",
      "Review Status",
      "Issue Type",
      "Issue Severity",
      "Corrective Action",
      "Evidence Image Reference",
      "Planogram Version",
      "Calculation Timestamp",
    ]),
  ];

  for (const p of positions) {
    lines.push(
      row([
        meta.audit_id,
        formatTimestamp(meta.audit_date),
        meta.store,
        meta.fixture,
        p.shelf_label,
        p.position_id,
        p.row.sku,
        p.row.product_name,
        p.row.brand,
        p.expected_facings,
        p.observed_sku ?? "",
        p.observed_product ?? "",
        p.observed_brand ?? "",
        p.observed_facings,
        p.position_id,
        p.observed_location ?? "",
        placementStatus(p),
        facingStatus(p),
        "Front",
        overallStatus(p),
        p.confidence ?? "",
        p.review_status,
        issueType(p),
        p.severity,
        p.corrective_action ?? "",
        `${result.scan_id ?? meta.audit_id}:${p.position_id}`,
        meta.planogram_version,
        formatTimestamp(meta.audit_date),
      ]),
    );
  }
  return lines.join("\n");
}

export function buildExceptionsCsv(
  result: ScanResult,
  comparison?: PlanogramComparison | null,
): string {
  const meta = planogramComparisonMeta(result);
  const positions = buildPositionComparisons(result, comparison).filter((p) => p.status !== "match");
  const lines: string[] = [
    "# Aislix Shelf Exceptions Export",
    "",
    row([
      "Audit ID",
      "Audit Date",
      "Store",
      "Fixture",
      "Shelf",
      "Position ID",
      "SKU",
      "Product",
      "Brand",
      "Issue Type",
      "Expected Result",
      "Observed Result",
      "Severity",
      "Confidence",
      "Review Status",
      "Recommended Action",
      "Evidence Reference",
      "Planogram Version",
    ]),
  ];

  for (const p of positions) {
    lines.push(
      row([
        meta.audit_id,
        formatTimestamp(meta.audit_date),
        meta.store,
        meta.fixture,
        p.shelf_label,
        p.position_id,
        p.row.sku,
        p.row.product_name,
        p.row.brand,
        issueType(p),
        `${p.expected_facings} facings @ ${p.position_id}`,
        p.observed_facings > 0
          ? `${p.observed_facings} facings @ ${p.observed_location ?? "unknown"}`
          : "Not confirmed",
        p.severity,
        p.confidence ?? "",
        p.review_status,
        p.corrective_action ?? p.status_detail,
        `${result.scan_id ?? meta.audit_id}:${p.position_id}`,
        meta.planogram_version,
      ]),
    );
  }
  return lines.join("\n");
}

export function downloadComparisonCsv(result: ScanResult, comparison?: PlanogramComparison | null): void {
  const scan = result.scan_id ?? "audit";
  downloadCsvFile(`aislix-${scan}-shelf-comparison.csv`, buildComparisonCsv(result, comparison));
}

export function downloadExceptionsCsv(result: ScanResult, comparison?: PlanogramComparison | null): void {
  const scan = result.scan_id ?? "audit";
  downloadCsvFile(`aislix-${scan}-shelf-exceptions.csv`, buildExceptionsCsv(result, comparison));
}

export function downloadBrandAnalysisComparisonBundle(
  result: ScanResult,
  comparison?: PlanogramComparison | null,
): void {
  const scan = result.scan_id ?? "audit";
  const combined = [
    buildComparisonCsv(result, comparison),
    "",
    "# --- Exceptions ---",
    "",
    buildExceptionsCsv(result, comparison),
  ].join("\n");
  downloadCsvFile(`aislix-${scan}-shelf-comparison-full.csv`, combined);
}
