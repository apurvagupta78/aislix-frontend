/**
 * Commercial impact CSV export — inputs and outputs per SKU.
 */

import {
  buildCommercialImpactView,
  buildSkuExposureRows,
  commercialImpactMeta,
} from "@/lib/commercial-impact-display";
import { downloadCsvFile } from "@/lib/kpi-details-csv";
import { planogramRowsFromResult } from "@/lib/execution-metrics";
import { comparePlanogramToInventory, type InventoryFacing } from "@/lib/demo-planogram-match";
import {
  compareDemoOralCarePlanogram,
  isDemoOralCareResult,
} from "@/lib/demo-oral-care-planogram";
import type { ScanResult } from "@/lib/scan-results";
import { resolveFinancialImpact } from "@/lib/scan-execution";

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

function resolveMatch(result: ScanResult) {
  const rows = planogramRowsFromResult(result);
  if (!rows.length) return null;
  const demoMode =
    isDemoOralCareResult(result) || result.retail_intelligence?.demo_oral_care === true;
  if (demoMode) return compareDemoOralCarePlanogram(rows);
  const inventory = result.inventory ?? [];
  if (!inventory.length) return null;
  return comparePlanogramToInventory(inventory as InventoryFacing[], rows);
}

export function buildCommercialImpactCsv(result: ScanResult): string {
  const meta = commercialImpactMeta(result);
  const view = buildCommercialImpactView(result);
  const impact = view?.impact ?? resolveFinancialImpact(result);
  const skuRows = buildSkuExposureRows(result);
  const match = resolveMatch(result);
  const lines: string[] = [
    "# Aislix Commercial Impact Export",
    row(["Audit ID", meta.audit_id]),
    row(["Audit Date", formatTimestamp(meta.audit_date)]),
    row(["Store", meta.store]),
    row(["Fixture", meta.fixture]),
    row(["Role", meta.role]),
    row(["Category", meta.category]),
    row(["Sub-category", meta.sub_category]),
    row(["Planogram Version", meta.planogram_version]),
    row(["Calculation Timestamp", formatTimestamp(meta.audit_date)]),
    row(["Estimate Status", view?.estimate_status ?? ""]),
    row(["Daily Exposure Total", impact?.estimated_daily_lost_sales_inr ?? ""]),
    row(["7-Day Exposure Total", impact?.estimated_weekly_lost_sales_inr ?? ""]),
    row(["30-Day Exposure Total", impact?.estimated_monthly_lost_sales_inr ?? ""]),
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
      "Calculation Timestamp",
      "SKU",
      "Product Name",
      "Brand",
      "Issue Type",
      "Issue Severity",
      "Shelf",
      "Location",
      "Observed Availability",
      "Observed Facings",
      "Planned Facings",
      "OOS Status",
      "At-Risk Status",
      "Evidence Reference",
      "Daily Sales Units",
      "Selling Price",
      "Currency",
      "Daily Exposure",
      "7-Day Exposure",
      "30-Day Exposure",
      "Estimate Basis",
      "Assumption Source",
      "Estimate Status",
      "Result Status",
      "Coverage",
    ]),
  ];

  if (!skuRows.length && impact) {
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
        formatTimestamp(meta.audit_date),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        impact.oos_sku_count > 0 ? "Yes" : "No",
        impact.at_risk_sku_count > 0 ? "Yes" : "No",
        result.scan_id ?? meta.audit_id,
        "",
        "",
        "INR",
        impact.estimated_daily_lost_sales_inr,
        impact.estimated_weekly_lost_sales_inr,
        impact.estimated_monthly_lost_sales_inr,
        impact.methodology,
        impact.source ?? "",
        view?.estimate_status ?? "",
        "Complete",
        "100%",
      ]),
    );
  }

  for (const sku of skuRows) {
    const line = match?.lines.find(
      (l) => l.expected.brand === sku.brand && l.expected.product_name === sku.product,
    );
    const isOos = sku.issue_type === "missing" || sku.issue_type === "wrong_product";
    const daily = sku.daily_loss_inr;
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
        formatTimestamp(meta.audit_date),
        sku.sku ?? "",
        sku.product,
        sku.brand,
        sku.issue_type,
        isOos ? "critical" : "warning",
        sku.shelf_position?.split("-")[0] ?? "",
        sku.shelf_position ?? "",
        line?.present ? "Visible" : "Not confirmed",
        line?.detected_qty ?? "",
        line?.expected_qty ?? "",
        isOos ? "Yes" : "No",
        !isOos && sku.gap_units > 0 ? "Yes" : "No",
        `${result.scan_id ?? meta.audit_id}:${sku.sku ?? sku.product}`,
        sku.daily_sales_units ?? "",
        sku.selling_price ?? "",
        "INR",
        daily,
        daily * 7,
        daily * 30,
        "Daily sales units × selling price",
        impact?.source ?? "",
        view?.estimate_status ?? "",
        "Complete",
        "100%",
      ]),
    );
  }

  return lines.join("\n");
}

export function downloadCommercialImpactCsv(result: ScanResult): void {
  const scan = result.scan_id ?? "audit";
  downloadCsvFile(`aislix-${scan}-commercial-impact.csv`, buildCommercialImpactCsv(result));
}
