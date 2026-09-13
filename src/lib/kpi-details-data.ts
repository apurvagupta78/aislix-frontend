/**
 * KPI details evidence rows — display/export only; does not alter KPI calculations.
 */

import {
  compareDemoOralCarePlanogram,
  DEMO_ORAL_CARE_OBSERVATIONS,
  demoPriceComplianceLines,
  demoPromotionalCompliance,
  isDemoOralCareResult,
} from "@/lib/demo-oral-care-planogram";
import {
  comparePlanogramToInventory,
  type PlanogramMatchLine,
  type PlanogramMatchResult,
} from "@/lib/demo-planogram-match";
import {
  auditKpiDashboardForRole,
  buildRoleKpiMetrics,
  planogramRowsFromResult,
  type KpiMetric,
} from "@/lib/execution-metrics";
import {
  autoPopulateAuditPackage,
  type PlanogramAuditPackage,
} from "@/lib/planogram-audit-package";
import type { PlanogramRow } from "@/lib/planogram";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import type { AuditKpiResult } from "@/lib/retail-intelligence";
import type { ScanResult } from "@/lib/scan-results";

export type PositionStatus = "correct" | "needs_review" | "incorrect";

export type ShelfPositionCell = {
  position_id: string;
  shelf: string;
  slot: string;
  expected_sku: string;
  expected_label: string;
  observed_label: string;
  status: PositionStatus;
  detail?: string;
  confidence?: string;
};

export type AssortmentRow = {
  sku: string;
  product_name: string;
  brand: string;
  required: boolean;
  present: boolean;
  status: "Present" | "Missing";
  shelf?: string;
  location?: string;
};

export type FacingSkuRow = {
  sku: string;
  product_name: string;
  brand: string;
  planned: number;
  actual: number;
  difference: number;
  shelf?: string;
};

export type PriceRow = {
  sku: string;
  product: string;
  expected_price: number;
  observed_price: number;
  difference: number;
  status: "Compliant" | "Mismatch" | "Not assessable";
};

export type PromoCheckRow = {
  check: string;
  status: "Compliant" | "Non-compliant" | "Not assessable";
};

export type KpiDetailsContext = {
  result: ScanResult;
  role: AuditRoleTab;
  demoMode: boolean;
  rows: PlanogramRow[];
  auditPackage: PlanogramAuditPackage;
  match: PlanogramMatchResult | null;
  metrics: Record<AuditKpiId, KpiMetric>;
  raw: Record<string, AuditKpiResult>;
  auditId: string;
  auditDate: string;
  store: string;
  fixture: string;
  category: string;
  subCategory: string;
  planogramVersion: string;
};

function rowLabel(row: PlanogramRow): string {
  return `${row.brand} ${row.product_name}`.trim();
}

function parseShelfPosition(pos: string): { shelf: string; slot: string } {
  const parts = String(pos ?? "").split("-");
  return { shelf: parts[0] ?? pos, slot: parts[1] ?? "" };
}

function issueToLocationStatus(line: PlanogramMatchLine): PositionStatus {
  if (line.issue_type === "correct") return "correct";
  if (line.issue_type === "missing" && (line.detected_qty ?? 0) === 0) return "incorrect";
  if (line.issue_type === "wrong_product") return "incorrect";
  if (line.issue_type === "qty_mismatch") return "needs_review";
  if (line.detail?.toLowerCase().includes("not clearly visible")) return "needs_review";
  return "needs_review";
}

function issueToPlanogramStatus(line: PlanogramMatchLine): PositionStatus {
  if (line.issue_type === "correct") return "correct";
  if (line.issue_type === "missing" || line.issue_type === "wrong_product") return "incorrect";
  return "needs_review";
}

function resolveMatch(result: ScanResult, rows: PlanogramRow[], demoMode: boolean): PlanogramMatchResult | null {
  if (!rows.length) return null;
  if (demoMode) return compareDemoOralCarePlanogram(rows);
  const inventory = result.inventory ?? [];
  if (!inventory.length) return null;
  return comparePlanogramToInventory(inventory, rows);
}

function rawKpiMap(result: ScanResult, role: AuditRoleTab): Record<string, AuditKpiResult> {
  const dash = auditKpiDashboardForRole(result, role);
  const map: Record<string, AuditKpiResult> = {};
  for (const k of dash?.primary_kpis ?? []) {
    map[k.kpi_id] = k;
  }
  return map;
}

export function buildKpiDetailsContext(result: ScanResult, role: AuditRoleTab): KpiDetailsContext {
  const demoMode =
    isDemoOralCareResult(result) || result.retail_intelligence?.demo_oral_care === true;
  const rows = planogramRowsFromResult(result);
  const auditPackage = autoPopulateAuditPackage(
    rows,
    result.retail_intelligence?.audit_package as PlanogramAuditPackage | undefined,
  );
  const match = resolveMatch(result, rows, demoMode);
  const metricsList = buildRoleKpiMetrics(result, role);
  const metrics = Object.fromEntries(metricsList.map((m) => [m.key, m])) as Record<
    AuditKpiId,
    KpiMetric
  >;
  const meta = result.planogram?.summary as { version?: string } | undefined;
  return {
    result,
    role,
    demoMode,
    rows,
    auditPackage,
    match,
    metrics,
    raw: rawKpiMap(result, role),
    auditId: result.location ?? result.scan_id ?? "",
    auditDate: result.created_at ?? "",
    store: result.store ?? auditPackage.fixture_id ?? "",
    fixture: rows[0]?.location ?? auditPackage.fixture_id ?? "",
    category: result.scan_category ?? rows[0]?.category ?? "",
    subCategory: result.scan_sub_category ?? rows[0]?.sub_category ?? "",
    planogramVersion: meta?.version ?? "v1",
  };
}

export function buildOsaEvidence(ctx: KpiDetailsContext): {
  available: number;
  assessed: number;
  rows: Array<{ sku: string; product: string; available: boolean; shelf: string }>;
} {
  const lines = ctx.match?.lines ?? [];
  if (lines.length) {
    const rows = lines.map((line) => ({
      sku: line.expected.sku,
      product: rowLabel(line.expected),
      available: line.present && line.issue_type !== "missing",
      shelf: line.expected.shelf_position,
    }));
    const available = rows.filter((r) => r.available).length;
    return { available, assessed: rows.length, rows };
  }
  const kpi = ctx.raw.osa;
  const available = kpi?.numerator ?? 0;
  const assessed = kpi?.denominator ?? ctx.rows.length;
  const rows = ctx.rows.map((row) => ({
    sku: row.sku,
    product: rowLabel(row),
    available: true,
    shelf: row.shelf_position,
  }));
  return { available, assessed, rows };
}

export function buildLocationCells(ctx: KpiDetailsContext): ShelfPositionCell[] {
  const lines = ctx.match?.lines ?? [];
  if (!lines.length) {
    return ctx.rows
      .filter((r) => String(r.shelf_position ?? "").trim())
      .map((row) => ({
        position_id: row.shelf_position,
        ...parseShelfPosition(row.shelf_position),
        expected_sku: row.sku,
        expected_label: rowLabel(row),
        observed_label: rowLabel(row),
        status: "correct" as PositionStatus,
      }));
  }
  return lines.map((line) => {
    const { shelf, slot } = parseShelfPosition(line.expected.shelf_position);
    const obs = ctx.demoMode ? DEMO_ORAL_CARE_OBSERVATIONS[line.expected.shelf_position] : undefined;
    let observed = line.present ? rowLabel(line.expected) : "—";
    if (obs?.observed_shelf) {
      observed = `${rowLabel(line.expected)} (observed ${obs.observed_shelf})`;
    }
    if (line.issue_type === "wrong_product") {
      observed = line.detail?.includes("Shelf 2") ? "Colgate Herbal (observed S2)" : observed;
    }
    return {
      position_id: line.expected.shelf_position,
      shelf,
      slot,
      expected_sku: line.expected.sku,
      expected_label: rowLabel(line.expected),
      observed_label: observed,
      status: issueToLocationStatus(line),
      detail: line.detail,
      confidence: line.present ? "High" : "Low",
    };
  });
}

export function buildPlanogramCells(ctx: KpiDetailsContext): ShelfPositionCell[] {
  return buildLocationCells(ctx).map((cell, i) => {
    const line = ctx.match?.lines[i];
    if (!line) return cell;
    return {
      ...cell,
      status: issueToPlanogramStatus(line),
    };
  });
}

export function buildAssortmentRows(ctx: KpiDetailsContext): AssortmentRow[] {
  const mandatory =
    ctx.auditPackage.assortment_skus.filter((a) => !a.optional).map((a) => a.sku) ?? [];
  const skuSet = mandatory.length
    ? mandatory
    : [...new Set(ctx.rows.map((r) => r.sku).filter(Boolean))];
  const inv = new Map<string, number>();
  for (const item of ctx.result.inventory ?? []) {
    const key = String(item.sku ?? "").trim();
    if (!key) continue;
    inv.set(key, (inv.get(key) ?? 0) + (Number(item.facings) || Number(item.quantity) || 1));
  }
  if (ctx.demoMode) {
    for (const row of ctx.rows) {
      const obs = DEMO_ORAL_CARE_OBSERVATIONS[row.shelf_position];
      if (obs && obs.facings > 0) inv.set(row.sku, (inv.get(row.sku) ?? 0) + obs.facings);
    }
  }
  const rowBySku = Object.fromEntries(ctx.rows.map((r) => [r.sku, r]));
  return skuSet.map((sku) => {
    const row = rowBySku[sku];
    const present = (inv.get(sku) ?? 0) > 0;
    return {
      sku,
      product_name: row ? row.product_name : sku,
      brand: row?.brand ?? "",
      required: true,
      present,
      status: present ? "Present" : "Missing",
      shelf: row?.expected_shelf_level ?? parseShelfPosition(row?.shelf_position ?? "").shelf,
      location: row?.shelf_position,
    };
  });
}

export function buildMslRows(ctx: KpiDetailsContext): AssortmentRow[] {
  const mslSkus = ctx.auditPackage.msl_skus.map((m) => m.sku).filter(Boolean);
  if (!mslSkus.length) return buildAssortmentRows(ctx);
  const base = buildAssortmentRows(ctx);
  const bySku = Object.fromEntries(base.map((r) => [r.sku, r]));
  return mslSkus.map((sku) => bySku[sku] ?? {
    sku,
    product_name: sku,
    brand: "",
    required: true,
    present: false,
    status: "Missing" as const,
  });
}

export function buildFacingSkuRows(ctx: KpiDetailsContext, brand?: string): FacingSkuRow[] {
  const scoped = brand
    ? ctx.rows.filter((r) => String(r.brand ?? "").toLowerCase() === brand.toLowerCase())
    : ctx.rows;
  const bySku = new Map<string, FacingSkuRow>();
  for (const row of scoped) {
    const planned = Number(row.expected_facings ?? row.expected_qty ?? 0);
    let actual = 0;
    if (ctx.demoMode) {
      actual = DEMO_ORAL_CARE_OBSERVATIONS[row.shelf_position]?.facings ?? 0;
    } else {
      const inv = ctx.result.inventory?.find((i) => i.sku === row.sku);
      actual = Number(inv?.facings ?? inv?.quantity ?? 0);
    }
    const existing = bySku.get(row.sku);
    if (existing) {
      existing.planned += planned;
      existing.actual += actual;
      existing.difference = existing.actual - existing.planned;
    } else {
      bySku.set(row.sku, {
        sku: row.sku,
        product_name: row.product_name,
        brand: row.brand,
        planned,
        actual,
        difference: actual - planned,
        shelf: parseShelfPosition(row.shelf_position).shelf,
      });
    }
  }
  return [...bySku.values()].sort((a, b) => b.planned - a.planned);
}

export function buildPriceRows(ctx: KpiDetailsContext): PriceRow[] {
  if (ctx.demoMode) {
    return demoPriceComplianceLines().map((line) => ({
      sku: line.sku,
      product: line.product,
      expected_price: line.expected_price,
      observed_price: line.observed_price,
      difference: line.observed_price - line.expected_price,
      status: line.status === "compliant" ? "Compliant" : "Mismatch",
    }));
  }
  return ctx.auditPackage.price_requirements.slice(0, 12).map((req) => ({
    sku: req.sku ?? "",
    product: req.sku ?? "",
    expected_price: Number(req.expected_price ?? 0),
    observed_price: 0,
    difference: 0,
    status: "Not assessable" as const,
  }));
}

export function buildPromoChecks(ctx: KpiDetailsContext): PromoCheckRow[] {
  if (ctx.demoMode && ctx.auditPackage.promotions.length) {
    const promo = demoPromotionalCompliance();
    const checks: PromoCheckRow[] = [
      { check: "Correct product", status: "Compliant" },
      { check: "Correct location", status: "Compliant" },
      { check: "Correct offer", status: "Compliant" },
      {
        check: "Correct promotional price",
        status: promo.passing ? "Compliant" : "Non-compliant",
      },
      { check: "Required signage", status: "Compliant" },
      { check: "Required facings", status: "Compliant" },
    ];
    return checks;
  }
  if (!ctx.auditPackage.promotions.length) return [];
  return [
    { check: "Promotion configured", status: "Not assessable" },
  ];
}

export function shelvesFromCells(cells: ShelfPositionCell[]): string[] {
  return [...new Set(cells.map((c) => c.shelf).filter(Boolean))].sort();
}
