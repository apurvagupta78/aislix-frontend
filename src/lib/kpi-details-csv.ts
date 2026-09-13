/**
 * Per-KPI CSV export for the KPI details section — evidence rows only.
 */

import type { AuditKpiId } from "@/lib/role-kpi-config";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import { KPI_DISPLAY_LABEL, scoringFromResult } from "@/lib/kpi-results-display";
import type { ScoringTargets } from "@/lib/planogram-audit-package";

const KPI_TARGET_KEY: Partial<Record<AuditKpiId, keyof ScoringTargets>> = {
  osa: "osa_target",
  planogram_compliance: "planogram_target",
  assortment_compliance: "assortment_target",
  price_compliance: "price_target",
  promotional_compliance: "promotional_target",
  msl_compliance: "msl_target",
  share_of_shelf: "share_of_shelf_target",
};
import type { AuditKpiResult } from "@/lib/retail-intelligence";
import {
  buildAssortmentRows,
  buildFacingSkuRows,
  buildKpiDetailsContext,
  buildLocationCells,
  buildMslRows,
  buildOsaEvidence,
  buildPlanogramCells,
  buildPriceRows,
  buildPromoChecks,
  type KpiDetailsContext,
} from "@/lib/kpi-details-data";
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

function commonHeader(ctx: KpiDetailsContext, kpiId: AuditKpiId, raw?: AuditKpiResult): string[] {
  const metric = ctx.metrics[kpiId];
  const targetKey = KPI_TARGET_KEY[kpiId];
  const scoring = scoringFromResult(ctx.result);
  const target = targetKey ? scoring[targetKey] : undefined;
  const lines: string[] = [
    "# Aislix KPI Export",
    row(["Audit ID", ctx.auditId]),
    row(["Audit Date", formatTimestamp(ctx.auditDate)]),
    row(["Store", ctx.store]),
    row(["Fixture", ctx.fixture]),
    row(["Role", ctx.role]),
    row(["Category", ctx.category]),
    row(["Sub-category", ctx.subCategory]),
    row(["Planogram Version", ctx.planogramVersion]),
    row(["KPI", KPI_DISPLAY_LABEL[kpiId] ?? kpiId]),
    row(["Result", metric?.value ?? ""]),
    row(["Numerator", raw?.numerator ?? metric?.numerator ?? ""]),
    row(["Denominator", raw?.denominator ?? metric?.denominator ?? ""]),
    row(["Coverage", metric?.coverage_percent != null ? `${Math.round(metric.coverage_percent)}%` : ""]),
    row(["Result Status", metric?.audit_status ?? raw?.status ?? ""]),
    row(["Target", target != null ? `${target}%` : ""]),
    row(["Calculation Timestamp", formatTimestamp(ctx.auditDate)]),
    "",
  ];
  return lines;
}

function buildOsaCsv(ctx: KpiDetailsContext): string {
  const raw = ctx.raw.osa;
  const evidence = buildOsaEvidence(ctx);
  const lines = [
    ...commonHeader(ctx, "osa", raw),
    row([
      "Audit ID",
      "Store",
      "Fixture",
      "Shelf",
      "SKU",
      "Product Name",
      "Brand",
      "Available",
      "Status",
      "Confidence",
      "Evidence Reference",
    ]),
  ];
  for (const r of evidence.rows) {
    const planRow = ctx.rows.find((p) => p.sku === r.sku);
    lines.push(
      row([
        ctx.auditId,
        ctx.store,
        ctx.fixture,
        r.shelf,
        r.sku,
        planRow?.product_name ?? r.product,
        planRow?.brand ?? "",
        r.available ? "Yes" : "No",
        r.available ? "Available" : "Missing",
        r.available ? "High" : "Low",
        `${ctx.result.scan_id ?? ctx.auditId}:${r.sku}`,
      ]),
    );
  }
  return lines.join("\n");
}

function buildLocationCsv(ctx: KpiDetailsContext): string {
  const raw = ctx.raw.location_accuracy;
  const cells = buildLocationCells(ctx);
  const lines = [
    ...commonHeader(ctx, "location_accuracy", raw),
    row([
      "Audit ID",
      "Store",
      "Fixture",
      "Shelf",
      "Location ID",
      "Expected SKU",
      "Observed SKU",
      "Location Status",
      "Confidence",
      "Issue",
      "Evidence Reference",
    ]),
  ];
  for (const c of cells) {
    const statusLabel =
      c.status === "correct" ? "Correct" : c.status === "incorrect" ? "Incorrect" : "Needs review";
    lines.push(
      row([
        ctx.auditId,
        ctx.store,
        ctx.fixture,
        c.shelf,
        c.position_id,
        c.expected_sku,
        c.observed_label,
        statusLabel,
        c.confidence ?? "",
        c.detail ?? "",
        `${ctx.result.scan_id ?? ctx.auditId}:${c.position_id}`,
      ]),
    );
  }
  return lines.join("\n");
}

function buildPlanogramCsv(ctx: KpiDetailsContext): string {
  const raw = ctx.raw.planogram_compliance;
  const cells = buildPlanogramCells(ctx);
  const lines = [
    ...commonHeader(ctx, "planogram_compliance", raw),
    row([
      "Audit ID",
      "Store",
      "Fixture",
      "Shelf",
      "Position ID",
      "Expected SKU",
      "Observed SKU",
      "Expected Orientation",
      "Observed Orientation",
      "Planned Facings",
      "Observed Facings",
      "Position Status",
      "Issue",
      "Confidence",
      "Evidence Reference",
    ]),
  ];
  for (const c of cells) {
    const line = ctx.match?.lines.find((l) => l.expected.shelf_position === c.position_id);
    const statusLabel =
      c.status === "correct" ? "Match" : c.status === "incorrect" ? "Mismatch" : "Needs review";
    lines.push(
      row([
        ctx.auditId,
        ctx.store,
        ctx.fixture,
        c.shelf,
        c.position_id,
        c.expected_sku,
        c.observed_label,
        line?.expected.expected_position ?? "Front",
        "Front",
        line?.expected_qty ?? "",
        line?.detected_qty ?? "",
        statusLabel,
        c.detail ?? "",
        c.confidence ?? "",
        `${ctx.result.scan_id ?? ctx.auditId}:${c.position_id}`,
      ]),
    );
  }
  return lines.join("\n");
}

function buildAssortmentCsv(ctx: KpiDetailsContext, kpiId: "assortment_compliance" | "msl_compliance"): string {
  const raw = ctx.raw[kpiId];
  const rows = kpiId === "msl_compliance" ? buildMslRows(ctx) : buildAssortmentRows(ctx);
  const lines = [
    ...commonHeader(ctx, kpiId, raw),
    row([
      "Audit ID",
      "Store",
      "SKU",
      "Product Name",
      "Brand",
      "Required",
      "Present",
      "Status",
      "Shelf",
      "Location",
      "Confidence",
      "Evidence Reference",
    ]),
  ];
  for (const r of rows) {
    lines.push(
      row([
        ctx.auditId,
        ctx.store,
        r.sku,
        r.product_name,
        r.brand,
        r.required ? "Yes" : "No",
        r.present ? "Yes" : "No",
        r.status,
        r.shelf ?? "",
        r.location ?? "",
        r.present ? "High" : "Low",
        `${ctx.result.scan_id ?? ctx.auditId}:${r.sku}`,
      ]),
    );
  }
  return lines.join("\n");
}

function buildFacingCsv(ctx: KpiDetailsContext): string {
  const raw = ctx.raw.facing_count;
  const brand =
    ctx.role === "fmcg" ? ctx.auditPackage.primary_brand : undefined;
  const rows = buildFacingSkuRows(ctx, brand);
  const coverage = raw?.coverage_percent ?? ctx.metrics.facing_count?.coverage_percent;
  const lines = [
    ...commonHeader(ctx, "facing_count", raw),
    row([
      "Audit ID",
      "Store",
      "Fixture",
      "Shelf",
      "SKU",
      "Product Name",
      "Brand",
      "Planned Facings",
      "Observed Facings",
      "Difference",
      "Facing Status",
      "Coverage",
      "Confidence",
      "Evidence Reference",
    ]),
  ];
  for (const r of rows) {
    const status =
      r.actual >= r.planned ? "Complete" : r.actual > 0 ? "Partial" : "Missing";
    lines.push(
      row([
        ctx.auditId,
        ctx.store,
        ctx.fixture,
        r.shelf ?? "",
        r.sku,
        r.product_name,
        r.brand,
        r.planned,
        r.actual,
        r.difference,
        status,
        coverage != null ? `${Math.round(coverage)}%` : "",
        r.actual > 0 ? "High" : "Low",
        `${ctx.result.scan_id ?? ctx.auditId}:${r.sku}`,
      ]),
    );
  }
  return lines.join("\n");
}

function buildPriceCsv(ctx: KpiDetailsContext): string {
  const raw = ctx.raw.price_compliance;
  const rows = buildPriceRows(ctx);
  const lines = [
    ...commonHeader(ctx, "price_compliance", raw),
    row(["SKU", "Product", "Expected Price", "Observed Price", "Difference", "Status"]),
  ];
  for (const r of rows) {
    lines.push(row([r.sku, r.product, r.expected_price, r.observed_price, r.difference, r.status]));
  }
  return lines.join("\n");
}

function buildPromoCsv(ctx: KpiDetailsContext): string {
  const raw = ctx.raw.promotional_compliance;
  const checks = buildPromoChecks(ctx);
  const lines = [
    ...commonHeader(ctx, "promotional_compliance", raw),
    row(["Check", "Status"]),
  ];
  for (const c of checks) {
    lines.push(row([c.check, c.status]));
  }
  return lines.join("\n");
}

function buildSosCsv(ctx: KpiDetailsContext): string {
  const raw = ctx.raw.share_of_shelf;
  const brands = ctx.result.charts?.top_brands ?? [];
  const lines = [
    ...commonHeader(ctx, "share_of_shelf", raw),
    row(["Brand", "Share Percent", "Scope"]),
  ];
  for (const b of brands) {
    lines.push(row([b.brand, b.share, "Category facings"]));
  }
  return lines.join("\n");
}

const BUILDERS: Partial<Record<AuditKpiId, (ctx: KpiDetailsContext) => string>> = {
  osa: buildOsaCsv,
  location_accuracy: buildLocationCsv,
  planogram_compliance: buildPlanogramCsv,
  assortment_compliance: (ctx) => buildAssortmentCsv(ctx, "assortment_compliance"),
  msl_compliance: (ctx) => buildAssortmentCsv(ctx, "msl_compliance"),
  facing_count: buildFacingCsv,
  price_compliance: buildPriceCsv,
  promotional_compliance: buildPromoCsv,
  share_of_shelf: buildSosCsv,
};

export function buildKpiDetailCsv(
  result: ScanResult,
  role: AuditRoleTab,
  kpiId: AuditKpiId,
): string {
  const ctx = buildKpiDetailsContext(result, role);
  const builder = BUILDERS[kpiId];
  if (!builder) return commonHeader(ctx, kpiId, ctx.raw[kpiId]).join("\n");
  return builder(ctx);
}

export function buildAllKpiDetailsCsv(result: ScanResult, role: AuditRoleTab, kpiIds: AuditKpiId[]): string {
  const sections = kpiIds.map((id) => {
    const body = buildKpiDetailCsv(result, role, id);
    return `# --- ${KPI_DISPLAY_LABEL[id] ?? id} ---\n${body}`;
  });
  return sections.join("\n\n");
}

export function downloadCsvFile(filename: string, content: string): void {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadKpiCsv(
  result: ScanResult,
  role: AuditRoleTab,
  kpiId: AuditKpiId,
): void {
  const slug = kpiId.replace(/_/g, "-");
  const scan = result.scan_id ?? "audit";
  downloadCsvFile(`aislix-${scan}-${slug}.csv`, buildKpiDetailCsv(result, role, kpiId));
}

export function downloadAllKpiCsv(
  result: ScanResult,
  role: AuditRoleTab,
  kpiIds: AuditKpiId[],
): void {
  const scan = result.scan_id ?? "audit";
  downloadCsvFile(
    `aislix-${scan}-all-kpi-data.csv`,
    buildAllKpiDetailsCsv(result, role, kpiIds),
  );
}
