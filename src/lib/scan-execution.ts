/**
 * Shelf execution presentation layer — derives sellable KPIs from ScanResult.
 * One scan engine; this file shapes what the /results page shows.
 */

import type { ResultViewMode } from "@/lib/customer-context";
import type { RoleSummaries } from "@/lib/retail-intelligence";
import type { FinancialImpact, ScanRecommendation, ScanResult } from "@/lib/scan-results";
import { formatPercent, normalizeConfidence } from "@/lib/scan-results";
import { formatInr } from "@/lib/pricing";

const DEFAULT_ASP_INR = 75;
const UNITS_PER_DAY = 4;
const LOW_STOCK_RISK = 0.35;

export type ActionCenterItem = {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  label: string;
  count: number;
  detail?: string;
};

export type ExecutionKpi = {
  key: string;
  label: string;
  value: string;
  numeric?: number;
};

export function executionScore(result?: ScanResult | null): number | undefined {
  const s = result?.summary;
  if (!s) return undefined;
  const score = s.shelf_execution_score ?? s.shelf_health_score;
  return score !== undefined && Number.isFinite(score) ? Math.round(score) : undefined;
}

export function totalFacings(result?: ScanResult | null): number {
  const s = result?.summary;
  return s?.total_facings ?? s?.total_products ?? result?.inventory?.reduce((n, i) => n + i.quantity, 0) ?? 0;
}

export function recognitionCoverage(result?: ScanResult | null): number | undefined {
  const pct = result?.summary?.recognition_coverage_percent;
  if (pct !== undefined && Number.isFinite(pct)) return Math.round(pct);
  const facings = totalFacings(result);
  const unknown = result?.quality?.recognition_unknown ?? result?.summary?.needs_review_facings ?? 0;
  if (!facings) return undefined;
  return Math.round(((facings - unknown) / facings) * 100);
}

export function shareOfShelfTopBrand(result?: ScanResult | null): number | undefined {
  const brands = result?.charts?.top_brands;
  if (!brands?.length) return undefined;
  return brands[0]?.share;
}

export function buildKpiStrip(result?: ScanResult | null): ExecutionKpi[] {
  const s = result?.summary;
  const planogram = result?.planogram?.sku_match_percent ?? result?.planogram?.percent ?? s?.shelf_compliance;
  return [
    {
      key: "availability",
      label: "Availability",
      value: formatPercent(s?.availability_percent ?? s?.osa_percent) ?? "—",
      numeric: s?.availability_percent ?? s?.osa_percent,
    },
    {
      key: "planogram",
      label: "Planogram",
      value: planogram !== null && planogram !== undefined ? `${Math.round(planogram)}%` : "Not configured",
      numeric: planogram ?? undefined,
    },
    {
      key: "share",
      label: "Shelf share",
      value: formatPercent(s?.share_of_shelf_percent ?? shareOfShelfTopBrand(result)) ?? "—",
      numeric: s?.share_of_shelf_percent ?? shareOfShelfTopBrand(result),
    },
    {
      key: "facing",
      label: "Facing",
      value: formatPercent(s?.facing_compliance_percent) ?? "—",
      numeric: s?.facing_compliance_percent,
    },
    {
      key: "placement",
      label: "Placement",
      value: formatPercent(s?.placement_compliance_percent) ?? "—",
      numeric: s?.placement_compliance_percent,
    },
  ];
}

export function buildActionCenterItems(result?: ScanResult | null): ActionCenterItem[] {
  const s = result?.summary;
  if (!s) return [];
  const items: ActionCenterItem[] = [];

  const oos = s.confirmed_oos_count ?? s.out_of_stock_products ?? 0;
  if (oos > 0) {
    items.push({
      id: "oos",
      severity: "critical",
      label: "Confirmed OOS",
      count: oos,
      detail: "Expected SKUs not detected on shelf",
    });
  }

  const possibleOos = s.possible_oos_count ?? 0;
  if (possibleOos > 0) {
    items.push({
      id: "possible-oos",
      severity: "high",
      label: "Possible OOS / low stock",
      count: possibleOos,
      detail: `At or below ${s.low_stock_threshold ?? 2} facings`,
    });
  }

  const lowStock = s.low_stock_products ?? 0;
  if (lowStock > 0 && lowStock !== possibleOos) {
    items.push({
      id: "low-stock",
      severity: "high",
      label: "Low stock SKUs",
      count: lowStock,
      detail: `Threshold ≤ ${s.low_stock_threshold ?? 2} facings`,
    });
  }

  const placement = s.placement_issue_count ?? s.misplaced_products ?? 0;
  if (placement > 0) {
    items.push({
      id: "placement",
      severity: "high",
      label: "Placement issues",
      count: placement,
      detail: "Facings outside expected category or position",
    });
  }

  const gaps = s.shelf_gap_count ?? 0;
  if (gaps > 0) {
    items.push({
      id: "gaps",
      severity: "medium",
      label: "Unidentified facings",
      count: gaps,
      detail: "Needs review in AI queue",
    });
  }

  const planogramPct = result?.planogram?.percent;
  if (
    result?.planogram?.requested &&
    planogramPct !== null &&
    planogramPct !== undefined &&
    planogramPct < 85
  ) {
    items.push({
      id: "planogram",
      severity: "medium",
      label: "Planogram violations",
      count: 1,
      detail: `${Math.round(planogramPct)}% compliant`,
    });
  }

  return items;
}

export function totalActionCount(items: ActionCenterItem[]): number {
  return items.reduce((n, i) => n + i.count, 0);
}

export function roleSummariesFromResult(result?: ScanResult | null): RoleSummaries | undefined {
  const ri = (result as ScanResult & { retail_intelligence?: { role_summaries?: RoleSummaries } })
    ?.retail_intelligence?.role_summaries;
  if (ri && Object.keys(ri).length) return ri;
  const legacy = (result as ScanResult & { role_summaries?: RoleSummaries })?.role_summaries;
  return legacy && Object.keys(legacy).length ? legacy : undefined;
}

export function buildRoleSummary(result?: ScanResult | null, view?: ResultViewMode): string {
  const summaries = roleSummariesFromResult(result);
  if (view && summaries?.[view]?.trim()) return summaries[view]!.trim();
  return buildAiSummaryParagraph(result);
}

export function buildAiSummaryParagraph(result?: ScanResult | null): string {
  if (result?.executive_summary?.trim()) return result.executive_summary.trim();
  const facings = totalFacings(result);
  const s = result?.summary;
  if (!s) return "";
  const recognition = recognitionCoverage(result);
  const execution = executionScore(result);
  const parts = [
    `Aislix detected ${facings} facings across ${s.unique_skus} unique SKUs and ${s.unique_brands} brands.`,
  ];
  if (recognition !== undefined) parts.push(`Recognition coverage is ${recognition}%.`);
  if (execution !== undefined) parts.push(`Shelf execution score is ${execution}/100.`);
  if ((s.low_stock_products ?? 0) > 0) {
    parts.push(`${s.low_stock_products} SKU(s) are below the facing threshold.`);
  }
  if ((s.misplaced_products ?? 0) > 0) {
    parts.push(`${s.misplaced_products} placement issue(s) were detected.`);
  }
  return parts.join(" ");
}

export function priorityRecommendations(recs?: ScanRecommendation[]): ScanRecommendation[] {
  if (!recs?.length) return [];
  const order = { high: 0, medium: 1, low: 2 };
  return [...recs].sort((a, b) => {
    const pa = order[(a.impact as keyof typeof order) ?? "medium"] ?? 1;
    const pb = order[(b.impact as keyof typeof order) ?? "medium"] ?? 1;
    return pa - pb;
  });
}

export function formatScoreDelta(current?: number, previous?: number): string | undefined {
  if (current === undefined || previous === undefined) return undefined;
  const delta = Math.round(current - previous);
  if (delta === 0) return "No change vs previous scan";
  return delta > 0 ? `↑ ${delta} points vs previous scan` : `↓ ${Math.abs(delta)} points vs previous scan`;
}

export function formatConfidenceSecondary(value?: number): string | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return `${normalizeConfidence(value).toFixed(1)}% avg model confidence`;
}

/** Resolve financial impact from backend metrics or derive a client-side estimate. */
export function resolveFinancialImpact(result?: ScanResult | null): FinancialImpact | null {
  if (result?.financial_impact) return result.financial_impact;
  const s = result?.summary;
  const inventory = result?.inventory ?? [];
  if (!s && !inventory.length) return null;

  const threshold = s?.low_stock_threshold ?? 2;
  let oosDaily = 0;
  let atRiskDaily = 0;
  let oosSkus = 0;
  let atRiskSkus = 0;

  for (const row of inventory) {
    const qty = row.quantity ?? 0;
    if (row.out_of_stock || qty <= 0) {
      oosDaily += UNITS_PER_DAY * DEFAULT_ASP_INR;
      oosSkus += 1;
    } else if (row.low_stock || qty <= threshold) {
      const gap = Math.max(0, threshold - qty);
      atRiskDaily += gap * UNITS_PER_DAY * DEFAULT_ASP_INR * LOW_STOCK_RISK;
      atRiskSkus += 1;
    }
  }

  const confirmedOos = s?.confirmed_oos_count ?? s?.out_of_stock_products ?? oosSkus;
  const atRisk = s?.possible_oos_count ?? s?.low_stock_products ?? atRiskSkus;
  if (confirmedOos === 0 && atRisk === 0 && oosDaily + atRiskDaily === 0) {
    return {
      estimated_daily_lost_sales_inr: 0,
      estimated_weekly_lost_sales_inr: 0,
      estimated_monthly_lost_sales_inr: 0,
      oos_sku_count: 0,
      at_risk_sku_count: 0,
      methodology: "Indicative estimate using category ASP defaults and typical daily velocity.",
      confidence: "indicative",
    };
  }

  const daily =
    oosDaily + atRiskDaily > 0
      ? Math.round(oosDaily + atRiskDaily)
      : Math.round(confirmedOos * UNITS_PER_DAY * DEFAULT_ASP_INR + atRisk * UNITS_PER_DAY * DEFAULT_ASP_INR * LOW_STOCK_RISK);

  return {
    estimated_daily_lost_sales_inr: daily,
    estimated_weekly_lost_sales_inr: daily * 7,
    estimated_monthly_lost_sales_inr: daily * 30,
    oos_sku_count: confirmedOos,
    at_risk_sku_count: atRisk,
    methodology: "Indicative estimate using category ASP defaults and typical daily velocity.",
    confidence: "indicative",
  };
}

export function formatLostSales(amount?: number | null): string {
  if (amount === undefined || amount === null) return "—";
  return formatInr(Math.round(amount));
}
