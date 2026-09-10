/**
 * Optional scan focus (company / brand / product) and planogram pricing
 * used to filter results and compute financial impact.
 */

import type { FinancialImpact, ScanResult } from "@/lib/scan-results";
import type { PlanogramRow } from "@/lib/planogram";

export type ScanFocusFilter = {
  company?: string;
  brand?: string;
  product?: string;
};

export type ScanContextState = {
  focus: ScanFocusFilter;
  planogramRows: PlanogramRow[];
};

export const EMPTY_SCAN_CONTEXT: ScanContextState = {
  focus: {},
  planogramRows: [],
};

const STORAGE_KEY = "aislix_scan_context";

export function loadStoredScanContext(): ScanContextState {
  if (typeof sessionStorage === "undefined") return EMPTY_SCAN_CONTEXT;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SCAN_CONTEXT;
    const parsed = JSON.parse(raw) as ScanContextState;
    return {
      focus: parsed.focus ?? {},
      planogramRows: Array.isArray(parsed.planogramRows) ? parsed.planogramRows : [],
    };
  } catch {
    return EMPTY_SCAN_CONTEXT;
  }
}

export function saveStoredScanContext(ctx: ScanContextState): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    // ignore quota errors
  }
}

const DEFAULT_ASP_INR = 75;
const DEFAULT_UNITS_PER_DAY = 4;
const LOW_STOCK_RISK = 0.35;

function norm(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function rowBrand(row: { brand?: string | null }): string {
  return norm(row.brand);
}

function rowProduct(row: { product?: string | null; product_name?: string | null }): string {
  return norm(row.product ?? row.product_name);
}

/** True when a row matches the optional company / brand / product focus. */
export function matchesScanFocus(
  row: { brand?: string | null; product?: string | null; product_name?: string | null },
  focus: ScanFocusFilter,
): boolean {
  const company = norm(focus.company);
  const brand = norm(focus.brand);
  const product = norm(focus.product);
  if (!company && !brand && !product) return true;

  const b = rowBrand(row);
  const p = rowProduct(row);

  if (brand && !b.includes(brand)) return false;
  if (product && !p.includes(product)) return false;
  if (company && !b.includes(company) && !p.includes(company)) return false;
  return true;
}

function planogramKey(row: {
  brand?: string;
  product_name?: string;
  product?: string;
  variant?: string;
  match_key?: string;
}): string {
  if (row.match_key) return row.match_key.toLowerCase();
  return [norm(row.brand), norm(row.product_name ?? row.product), norm(row.variant)]
    .filter(Boolean)
    .join("|");
}

function buildPricingLookup(rows: PlanogramRow[]): Map<string, PlanogramRow> {
  const map = new Map<string, PlanogramRow>();
  for (const row of rows) {
    map.set(planogramKey(row), row);
  }
  return map;
}

function pricingForRow(
  row: { brand?: string; product?: string; variant?: string; match_key?: string },
  lookup: Map<string, PlanogramRow>,
): { asp: number; velocity: number } {
  const plan = lookup.get(planogramKey(row));
  const asp =
    plan?.mrp_inr != null && Number.isFinite(plan.mrp_inr) && plan.mrp_inr > 0
      ? plan.mrp_inr
      : DEFAULT_ASP_INR;
  const velocity =
    plan?.avg_daily_sales != null &&
    Number.isFinite(plan.avg_daily_sales) &&
    plan.avg_daily_sales > 0
      ? plan.avg_daily_sales
      : DEFAULT_UNITS_PER_DAY;
  return { asp, velocity };
}

export function computeContextFinancialImpact(
  inventory: ScanResult["inventory"],
  planogramRows: PlanogramRow[],
  threshold = 2,
): FinancialImpact {
  const lookup = buildPricingLookup(planogramRows);
  let oosDaily = 0;
  let atRiskDaily = 0;
  let oosSkus = 0;
  let atRiskSkus = 0;

  for (const row of inventory ?? []) {
    const qty = row.quantity ?? 0;
    const { asp, velocity } = pricingForRow(row, lookup);
    if (row.out_of_stock || qty <= 0) {
      oosDaily += velocity * asp;
      oosSkus += 1;
    } else if (row.low_stock || qty <= threshold) {
      const gap = Math.max(0, threshold - qty);
      atRiskDaily += gap * velocity * asp * LOW_STOCK_RISK;
      atRiskSkus += 1;
    }
  }

  const daily = Math.round(oosDaily + atRiskDaily);
  const hasPlanogramPricing = planogramRows.some(
    (r) => (r.mrp_inr ?? 0) > 0 || (r.avg_daily_sales ?? 0) > 0,
  );

  return {
    estimated_daily_lost_sales_inr: daily,
    estimated_weekly_lost_sales_inr: daily * 7,
    estimated_monthly_lost_sales_inr: daily * 30,
    oos_sku_count: oosSkus,
    at_risk_sku_count: atRiskSkus,
    methodology: hasPlanogramPricing
      ? "Uses planogram price and daily sales velocity per SKU where provided."
      : "Indicative estimate using category ASP defaults and typical daily velocity.",
    confidence: hasPlanogramPricing ? "priced" : "indicative",
  };
}

function filteredBrandShare(
  inventory: NonNullable<ScanResult["inventory"]>,
  focus: ScanFocusFilter,
): { brand: string; share: number }[] {
  const totals = new Map<string, number>();
  let sum = 0;
  for (const row of inventory) {
    if (!matchesScanFocus(row, focus)) continue;
    const brand = row.brand || "Unknown";
    const qty = row.quantity ?? 0;
    totals.set(brand, (totals.get(brand) ?? 0) + qty);
    sum += qty;
  }
  if (!sum) return [];
  return [...totals.entries()]
    .map(([brand, qty]) => ({ brand, share: Math.round((qty / sum) * 1000) / 10 }))
    .sort((a, b) => b.share - a.share);
}

/** Apply focus filter + planogram pricing to a scan result (client-side). */
export function applyScanContext(result: ScanResult, ctx: ScanContextState): ScanResult {
  const hasFocus = Boolean(ctx.focus.company || ctx.focus.brand || ctx.focus.product);
  const hasPlanogram = ctx.planogramRows.length > 0;
  if (!hasFocus && !hasPlanogram) return result;

  const inventory = (result.inventory ?? []).filter((row) => matchesScanFocus(row, ctx.focus));
  const threshold = result.summary?.low_stock_threshold ?? 2;
  const financial_impact = computeContextFinancialImpact(inventory, ctx.planogramRows, threshold);

  const topBrands = filteredBrandShare(inventory, ctx.focus);
  const focusBrand = norm(ctx.focus.brand) || norm(ctx.focus.company);
  const ownShare = focusBrand
    ? topBrands.find((b) => norm(b.brand).includes(focusBrand))?.share
    : undefined;

  return {
    ...result,
    inventory,
    financial_impact,
    summary: {
      ...result.summary,
      total_products: inventory.reduce((n, r) => n + (r.quantity ?? 0), 0),
      unique_skus: inventory.length,
      unique_brands: new Set(inventory.map((r) => r.brand)).size,
      low_stock_products: inventory.filter((r) => r.low_stock).length,
      share_of_shelf_percent: ownShare ?? result.summary?.share_of_shelf_percent,
    },
    charts: topBrands.length
      ? { ...result.charts, top_brands: topBrands }
      : result.charts,
    planogram: hasPlanogram
      ? {
          percent: result.planogram?.percent ?? null,
          sku_match_percent: result.planogram?.sku_match_percent ?? null,
          qty_compliance_percent: result.planogram?.qty_compliance_percent ?? null,
          summary: result.planogram?.summary ?? {},
          requested: true,
        }
      : result.planogram,
  };
}

export function hasActiveScanContext(ctx: ScanContextState): boolean {
  return (
    Boolean(ctx.focus.company || ctx.focus.brand || ctx.focus.product) || ctx.planogramRows.length > 0
  );
}
