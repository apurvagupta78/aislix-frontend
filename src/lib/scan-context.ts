/**
 * Optional scan focus (company / brand / product) and planogram pricing
 * used to filter results and compute financial impact.
 */

import {
  buildMatchKey,
  comparePlanogramToInventory,
  computePlanogramFinancialGaps,
  type InventoryFacing,
  type PlanogramMatchResult,
} from "@/lib/demo-planogram-match";
import type { CompetitorSnapshot, CompetitorUpperHand } from "@/lib/brand-intel";
import type { FinancialImpact, ScanRecommendation, ScanResult } from "@/lib/scan-results";
import { emptyRow, type PlanogramRow } from "@/lib/planogram";

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

const DEFAULT_ASP_INR = 75;
const DEFAULT_UNITS_PER_DAY = 4;
const LOW_STOCK_RISK = 0.35;
const OOS_THRESHOLD = 2;

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

function norm(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeBrand(value?: string | null): string {
  return norm(value).replace(/[^a-z0-9]/g, "");
}

function brandsMatch(a?: string | null, b?: string | null): boolean {
  const na = normalizeBrand(a);
  const nb = normalizeBrand(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function productBlob(row: {
  brand?: string | null;
  product?: string | null;
  product_name?: string | null;
  variant?: string | null;
}): string {
  return [row.brand, row.product ?? row.product_name, row.variant]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** True when a row matches the optional company / brand / product focus. */
export function matchesScanFocus(
  row: { brand?: string | null; product?: string | null; product_name?: string | null; variant?: string | null },
  focus: ScanFocusFilter,
): boolean {
  const company = norm(focus.company);
  const brand = norm(focus.brand);
  const product = norm(focus.product);
  if (!company && !brand && !product) return true;

  const blob = productBlob(row);
  const b = rowBrand(row);

  if (brand && !b.includes(brand) && !normalizeBrand(row.brand).includes(normalizeBrand(focus.brand))) {
    return false;
  }
  if (product) {
    const tokens = product.split(/\s+/).filter((t) => t.length > 2);
    if (tokens.length && !tokens.some((t) => blob.includes(t))) return false;
  }
  if (company && !blob.includes(company) && !b.includes(company.replace(/[^a-z0-9]/g, ""))) {
    return false;
  }
  return true;
}

function rowBrand(row: { brand?: string | null }): string {
  return norm(row.brand);
}

function pricingForPlanogramRow(row: PlanogramRow): { asp: number; velocity: number } {
  const asp =
    row.mrp_inr != null && Number.isFinite(row.mrp_inr) && row.mrp_inr > 0
      ? row.mrp_inr
      : DEFAULT_ASP_INR;
  const velocity =
    row.avg_daily_sales != null && Number.isFinite(row.avg_daily_sales) && row.avg_daily_sales > 0
      ? row.avg_daily_sales
      : DEFAULT_UNITS_PER_DAY;
  return { asp, velocity };
}

export function computeContextFinancialImpact(
  inventory: ScanResult["inventory"],
  planogramRows: PlanogramRow[],
  threshold = OOS_THRESHOLD,
  match?: PlanogramMatchResult,
): FinancialImpact {
  let oosDaily = 0;
  let atRiskDaily = 0;
  let oosSkus = 0;
  let atRiskSkus = 0;

  const fullInventory = inventory ?? [];

  if (planogramRows.length > 0) {
    const planMatch =
      match ?? comparePlanogramToInventory(fullInventory as InventoryFacing[], planogramRows);
    const gaps = computePlanogramFinancialGaps(planMatch, threshold);
    for (const gap of gaps) {
      if (gap.issue_type === "missing" || gap.issue_type === "wrong_product") {
        oosDaily += gap.daily_loss_inr;
        oosSkus += 1;
      } else {
        atRiskDaily += gap.daily_loss_inr;
        atRiskSkus += 1;
      }
    }
  } else {
    for (const row of fullInventory) {
      const qty = row.quantity ?? 0;
      const asp = DEFAULT_ASP_INR;
      const velocity = DEFAULT_UNITS_PER_DAY;
      if (row.out_of_stock || qty <= 0) {
        oosDaily += velocity * asp;
        oosSkus += 1;
      } else if (row.low_stock || qty < threshold) {
        const gap = Math.max(0, threshold - qty);
        oosDaily += gap * velocity * asp;
        oosSkus += 1;
        atRiskDaily += gap * velocity * asp * LOW_STOCK_RISK;
        atRiskSkus += 1;
      }
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

/** Known category competitors when org brand config is absent (demo / planogram-only). */
const CATEGORY_COMPETITORS: Record<string, string[]> = {
  toothpaste: ["Sensodyne", "Oral-B", "Pepsodent", "Closeup", "Dabur Red", "Meswak"],
  mouthwash: ["Listerine", "Colgate", "Sensodyne", "Closeup"],
  shampoo: ["Pantene", "Head & Shoulders", "Dove", "Sunsilk", "Clinic Plus"],
  chips: ["Lay's", "Kurkure", "Bingo", "Uncle Chipps"],
  soda: ["Coca-Cola", "Pepsi", "Sprite", "Thums Up"],
};

function knownCompetitorsForPlanogramRow(row: PlanogramRow): string[] {
  const sub = norm(row.sub_category);
  const cat = norm(row.category);
  for (const [key, brands] of Object.entries(CATEGORY_COMPETITORS)) {
    if (sub.includes(key) || cat.includes(key)) return brands;
  }
  return [];
}

const GENERIC_PRODUCT_WORDS = new Set([
  "toothpaste",
  "shampoo",
  "chips",
  "tea",
  "soap",
  "water",
  "soda",
  "mouthwash",
]);

/** Planogram rows from table, or a single implicit row when brand + product focus is set. */
export function effectivePlanogramRows(
  ctx: ScanContextState,
  defaults?: { category?: string; subCategory?: string },
): PlanogramRow[] {
  if (ctx.planogramRows.length > 0) return ctx.planogramRows;
  const brand = ctx.focus.brand?.trim();
  const product = ctx.focus.product?.trim();
  if (!brand || !product) return [];
  return [
    {
      ...emptyRow(),
      location: "A-1",
      category: defaults?.category ?? "Personal Care",
      sub_category: defaults?.subCategory ?? "Toothpaste",
      brand,
      product_name: product,
      expected_qty: 1,
      match_key: buildMatchKey(brand, product),
    },
  ];
}

/** Derive audit focus from explicit focus fields or the first planogram row. */
export function effectiveFocusFromContext(ctx: ScanContextState): ScanFocusFilter {
  if (ctx.focus.brand || ctx.focus.company || ctx.focus.product) return ctx.focus;
  const first = ctx.planogramRows[0];
  if (!first) return {};
  return {
    brand: first.brand,
    company: first.brand,
    product: first.product_name,
  };
}

function productNameTokens(name?: string | null): string[] {
  return norm(name)
    .split(/\s+/)
    .filter((t) => t.length > 2 && !GENERIC_PRODUCT_WORDS.has(t));
}

function productMatchesRow(
  row: { brand?: string | null; product?: string | null; product_name?: string | null; variant?: string | null },
  brand: string,
  product?: string,
): boolean {
  if (!brandsMatch(row.brand, brand)) return false;
  if (!product?.trim()) return true;
  const blob = productBlob(row);
  const tokens = productNameTokens(product);
  const required = tokens.length ? tokens : norm(product).split(/\s+/).filter((t) => t.length > 2);
  return required.length > 0 && required.every((t) => blob.includes(t));
}

function computeProductShareFromMatch(
  inventory: NonNullable<ScanResult["inventory"]>,
  match: PlanogramMatchResult,
): number {
  const total = inventory.reduce((n, r) => n + (r.quantity ?? 0), 0);
  if (!total) return 0;
  const own = match.lines.reduce((n, line) => {
    if (line.issue_type === "missing" || line.issue_type === "wrong_product") return n;
    return n + line.detected_qty;
  }, 0);
  return Math.round((own / total) * 1000) / 10;
}

function computeBrandSharePercent(
  inventory: NonNullable<ScanResult["inventory"]>,
  brand: string,
): number | undefined {
  const total = inventory.reduce((n, r) => n + (r.quantity ?? 0), 0);
  if (!total || !brand.trim()) return undefined;
  const own = inventory
    .filter((r) => brandsMatch(r.brand, brand))
    .reduce((n, r) => n + (r.quantity ?? 0), 0);
  return Math.round((own / total) * 1000) / 10;
}

function computeProductSharePercent(
  inventory: NonNullable<ScanResult["inventory"]>,
  brand: string,
  product?: string,
): number | undefined {
  const total = inventory.reduce((n, r) => n + (r.quantity ?? 0), 0);
  if (!total || !product?.trim()) return undefined;
  const own = inventory
    .filter((r) => productMatchesRow(r, brand, product))
    .reduce((n, r) => n + (r.quantity ?? 0), 0);
  return Math.round((own / total) * 1000) / 10;
}

function filteredBrandShare(
  inventory: NonNullable<ScanResult["inventory"]>,
  focus: ScanFocusFilter,
): { brand: string; share: number; quantity?: number }[] {
  const totals = new Map<string, number>();
  let sum = 0;
  for (const row of inventory) {
    const brand = row.brand || "Unknown";
    const qty = row.quantity ?? 0;
    totals.set(brand, (totals.get(brand) ?? 0) + qty);
    sum += qty;
  }
  if (!sum) return [];
  return [...totals.entries()]
    .map(([brand, qty]) => ({
      brand,
      quantity: qty,
      share: Math.round((qty / sum) * 1000) / 10,
    }))
    .sort((a, b) => b.share - a.share);
}

export function buildDemoCompetitorIntel(
  inventory: NonNullable<ScanResult["inventory"]>,
  ctx: ScanContextState,
): CompetitorSnapshot | null {
  const focus = effectiveFocusFromContext(ctx);
  const primary = (focus.brand || focus.company || "").trim();
  if (!primary) return null;

  const shares = filteredBrandShare(inventory, {});
  if (!shares.length) return null;

  const ownRow = shares.find((s) => brandsMatch(s.brand, primary)) ?? {
    brand: primary,
    share: 0,
    quantity: 0,
  };

  const firstPlanogramRow = ctx.planogramRows[0];
  const knownCompetitors = firstPlanogramRow
    ? knownCompetitorsForPlanogramRow(firstPlanogramRow)
    : [];
  const competitorNames = new Set<string>(knownCompetitors);
  for (const row of shares) {
    if (!brandsMatch(row.brand, primary)) competitorNames.add(row.brand);
  }

  const competitorRows = [...competitorNames]
    .map((name) => {
      const detected = shares.find((s) => brandsMatch(s.brand, name));
      return {
        brand: name,
        share: detected?.share ?? 0,
        facings: detected?.quantity,
        is_competitor: true as const,
      };
    })
    .sort((a, b) => b.share - a.share)
    .slice(0, 8);

  const upperHand: CompetitorUpperHand[] = competitorRows
    .filter((c) => c.share > ownRow.share && c.share > 0)
    .map((c) => ({
      brand: c.brand,
      share: c.share,
      note: `${c.brand} leads with ${c.share}% shelf share vs ${primary} at ${ownRow.share}% — consider adding facings or improving eye-level placement for ${primary}.`,
    }));

  const productLabel = focus.product?.trim()
    ? `${primary} ${focus.product}`.trim()
    : undefined;
  const productShare = focus.product
    ? computeProductSharePercent(inventory, primary, focus.product)
    : undefined;

  return {
    primary_brand: primary,
    own_brand_share_percent: ownRow.share,
    product_share_percent: productShare,
    product_label: productLabel,
    competitor_shares: [
      {
        brand: ownRow.brand,
        share: ownRow.share,
        facings: ownRow.quantity,
        is_primary: true,
      },
      ...competitorRows,
    ],
    competitors_detected: competitorRows.filter((c) => c.share > 0).length,
    competitors_configured: competitorRows.length,
    upper_hand: upperHand.length ? upperHand : undefined,
  };
}

type DemoSummaryContext = {
  match: PlanogramMatchResult;
  brandShare?: number;
  productShare?: number;
  intel?: CompetitorSnapshot | null;
  financial?: FinancialImpact;
  inventory: NonNullable<ScanResult["inventory"]>;
};

function skuLabel(row: {
  brand?: string | null;
  product?: string | null;
  product_name?: string | null;
  variant?: string | null;
}): string {
  const name = row.product_name ?? row.product ?? "Unknown";
  const variant = row.variant?.trim();
  return variant ? `${row.brand ?? ""} ${name} (${variant})`.trim() : `${row.brand ?? ""} ${name}`.trim();
}

function inventoryCatalogSummary(inventory: NonNullable<ScanResult["inventory"]>): string {
  if (!inventory.length) return "No SKU groups detected.";
  const sorted = [...inventory].sort((a, b) => (b.quantity ?? 0) - (a.quantity ?? 0));
  const lines = sorted.map(
    (row) => `${skuLabel(row)}: ${row.quantity ?? 0} facing${(row.quantity ?? 0) === 1 ? "" : "s"}`,
  );
  return `Complete inventory (${inventory.length} SKU groups): ${lines.join("; ")}.`;
}

function topBrandSummary(inventory: NonNullable<ScanResult["inventory"]>): string {
  const shares = filteredBrandShare(inventory, {});
  if (!shares.length) return "";
  const top = shares
    .slice(0, 6)
    .map((b) => `${b.brand} ${b.share}% (${b.quantity ?? 0} facings)`)
    .join(", ");
  return `Brand mix: ${top}.`;
}

function stockGapSummary(
  inventory: NonNullable<ScanResult["inventory"]>,
  threshold: number,
  listAll = false,
): string {
  const atRisk = inventory.filter((r) => (r.quantity ?? 0) < threshold);
  if (!atRisk.length) {
    return `All detected SKUs meet the ${threshold}-facing threshold.`;
  }
  const listed = listAll ? atRisk : atRisk.slice(0, 8);
  const names = listed
    .map((r) => `${skuLabel(r)} (${r.quantity ?? 0} facing${(r.quantity ?? 0) === 1 ? "" : "s"})`)
    .join("; ");
  const suffix = !listAll && atRisk.length > listed.length ? `; and ${atRisk.length - listed.length} more` : "";
  return `Below ${threshold} facings (${atRisk.length} SKU${atRisk.length === 1 ? "" : "s"}): ${names}${suffix}.`;
}

function planogramGapSummary(ctx: ScanContextState, match: PlanogramMatchResult): string {
  if (!match.lines.length) return "";
  const parts: string[] = [];
  for (const line of match.lines) {
    if (line.issue_type === "correct") continue;
    parts.push(
      line.detail ??
        `${line.expected.brand} ${line.expected.product_name}: expected ${line.expected_qty}, detected ${line.detected_qty}.`,
    );
  }
  if (!parts.length) return "Planogram: all configured SKUs match expected facings.";
  return `Planogram gaps: ${parts.join(" ")}`;
}

function buildDemoRoleSummaries(
  result: ScanResult,
  ctx: ScanContextState,
  summaryCtx: DemoSummaryContext,
): NonNullable<ScanResult["role_summaries"]> {
  const s = result.summary;
  const focus = effectiveFocusFromContext(ctx);
  const threshold = s?.low_stock_threshold ?? OOS_THRESHOLD;
  const { match, brandShare, productShare, intel, financial, inventory } = summaryCtx;
  const facings = s?.total_facings ?? s?.total_products ?? 0;
  const stockGapsFull = stockGapSummary(inventory, threshold, true);
  const brandMix = topBrandSummary(inventory);
  const catalog = inventoryCatalogSummary(inventory);
  const planogram = planogramGapSummary(ctx, match);
  const hasEffectivePlanogram = match.lines.length > 0;

  const executionParts = [
    `Field view: ${facings} facings detected across ${s?.unique_skus ?? 0} SKUs.`,
    stockGapsFull,
    (s?.placement_issue_count ?? s?.misplaced_products ?? 0) > 0
      ? `${s?.placement_issue_count ?? s?.misplaced_products} placement issue(s) — move products to correct section and rescan.`
      : "",
    planogram,
  ].filter(Boolean);

  const merchandisingParts = [
    `Category view: ${s?.unique_brands ?? 0} brands on shelf.`,
    brandMix,
    hasEffectivePlanogram
      ? `Planogram compliance ${match.sku_match_percent}% SKU match, ${match.qty_compliance_percent}% facing compliance.`
      : "",
    planogram,
    brandShare !== undefined && focus.brand
      ? `${focus.brand} brand share ${brandShare}% · ${focus.product && productShare !== undefined ? `${focus.product} product share ${productShare}%` : ""}`.trim()
      : "",
  ].filter(Boolean);

  const brandParts = [
    focus.brand
      ? `Brand view for ${focus.brand}${focus.product ? ` ${focus.product}` : ""}.`
      : "Brand view:",
    brandShare !== undefined ? `${focus.brand} holds ${brandShare}% brand share.` : "",
    productShare !== undefined && focus.product
      ? `${focus.brand} ${focus.product} product share is ${productShare}% (this SKU only).`
      : "",
    intel?.upper_hand?.length
      ? intel.upper_hand.map((e) => e.note).join(" ")
      : intel
        ? `Competitors on shelf: ${intel.competitor_shares
            .filter((c) => c.is_competitor && (c.share ?? 0) > 0)
            .slice(0, 4)
            .map((c) => `${c.brand} ${c.share}%`)
            .join(", ")}.`
        : "",
  ].filter(Boolean);

  const executiveParts = [
    `Executive snapshot: ${facings} facings, ${s?.unique_skus ?? 0} SKUs, ${s?.unique_brands ?? 0} brands.`,
    stockGapsFull,
    planogram,
    executionParts.filter((p) => p !== stockGapsFull).join(" "),
    merchandisingParts.join(" "),
    brandParts.join(" "),
    financial && financial.estimated_daily_lost_sales_inr > 0
      ? `Revenue at risk: ₹${financial.estimated_daily_lost_sales_inr.toLocaleString("en-IN")}/day.`
      : "",
    catalog,
  ].filter(Boolean);

  return {
    execution: executionParts.join(" "),
    merchandising: merchandisingParts.join(" "),
    brand: brandParts.join(" "),
    executive: executiveParts.join(" "),
  };
}

function buildDemoExecutiveSummary(
  result: ScanResult,
  ctx: ScanContextState,
  summaryCtx: DemoSummaryContext,
): string {
  const roleSummaries = buildDemoRoleSummaries(result, ctx, summaryCtx);
  return roleSummaries.executive ?? roleSummaries.execution ?? "";
}

export function buildDemoRecommendations(
  inventory: NonNullable<ScanResult["inventory"]>,
  ctx: ScanContextState,
  match: ReturnType<typeof comparePlanogramToInventory>,
): ScanRecommendation[] {
  const recs: ScanRecommendation[] = [];
  const threshold = OOS_THRESHOLD;

  const lowFacings = inventory.filter((row) => {
    const qty = row.quantity ?? 0;
    return qty > 0 && qty < threshold;
  });
  if (lowFacings.length) {
    recs.push({
      id: "replenish-low-facings",
      title: `Replenish ${lowFacings.length} SKUs with fewer than ${threshold} facings`,
      detail: lowFacings
        .slice(0, 4)
        .map((r) => `${r.brand} ${r.product ?? r.product_name} (${r.quantity ?? 0} facing(s))`)
        .join("; "),
      category: "Replenishment",
      impact: "high",
    });
  }

  const zeroQty = inventory.filter((row) => (row.quantity ?? 0) <= 0);
  if (zeroQty.length) {
    recs.push({
      id: "replenish-oos",
      title: `Restock ${zeroQty.length} out-of-stock SKUs`,
      detail: "These products were not detected on the shelf.",
      category: "Replenishment",
      impact: "high",
    });
  }

  for (const line of match.lines) {
    if (line.issue_type === "missing") {
      recs.push({
        id: `plan-missing-${line.expected.brand}-${line.expected.product_name}`,
        title: `Missing planogram SKU: ${line.expected.brand} ${line.expected.product_name}`,
        detail: line.detail ?? `Expected ${line.expected_qty} facings — none detected.`,
        category: "Planogram",
        impact: "high",
      });
    } else if (line.issue_type === "wrong_product") {
      recs.push({
        id: `plan-wrong-${line.expected.brand}-${line.expected.product_name}`,
        title: `Wrong product on shelf: expected ${line.expected.brand} ${line.expected.product_name}`,
        detail:
          line.detail ??
          `Detected ${line.matched_brand ?? ""} ${line.matched_product ?? ""} instead.`,
        category: "Planogram",
        impact: "high",
      });
    } else if (line.issue_type === "qty_mismatch") {
      recs.push({
        id: `plan-short-${line.expected.brand}-${line.expected.product_name}`,
        title: `Short on ${line.expected.brand} ${line.expected.product_name}`,
        detail: line.detail ?? `Detected ${line.detected_qty} vs ${line.expected_qty} expected facings.`,
        category: "Planogram",
        impact: "medium",
      });
    }
  }

  const intel = buildDemoCompetitorIntel(inventory, ctx);
  if (intel && intel.competitor_shares.length > 1) {
    const topRival = intel.competitor_shares.find((r) => r.is_competitor && (r.share ?? 0) > 0);
    if (topRival && topRival.share > intel.own_brand_share_percent) {
      recs.push({
        id: "competitor-edge",
        title: `${topRival.brand} leads shelf share at ${topRival.share}% vs your ${intel.own_brand_share_percent}%`,
        detail:
          "Consider adding facings or improving placement for your brand to close the share gap.",
        category: "Competitive intelligence",
        impact: "medium",
      });
    }
  }

  if (match.sku_match_percent > 0 && match.sku_match_percent < 85) {
    recs.push({
      id: "planogram-compliance",
      title: `Improve planogram compliance (${match.sku_match_percent}% SKU match)`,
      detail: `${match.missing_count} expected SKU(s) missing and ${match.qty_short_count} below expected facings.`,
      category: "Merchandising",
      impact: "medium",
    });
  }

  return recs;
}

/** Apply focus filter + planogram pricing to a scan result (client-side). */
export function applyScanContext(result: ScanResult, ctx: ScanContextState): ScanResult {
  const hasFocus = Boolean(ctx.focus.company || ctx.focus.brand || ctx.focus.product);
  const planogramRows = effectivePlanogramRows(ctx, {
    category: result.scan_category,
    subCategory: result.scan_sub_category,
  });
  const hasPlanogram = planogramRows.length > 0;
  if (!hasFocus && !hasPlanogram) return result;

  const fullInventory = result.inventory ?? [];
  const threshold = result.summary?.low_stock_threshold ?? OOS_THRESHOLD;
  const match = hasPlanogram
    ? comparePlanogramToInventory(fullInventory as InventoryFacing[], planogramRows)
    : comparePlanogramToInventory([], []);

  const financial_impact = computeContextFinancialImpact(
    fullInventory,
    planogramRows,
    threshold,
    match,
  );

  const displayInventory = hasFocus
    ? fullInventory.filter((row) => matchesScanFocus(row, ctx.focus))
    : fullInventory;

  const effectiveFocus = effectiveFocusFromContext(ctx);
  const topBrands = filteredBrandShare(fullInventory, {});
  const primaryBrand = effectiveFocus.brand || effectiveFocus.company;
  const brandShare = primaryBrand
    ? computeBrandSharePercent(fullInventory, primaryBrand)
    : undefined;
  const productShare =
    primaryBrand && effectiveFocus.product
      ? hasPlanogram
        ? computeProductShareFromMatch(fullInventory, match)
        : computeProductSharePercent(fullInventory, primaryBrand, effectiveFocus.product)
      : undefined;
  const productShareLabel =
    primaryBrand && effectiveFocus.product
      ? `${primaryBrand} ${effectiveFocus.product}`.trim()
      : undefined;
  const competitor_intel = buildDemoCompetitorIntel(fullInventory, ctx);
  if (competitor_intel && productShare !== undefined) {
    competitor_intel.product_share_percent = productShare;
  }

  const lowStock = fullInventory.filter(
    (r) => (r.quantity ?? 0) > 0 && (r.quantity ?? 0) < threshold,
  ).length;
  const oosCount =
    fullInventory.filter((r) => (r.quantity ?? 0) <= 0).length +
    (hasPlanogram ? match.missing_count + match.wrong_product_count : 0);

  const facingPct = hasPlanogram
    ? match.qty_compliance_percent
    : result.summary?.facing_compliance_percent;
  const placementPct = hasPlanogram
    ? match.sku_match_percent
    : result.summary?.placement_compliance_percent;

  const demoRecs = buildDemoRecommendations(fullInventory, ctx, match);
  const mergedRecs = [...demoRecs, ...(result.recommendations ?? [])];
  const summaryCtx: DemoSummaryContext = {
    match,
    brandShare,
    productShare,
    intel: competitor_intel,
    financial: financial_impact,
    inventory: fullInventory,
  };
  const role_summaries = buildDemoRoleSummaries(result, ctx, summaryCtx);
  const executive_summary = buildDemoExecutiveSummary(result, ctx, summaryCtx);

  return {
    ...result,
    inventory: displayInventory,
    financial_impact,
    executive_summary,
    role_summaries,
    competitor_intel: competitor_intel ?? result.competitor_intel,
    recommendations: mergedRecs,
    summary: {
      ...result.summary,
      total_products: fullInventory.reduce((n, r) => n + (r.quantity ?? 0), 0),
      unique_skus: fullInventory.length,
      unique_brands: new Set(fullInventory.map((r) => r.brand)).size,
      low_stock_products: lowStock,
      confirmed_oos_count: oosCount,
      possible_oos_count: lowStock,
      brand_share_percent: brandShare,
      product_share_percent: productShare,
      product_share_label: productShareLabel,
      share_of_shelf_percent:
        brandShare ?? productShare ?? topBrands[0]?.share ?? result.summary?.share_of_shelf_percent,
      facing_compliance_percent: facingPct ?? undefined,
      placement_compliance_percent: placementPct ?? undefined,
      availability_percent: hasPlanogram
        ? match.sku_match_percent
        : result.summary?.availability_percent,
    },
    charts: topBrands.length ? { ...result.charts, top_brands: topBrands } : result.charts,
    planogram: hasPlanogram
      ? {
          requested: true,
          percent: match.sku_match_percent,
          sku_match_percent: match.sku_match_percent,
          qty_compliance_percent: match.qty_compliance_percent,
          summary: {
            ...(result.planogram?.summary ?? {}),
            expected_sku_count: planogramRows.length,
            missing: match.missing_count,
            wrong_product: match.wrong_product_count,
            qty_short: match.qty_short_count,
            correct: match.correct_count,
            configured_rows: planogramRows,
            lines: match.lines.map((l) => ({
              brand: l.expected.brand,
              product: l.expected.product_name,
              expected_qty: l.expected_qty,
              detected_qty: l.detected_qty,
              issue_type: l.issue_type,
              detail: l.detail,
            })),
            source: "demo_planogram",
          },
        }
      : result.planogram,
  };
}

/** Always enrich demo scan results with role summaries and full inventory analysis. */
export function enrichDemoScanResult(result: ScanResult, ctx: ScanContextState): ScanResult {
  const applied = applyScanContext(result, ctx);
  if (applied.role_summaries?.executive?.trim()) return applied;

  const fullInventory = result.inventory ?? [];
  const planogramRows = effectivePlanogramRows(ctx, {
    category: result.scan_category,
    subCategory: result.scan_sub_category,
  });
  const match =
    planogramRows.length > 0
      ? comparePlanogramToInventory(fullInventory as InventoryFacing[], planogramRows)
      : comparePlanogramToInventory([], []);
  const effectiveFocus = effectiveFocusFromContext(ctx);
  const primaryBrand = effectiveFocus.brand || effectiveFocus.company;
  const brandShare = primaryBrand
    ? computeBrandSharePercent(fullInventory, primaryBrand)
    : undefined;
  const productShare =
    primaryBrand && effectiveFocus.product
      ? planogramRows.length
        ? computeProductShareFromMatch(fullInventory, match)
        : computeProductSharePercent(fullInventory, primaryBrand, effectiveFocus.product)
      : undefined;
  const intel = buildDemoCompetitorIntel(fullInventory, ctx);
  const threshold = result.summary?.low_stock_threshold ?? OOS_THRESHOLD;
  const financial = computeContextFinancialImpact(fullInventory, planogramRows, threshold, match);

  const summaryCtx: DemoSummaryContext = {
    match,
    brandShare,
    productShare,
    intel,
    financial,
    inventory: fullInventory,
  };

  return {
    ...applied,
    role_summaries: buildDemoRoleSummaries(applied, ctx, summaryCtx),
    executive_summary: buildDemoExecutiveSummary(applied, ctx, summaryCtx),
    competitor_intel: intel ?? applied.competitor_intel,
  };
}

export function hasActiveScanContext(ctx: ScanContextState): boolean {
  return (
    Boolean(ctx.focus.company || ctx.focus.brand || ctx.focus.product) || ctx.planogramRows.length > 0
  );
}

/** Convert client-side planogram match into the shared comparison shape for UI tables. */
export function buildDemoPlanogramComparison(
  match: PlanogramMatchResult,
  scanId = "demo",
): import("@/lib/planogram-compliance").PlanogramComparison {
  return {
    id: `${scanId}-planogram`,
    compliance_percent: match.sku_match_percent,
    created_at: new Date().toISOString(),
    summary: {
      expected: match.lines.length,
      found: match.correct_count,
      missing: match.missing_count,
      wrong_product: match.wrong_product_count,
      qty_issues: match.qty_short_count,
    },
    lines: match.lines.map((line, i) => ({
      id: `line-${i}`,
      issue_type:
        line.issue_type === "correct"
          ? "ok"
          : line.issue_type === "qty_mismatch"
            ? "qty_issue"
            : line.issue_type,
      expected_brand: line.expected.brand,
      expected_product: line.expected.product_name,
      expected_qty: line.expected_qty,
      actual_brand: line.matched_brand ?? null,
      actual_product: line.matched_product ?? null,
      actual_qty: line.detected_qty,
      severity: line.issue_type === "missing" || line.issue_type === "wrong_product" ? "critical" : "warning",
      detail: line.detail ?? null,
    })),
    actions: match.lines
      .filter((l) => l.issue_type !== "correct")
      .map((line, i) => ({
        id: `action-${i}`,
        issue_type: line.issue_type,
        suggestion:
          line.issue_type === "missing"
            ? `Replenish ${line.expected.brand} ${line.expected.product_name} — ${line.expected_qty} facing(s) required.`
            : line.issue_type === "wrong_product"
              ? `Replace with expected SKU: ${line.expected.brand} ${line.expected.product_name}.`
              : `Add ${line.expected_qty - line.detected_qty} facing(s) of ${line.expected.brand} ${line.expected.product_name}.`,
        status: "open",
      })),
  };
}
