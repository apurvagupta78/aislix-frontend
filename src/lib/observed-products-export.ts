/**
 * Observed shelf products CSV export — inputs and outputs per detected SKU group.
 */

import {
  enrichObservedProductRows,
  observedProductsMeta,
  type ObservedProductRow,
  type ObservedProductStatus,
} from "@/lib/observed-products-display";
import { downloadCsvFile } from "@/lib/kpi-details-csv";
import { planogramRowsFromResult } from "@/lib/execution-metrics";
import type { InventoryItem, ScanResult } from "@/lib/scan-results";
import { inventorySkuKey, normalizeConfidence } from "@/lib/scan-results";

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

function avgOcrConfidence(result: ScanResult, item: InventoryItem): number | "" {
  const facings = result.facings ?? [];
  if (!facings.length) return "";
  const matches = facings.filter(
    (f) =>
      f.brand.trim().toLowerCase() === item.brand.trim().toLowerCase() &&
      f.product.trim().toLowerCase() === item.product.trim().toLowerCase(),
  );
  if (!matches.length) return "";
  const sum = matches.reduce(
    (n, f) => n + normalizeConfidence(f.ocr_confidence ?? f.confidence ?? 0),
    0,
  );
  return Math.round((sum / matches.length) * 10) / 10;
}

function planogramStatus(status: ObservedProductStatus): string {
  if (status === "Matched") return "Matched";
  if (status === "Needs Review") return "Needs review";
  if (status === "Not Assessed") return "Not assessed";
  return "";
}

function reviewStatus(status: ObservedProductStatus): string {
  if (status === "Needs Review") return "Needs review";
  if (status === "Unknown") return "Unknown";
  return status === "Matched" ? "Confirmed" : "";
}

function issueType(item: ObservedProductRow, status: ObservedProductStatus): string {
  if (item.compliance_status === "category_mismatch") return "category_mismatch";
  if (status === "Needs Review") return item.match_line?.issue_type ?? "needs_review";
  return item.match_line?.issue_type ?? "";
}

export function buildObservedProductsCsv(result: ScanResult, items?: InventoryItem[]): string {
  const meta = observedProductsMeta(result);
  const source = items ?? result.inventory ?? [];
  const enriched = enrichObservedProductRows(result, source);
  const planRows = planogramRowsFromResult(result);
  const planByProduct = new Map(
    planRows.map((p) => [`${p.brand}|${p.product_name}`.toLowerCase(), p]),
  );

  const lines: string[] = [
    "# Aislix Observed Products Export",
    row(["Audit ID", meta.audit_id]),
    row(["Audit Date", formatTimestamp(meta.audit_date)]),
    row(["Store", meta.store]),
    row(["Fixture", meta.fixture]),
    row(["Role", meta.role]),
    row(["Category", meta.category]),
    row(["Sub-category", meta.sub_category]),
    row(["Planogram Version", meta.planogram_version]),
    row(["Image ID", meta.image_id]),
    row(["Capture Timestamp", formatTimestamp(meta.audit_date)]),
    "",
    row([
      "Audit ID",
      "Audit Date",
      "Store",
      "Fixture",
      "Role",
      "Category",
      "Sub-category",
      "Planogram Version",
      "Image ID",
      "Brand",
      "SKU",
      "Product Name",
      "Variant",
      "Observed Facings",
      "Shelf",
      "Location",
      "Detection Confidence",
      "OCR Confidence",
      "Product Status",
      "Expected SKU",
      "Expected Location",
      "Planogram Status",
      "Review Status",
      "Issue Type",
      "Evidence Image Reference",
      "Capture Timestamp",
    ]),
  ];

  for (const item of enriched) {
    const plan =
      planByProduct.get(`${item.brand}|${item.product}`.toLowerCase()) ??
      item.match_line?.expected;
    lines.push(
      row([
        meta.audit_id,
        formatTimestamp(meta.audit_date),
        meta.store,
        meta.fixture,
        meta.role,
        meta.category,
        meta.sub_category,
        meta.planogram_version,
        meta.image_id,
        item.brand,
        plan?.sku ?? inventorySkuKey(item),
        item.product,
        item.variant ?? "",
        item.quantity,
        item.shelf_label === "—" ? "" : item.shelf_label,
        item.location_label === "—" ? "" : item.location_label,
        normalizeConfidence(item.confidence).toFixed(1),
        avgOcrConfidence(result, item),
        item.status,
        plan?.sku ?? "",
        plan?.shelf_position ?? "",
        planogramStatus(item.status),
        reviewStatus(item.status),
        issueType(item, item.status),
        `${meta.image_id}:${inventorySkuKey(item)}`,
        formatTimestamp(meta.audit_date),
      ]),
    );
  }

  return lines.join("\n");
}

export function downloadObservedProductsCsv(result: ScanResult, items?: InventoryItem[]): void {
  const scan = result.scan_id ?? "audit";
  downloadCsvFile(`aislix-${scan}-observed-products.csv`, buildObservedProductsCsv(result, items));
}
