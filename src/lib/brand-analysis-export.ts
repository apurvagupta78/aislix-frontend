/**
 * Brand & competition CSV exports.
 */

import {
  buildBrandAnalysisMeta,
  buildProductMixRows,
  buildShareOfShelfSegments,
} from "@/lib/brand-analysis-data";
import { downloadCsvFile } from "@/lib/kpi-details-csv";
import type { CompetitorSnapshot } from "@/lib/brand-intel";
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

export function buildShareOfShelfCsv(result: ScanResult, snapshot?: CompetitorSnapshot | null): string {
  const meta = buildBrandAnalysisMeta(result, snapshot);
  const segments = buildShareOfShelfSegments(snapshot, meta.total_linear);
  const lines: string[] = [
    "# Aislix Share of Shelf Export",
    row(["Audit ID", meta.audit_id]),
    row(["Audit Date", formatTimestamp(meta.audit_date)]),
    row(["Store", meta.store]),
    row(["Fixture", meta.fixture]),
    row(["Category", meta.category]),
    row(["Sub-category", meta.sub_category]),
    row(["Target Brand", meta.target_brand]),
    row(["Planned Share of Shelf %", meta.planned_share ?? ""]),
    row(["Actual Share of Shelf %", meta.actual_share]),
    row(["Variance (pp)", meta.variance_pts ?? ""]),
    row(["Measurement Basis", meta.measurement_basis]),
    row(["Total Category Linear Shelf Space", meta.total_linear]),
    row(["Planogram Version", meta.planogram_version]),
    "",
    row([
      "Audit ID",
      "Audit Date",
      "Store",
      "Fixture",
      "Category",
      "Sub-category",
      "Target Brand",
      "Brand",
      "Included in Category",
      "Shelf",
      "Linear Shelf Space",
      "Total Category Linear Shelf Space",
      "Share of Shelf %",
      "Planned Share of Shelf %",
      "Variance (pp)",
      "Measurement Basis",
      "Coverage",
      "Result Status",
      "Planogram Version",
      "Evidence Reference",
    ]),
  ];

  for (const seg of segments) {
    lines.push(
      row([
        meta.audit_id,
        formatTimestamp(meta.audit_date),
        meta.store,
        meta.fixture,
        meta.category,
        meta.sub_category,
        meta.target_brand,
        seg.brand,
        seg.is_other_bucket ? "Aggregated" : "Yes",
        "",
        seg.linear_units,
        meta.total_linear,
        seg.share,
        meta.planned_share ?? "",
        seg.is_primary && meta.variance_pts != null ? meta.variance_pts : "",
        meta.measurement_basis,
        "100%",
        "Complete",
        meta.planogram_version,
        `${result.scan_id ?? meta.audit_id}:${seg.brand}`,
      ]),
    );
  }
  return lines.join("\n");
}

export function buildProductMixCsv(result: ScanResult, snapshot?: CompetitorSnapshot | null): string {
  const meta = buildBrandAnalysisMeta(result, snapshot);
  const primary = snapshot?.primary_brand ?? "";
  const products = buildProductMixRows(result.inventory ?? [], primary);
  const totalPresence = products.reduce((s, p) => s + p.facings, 0) || 1;

  const lines: string[] = [
    "# Aislix Product Mix Export",
    row(["Audit ID", meta.audit_id]),
    row(["Audit Date", formatTimestamp(meta.audit_date)]),
    row(["Store", meta.store]),
    row(["Fixture", meta.fixture]),
    row(["Category", meta.category]),
    row(["Sub-category", meta.sub_category]),
    "",
    row([
      "Audit ID",
      "Audit Date",
      "Store",
      "Fixture",
      "Category",
      "Sub-category",
      "Brand",
      "SKU",
      "Product Name",
      "Variant",
      "Observed Facings",
      "Observed Shelf Presence",
      "Shelf",
      "Location",
      "Recognition Confidence",
      "Status",
      "Evidence Reference",
    ]),
  ];

  for (const p of products) {
    const presence = Math.round((p.facings / totalPresence) * 1000) / 10;
    lines.push(
      row([
        meta.audit_id,
        formatTimestamp(meta.audit_date),
        meta.store,
        meta.fixture,
        meta.category,
        meta.sub_category,
        p.brand,
        p.sku ?? "",
        p.product,
        p.variant ?? "",
        p.facings,
        `${presence}%`,
        p.shelf ?? "",
        p.location ?? "",
        p.confidence ?? "",
        p.is_unknown ? "Unclassified" : "Detected",
        `${result.scan_id ?? meta.audit_id}:${p.sku ?? p.product}`,
      ]),
    );
  }
  return lines.join("\n");
}

export function buildBrandAnalysisCombinedCsv(
  result: ScanResult,
  snapshot?: CompetitorSnapshot | null,
): string {
  return [
    buildShareOfShelfCsv(result, snapshot),
    "",
    "# --- Product Mix ---",
    "",
    buildProductMixCsv(result, snapshot),
  ].join("\n");
}

export function downloadShareOfShelfCsv(result: ScanResult, snapshot?: CompetitorSnapshot | null): void {
  const scan = result.scan_id ?? "audit";
  downloadCsvFile(`aislix-${scan}-share-of-shelf.csv`, buildShareOfShelfCsv(result, snapshot));
}

export function downloadProductMixCsv(result: ScanResult, snapshot?: CompetitorSnapshot | null): void {
  const scan = result.scan_id ?? "audit";
  downloadCsvFile(`aislix-${scan}-product-mix.csv`, buildProductMixCsv(result, snapshot));
}

export function downloadBrandAnalysisCsv(result: ScanResult, snapshot?: CompetitorSnapshot | null): void {
  const scan = result.scan_id ?? "audit";
  downloadCsvFile(`aislix-${scan}-brand-analysis.csv`, buildBrandAnalysisCombinedCsv(result, snapshot));
}
