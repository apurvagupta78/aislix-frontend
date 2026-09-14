/**
 * Client-side audit KPI fallback when stored metrics lack audit_kpi_dashboards
 * (e.g. scans processed before package synthesis shipped). Uses same formulas as backend.
 */

import {
  buildDemoPositionInventory,
  DEMO_ORAL_CARE_OBSERVATIONS,
  demoPriceComplianceLines,
  demoPromotionalCompliance,
  isDemoOralCareContext,
  isDemoOralCareResult,
} from "@/lib/demo-oral-care-planogram";
import { autoPopulateAuditPackage, type PlanogramAuditPackage } from "@/lib/planogram-audit-package";
import type { PlanogramRow } from "@/lib/planogram";
import { getRoleProfile, normalizeRoleId } from "@/lib/role-kpi-config";
import type { AuditKpiDashboard, AuditKpiResult } from "@/lib/retail-intelligence";
import type { ScanContextState } from "@/lib/scan-context";
import type { ScanResult } from "@/lib/scan-results";

/** Explicit planogram rows only — never treat detected inventory as a planogram. */
function planogramRowsFromResult(result?: ScanResult | null): PlanogramRow[] {
  const summary = result?.planogram?.summary as { configured_rows?: PlanogramRow[] } | undefined;
  return Array.isArray(summary?.configured_rows) ? summary.configured_rows : [];
}

function rowKey(row: PlanogramRow): string {
  return (
    String(row.sku ?? "").trim() ||
    String(row.match_key ?? "").trim().toLowerCase() ||
    `${String(row.brand ?? "").trim().toLowerCase()}|${String(row.product_name ?? "").trim().toLowerCase()}`
  );
}

function pct(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

function kpiResult(
  kpi_id: string,
  label: string,
  value: number | null,
  unit: "percent" | "count",
  numerator: number,
  denominator: number,
  eligible: number,
  status: AuditKpiResult["status"],
  formula: string,
  tooltip?: string,
): AuditKpiResult {
  const coverage = eligible > 0 ? pct(denominator, eligible) : null;
  return {
    kpi_id,
    label,
    value,
    unit,
    status,
    numerator,
    denominator,
    coverage_percent: coverage,
    coverage_numerator: denominator,
    coverage_denominator: eligible,
    excluded_count: Math.max(0, eligible - denominator),
    formula,
    formula_version: "audit-kpi-v1-client",
    scope: "client_recompute",
    tooltip: tooltip ?? "",
    warnings: [],
  };
}

function inventoryByKey(result: ScanResult, rows: PlanogramRow[], demoMode: boolean): Map<string, number> {
  if (demoMode) {
    const map = new Map<string, number>();
    for (const item of buildDemoPositionInventory(rows)) {
      const key = String(item.sku ?? rowKey({ ...item, product_name: item.product_name ?? "" } as PlanogramRow));
      map.set(key, (map.get(key) ?? 0) + (Number(item.quantity) || 0));
    }
    return map;
  }
  const map = new Map<string, number>();
  for (const item of result.inventory ?? []) {
    const key =
      String(item.sku ?? "").trim() ||
      String(item.match_key ?? "").trim().toLowerCase() ||
      `${String(item.brand ?? "").trim().toLowerCase()}|${String(item.name ?? item.product ?? "").trim().toLowerCase()}`;
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + (Number(item.facings) || Number(item.quantity) || 1));
  }
  return map;
}

function computeOsa(rows: PlanogramRow[], inv: Map<string, number>, summary: Record<string, unknown>): AuditKpiResult {
  const eligible = rows.length;
  if (!eligible) {
    return kpiResult("osa", "On-Shelf Availability (OSA)", null, "percent", 0, 0, 0, "not_configured", "(available / assessed) × 100");
  }
  const missing = Number(summary.missing ?? 0);
  const wrong = Number(summary.wrong_product ?? 0);
  if (summary.expected_sku_count != null) {
    const assessed = eligible;
    const available = Math.max(0, assessed - missing);
    return kpiResult(
      "osa",
      "On-Shelf Availability (OSA)",
      pct(available, assessed),
      "percent",
      available,
      assessed,
      eligible,
      "complete",
      "(Listed SKUs visibly available / Listed SKUs assessed) × 100",
      wrong > 0 ? `${wrong} position(s) with placement issues still count as available for OSA.` : undefined,
    );
  }
  let available = 0;
  for (const row of rows) {
    if ((inv.get(rowKey(row)) ?? 0) > 0) available += 1;
  }
  return kpiResult(
    "osa",
    "On-Shelf Availability (OSA)",
    pct(available, rows.length),
    "percent",
    available,
    rows.length,
    eligible,
    "complete",
    "(Listed SKUs visibly available / Listed SKUs assessed) × 100",
  );
}

function computePlanogram(rows: PlanogramRow[], summary: Record<string, unknown>): AuditKpiResult {
  if (!rows.length) {
    return kpiResult("planogram_compliance", "Planogram Compliance", null, "percent", 0, 0, 0, "not_configured", "(positions passing / assessed) × 100");
  }
  const expected = Number(summary.expected_sku_count ?? rows.length) || rows.length;
  const missing = Number(summary.missing ?? 0);
  const wrong = Number(summary.wrong_product ?? 0);
  const qtyShort = Number(summary.qty_short ?? 0);
  const passing = Math.max(0, expected - missing - wrong - qtyShort);
  const assessed = expected;
  return kpiResult(
    "planogram_compliance",
    "Planogram Compliance",
    pct(passing, assessed),
    "percent",
    passing,
    assessed,
    assessed,
    "complete",
    "(Positions passing layout checks / Required positions assessed) × 100",
  );
}

function computeAssortment(
  assortmentSkus: string[],
  rows: PlanogramRow[],
  inv: Map<string, number>,
): AuditKpiResult {
  const mandatory = assortmentSkus.filter(Boolean);
  const skus =
    mandatory.length > 0
      ? mandatory
      : [...new Set(rows.map((r) => rowKey(r)).filter(Boolean))];
  if (!skus.length) {
    return kpiResult("assortment_compliance", "Assortment Compliance", null, "percent", 0, 0, 0, "not_configured", "(present / assessed) × 100");
  }
  let present = 0;
  for (const sku of skus) {
    if ((inv.get(sku) ?? 0) > 0) present += 1;
  }
  return kpiResult(
    "assortment_compliance",
    "Assortment Compliance",
    pct(present, skus.length),
    "percent",
    present,
    skus.length,
    skus.length,
    "complete",
    "(Required assortment SKUs visibly present / assessed) × 100",
  );
}

function computeMsl(mslSkus: string[], inv: Map<string, number>): AuditKpiResult {
  if (!mslSkus.length) {
    return kpiResult("msl_compliance", "Must-Stock List (MSL) Compliance", null, "percent", 0, 0, 0, "not_configured", "(present / assessed) × 100");
  }
  let present = 0;
  for (const sku of mslSkus) {
    if ((inv.get(sku) ?? 0) > 0) present += 1;
  }
  return kpiResult(
    "msl_compliance",
    "Must-Stock List (MSL) Compliance",
    pct(present, mslSkus.length),
    "percent",
    present,
    mslSkus.length,
    mslSkus.length,
    "complete",
    "(Required MSL SKUs visibly present / assessed) × 100",
  );
}

function computePrice(rows: PlanogramRow[], demoMode: boolean, pkg: PlanogramAuditPackage): AuditKpiResult {
  if (demoMode) {
    const lines = demoPriceComplianceLines();
    const assessed = lines.length;
    if (!assessed) {
      return kpiResult("price_compliance", "Price Compliance", null, "percent", 0, 0, 0, "not_configured", "(labels passing / assessed) × 100");
    }
    const passing = lines.filter((l) => l.status === "compliant").length;
    return kpiResult(
      "price_compliance",
      "Price Compliance",
      pct(passing, assessed),
      "percent",
      passing,
      assessed,
      assessed,
      "complete",
      "(Required price-label positions meeting requirements / assessed) × 100",
      "Demo shelf price tags compared to configured demo planogram.",
    );
  }
  const withPrice =
    pkg.price_requirements.length ||
    rows.filter((r) => r.mrp_inr != null && Number.isFinite(Number(r.mrp_inr))).length;
  if (!withPrice) {
    return kpiResult("price_compliance", "Price Compliance", null, "percent", 0, 0, 0, "not_configured", "(labels passing / assessed) × 100");
  }
  return kpiResult(
    "price_compliance",
    "Price Compliance",
    null,
    "percent",
    0,
    Number(withPrice),
    Number(withPrice),
    "not_assessable",
    "(Required price-label positions meeting requirements / assessed) × 100",
    "Price requirements configured; label OCR evidence not re-run on client.",
  );
}

function computePromo(demoMode: boolean, promoCount: number): AuditKpiResult {
  if (promoCount <= 0) {
    return kpiResult("promotional_compliance", "Promotional Compliance", null, "percent", 0, 0, 0, "not_applicable", "(promotions passing / assessed) × 100");
  }
  if (demoMode) {
    const promo = demoPromotionalCompliance();
    const checks = [
      true,
      true,
      true,
      promo.passing,
      true,
    ];
    const passing = checks.filter(Boolean).length;
    const assessed = checks.length;
    return kpiResult(
      "promotional_compliance",
      "Promotional Compliance",
      pct(passing, assessed),
      "percent",
      passing,
      assessed,
      assessed,
      "complete",
      "(Active promotion checks passing / assessed) × 100",
      promo.detail,
    );
  }
  return kpiResult(
    "promotional_compliance",
    "Promotional Compliance",
    null,
    "percent",
    0,
    promoCount,
    promoCount,
    "not_assessable",
    "(Active promotions passing visual checks / assessed) × 100",
  );
}

function computeLocation(rows: PlanogramRow[], summary: Record<string, unknown>, demoMode: boolean): AuditKpiResult {
  const withPos = rows.filter((r) => String(r.shelf_position ?? "").trim());
  if (!withPos.length) {
    return kpiResult("location_accuracy", "Location Accuracy", null, "percent", 0, 0, 0, "not_configured", "(correct locations / assessed) × 100");
  }
  if (demoMode) {
    const wrong = Number(summary.wrong_product ?? 0);
    const passing = Math.max(0, withPos.length - wrong);
    return kpiResult(
      "location_accuracy",
      "Location Accuracy",
      pct(passing, withPos.length),
      "percent",
      passing,
      withPos.length,
      withPos.length,
      "complete",
      "(Occupied locations with approved SKUs / assessed) × 100",
    );
  }
  return kpiResult(
    "location_accuracy",
    "Location Accuracy",
    null,
    "percent",
    0,
    withPos.length,
    withPos.length,
    "not_assessable",
    "(Occupied locations with approved SKUs / assessed) × 100",
    "Requires planogram comparison lines from backend.",
  );
}

function computeFacing(rows: PlanogramRow[], inv: Map<string, number>, brand?: string, demoMode = false): AuditKpiResult {
  const scoped = brand
    ? rows.filter((r) => String(r.brand ?? "").toLowerCase() === brand.toLowerCase())
    : rows;
  if (!scoped.some((r) => r.expected_facings != null || r.expected_qty)) {
    return kpiResult("facing_count", "Facing Count", null, "count", 0, 0, 0, "not_configured", "Sum of visible front facings");
  }
  let actual = 0;
  let planned = 0;
  if (demoMode) {
    for (const row of scoped) {
      const obs = DEMO_ORAL_CARE_OBSERVATIONS[row.shelf_position];
      actual += obs?.facings ?? Number(row.expected_facings ?? row.expected_qty ?? 0);
      planned += Number(row.expected_facings ?? row.expected_qty ?? 0);
    }
  } else {
    for (const row of scoped) {
      actual += inv.get(rowKey(row)) ?? 0;
      planned += Number(row.expected_facings ?? row.expected_qty ?? 0);
    }
  }
  return kpiResult(
    "facing_count",
    "Facing Count",
    actual,
    "count",
    actual,
    planned || scoped.length,
    scoped.length,
    "complete",
    "Sum of visible front facings for assessed SKUs",
    planned ? `Planned ${planned} facings (${Math.round((actual / planned) * 100)}% of plan)` : undefined,
  );
}

function computeSos(result: ScanResult, brand?: string): AuditKpiResult {
  const share = result.summary?.brand_share_percent;
  if (!brand || share == null) {
    return kpiResult("share_of_shelf", "Share of Shelf (SOS)", null, "percent", 0, 0, 0, "not_configured", "(brand linear / category linear) × 100");
  }
  return kpiResult(
    "share_of_shelf",
    "Share of Shelf (SOS)",
    share,
    "percent",
    Math.round(share),
    100,
    100,
    "partial",
    "(Brand occupied linear shelf space / category total) × 100",
    "bbox_width_proxy unless geometry calibrated",
  );
}

function computeRoleDashboard(
  result: ScanResult,
  roleId: string,
  auditPackage?: PlanogramAuditPackage,
  ctx?: ScanContextState | ClientDashboardContext,
): AuditKpiDashboard {
  const profile = getRoleProfile(roleId);
  const rows = ctx?.planogramRows?.length
    ? ctx.planogramRows
    : planogramRowsFromResult(result);
  const summary = (result.planogram?.summary ?? {}) as Record<string, unknown>;
  const demoMode = ctx
    ? isDemoOralCareContext(ctx as ScanContextState) || isDemoOralCareResult(result)
    : isDemoOralCareResult(result);
  const inv = inventoryByKey(result, rows, demoMode);
  const pkg = autoPopulateAuditPackage(rows, auditPackage ?? ({} as any));
  const assortmentSkus = pkg.assortment_skus.filter((a) => !a.optional).map((a) => a.sku);
  const mslSkus = pkg.msl_skus.map((m) => m.sku);

  const calculators: Record<string, () => AuditKpiResult> = {
    osa: () => computeOsa(rows, inv, summary),
    planogram_compliance: () => computePlanogram(rows, summary),
    assortment_compliance: () => computeAssortment(assortmentSkus, rows, inv),
    price_compliance: () => computePrice(rows, demoMode, pkg),
    promotional_compliance: () => computePromo(demoMode, pkg.promotions.length),
    location_accuracy: () => computeLocation(rows, summary, demoMode),
    facing_count: () => computeFacing(rows, inv, roleId === "fmcg" ? pkg.primary_brand : undefined, demoMode),
    share_of_shelf: () => computeSos(result, pkg.primary_brand),
    msl_compliance: () => computeMsl(mslSkus, inv),
  };

  const primary_kpis = profile.primary_kpis.map((def) => {
    const calc = calculators[def.kpi_id];
    const kpi = calc ? calc() : kpiResult(def.kpi_id, def.label, null, "percent", 0, 0, 0, "not_configured", "");
    return { ...kpi, label: def.label, tooltip: def.tooltip };
  });

  return {
    role_id: profile.role_id,
    role_label: profile.label,
    introduction: profile.introduction,
    primary_kpis,
    kpi_count: primary_kpis.length,
    formula_version: "audit-kpi-v1-client",
    readiness: [],
  };
}

/** Recompute all five role dashboards from scan inventory + planogram rows. */
export function computeClientAuditDashboards(
  result?: ScanResult | null,
  auditPackage?: PlanogramAuditPackage,
  ctx?: ScanContextState,
): Partial<Record<string, AuditKpiDashboard>> {
  if (!result) return {};
  const roles = ["supermarket", "darkstore", "fmcg", "distributor", "local"] as const;
  const out: Partial<Record<string, AuditKpiDashboard>> = {};
  for (const role of roles) {
    out[role] = computeRoleDashboard(result, role, auditPackage, ctx);
  }
  return out;
}

export type ClientDashboardContext = Pick<
  ScanContextState,
  "auditRole" | "planogramRows" | "planogramMeta" | "auditPackage"
>;

export function clientDashboardForRole(
  result?: ScanResult | null,
  role?: string | null,
  auditPackage?: PlanogramAuditPackage,
  ctx?: ClientDashboardContext | ScanContextState,
): AuditKpiDashboard | undefined {
  if (!result) return undefined;
  const roleKey = normalizeRoleId(role);
  return computeRoleDashboard(result, roleKey, auditPackage, ctx as ScanContextState);
}
