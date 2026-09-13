/**
 * Shelf execution presentation layer — derives sellable KPIs from ScanResult.
 * One scan engine; this file shapes what the /results page shows.
 */

import type { ResultViewMode } from "@/lib/customer-context";
import type { CustomerType } from "@/lib/customer-context";
import {
  buildKpiMetrics,
  buildRoleKpiMetrics,
  computeRetailExecutionScore,
  executionScoreFromResult,
} from "@/lib/execution-metrics";
import type { NextBestAction, RoleSummaries } from "@/lib/retail-intelligence";
import type { FinancialImpact, ScanRecommendation, ScanResult } from "@/lib/scan-results";
import { normalizeConfidence } from "@/lib/scan-results";
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

export type DetailedActionItem = {
  action_id: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  reason: string;
  recommended_action: string;
  expected_state?: string;
  actual_state?: string;
  estimated_daily_impact_inr?: number;
};

export type ExecutionKpi = {
  key: string;
  label: string;
  value: string;
  numeric?: number;
  state?: import("@/lib/retail-intelligence").MetricState;
  coverage_label?: string;
  detail?: string;
  audit_status?: string;
};

export function executionScore(result?: ScanResult | null): number | undefined {
  return executionScoreFromResult(result);
}

export { computeRetailExecutionScore, buildKpiMetrics };

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

export function buildKpiStrip(
  result?: ScanResult | null,
  customerType?: CustomerType | string | null,
): ExecutionKpi[] {
  const metrics = buildRoleKpiMetrics(result, customerType);
  return metrics.map(({ key, label, value, numeric, state, coverage_label, detail, audit_status }) => ({
    key,
    label,
    value,
    numeric,
    state,
    coverage_label,
    detail,
    audit_status,
  }));
}

export function buildActionCenterItems(result?: ScanResult | null): ActionCenterItem[] {
  const s = result?.summary;
  if (!s) return [];
  const items: ActionCenterItem[] = [];

  const oos = s.confirmed_oos_count ?? 0;
  const suspected = (s as { suspected_shelf_gap_count?: number }).suspected_shelf_gap_count ?? 0;
  if (oos > 0) {
    items.push({
      id: "oos",
      severity: "critical",
      label: "Verified shelf absence",
      count: oos,
      detail: "Expected products not detected with adequate coverage — not confirmed store inventory stockout",
    });
  } else if (suspected > 0) {
    items.push({
      id: "suspected-gap",
      severity: "high",
      label: "Suspected shelf gaps",
      count: suspected,
      detail: "Unresolved identity or insufficient evidence — review before treating as stockout",
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

export function nextBestActionsFromResult(result?: ScanResult | null): NextBestAction[] {
  const actions = result?.retail_intelligence?.next_best_actions;
  if (Array.isArray(actions) && actions.length) return actions;
  return [];
}

/** Map GPT / backend next-best-actions into detailed action rows for the Action Center. */
export function buildDetailedActions(
  result?: ScanResult | null,
  view?: ResultViewMode,
): DetailedActionItem[] {
  const nba = nextBestActionsFromResult(result);
  const filtered = view
    ? nba.filter((a) => !a.role || a.role === view || a.role === "field" && view === "execution")
    : nba;

  if (filtered.length) {
    return filtered.map((a) => ({
      action_id: a.action_id,
      priority: a.priority,
      title: a.title,
      reason: a.reason,
      recommended_action: a.recommended_action,
      expected_state: a.expected_state,
      actual_state: a.actual_state,
      estimated_daily_impact_inr: a.estimated_daily_impact_inr,
    }));
  }

  return (result?.recommendations ?? []).slice(0, 8).map((rec, i) => ({
    action_id: rec.id ?? `rec-${i}`,
    priority: (rec.impact === "high" ? "high" : rec.impact === "low" ? "low" : "medium") as DetailedActionItem["priority"],
    title: rec.title,
    reason: rec.detail ?? "",
    recommended_action: rec.detail ?? rec.title,
  }));
}

/** Demo: merge next-best-actions, recommendations, and aggregate issue counts into one list. */
export function buildAllDemoActions(
  result?: ScanResult | null,
  view?: ResultViewMode,
): DetailedActionItem[] {
  const out: DetailedActionItem[] = [];
  const seen = new Set<string>();

  const push = (action: DetailedActionItem) => {
    if (seen.has(action.action_id)) return;
    seen.add(action.action_id);
    out.push(action);
  };

  for (const action of buildDetailedActions(result, view)) {
    push(action);
  }

  for (const [i, rec] of (result?.recommendations ?? []).entries()) {
    push({
      action_id: rec.id ?? `rec-${i}`,
      priority: (rec.impact === "high" ? "high" : rec.impact === "low" ? "low" : "medium") as DetailedActionItem["priority"],
      title: rec.title,
      reason: rec.detail ?? "",
      recommended_action: rec.detail ?? rec.title,
    });
  }

  for (const item of buildActionCenterItems(result)) {
    const severityToPriority = {
      critical: "critical",
      high: "high",
      medium: "medium",
      low: "low",
    } as const;
    push({
      action_id: `aggregate-${item.id}`,
      priority: severityToPriority[item.severity] ?? "medium",
      title: `Fix ${item.count} ${item.label.toLowerCase()}`,
      reason: item.detail ?? "",
      recommended_action: item.detail ?? `Address ${item.label} and re-audit to verify.`,
    });
  }

  return out;
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

const EXECUTIVE_ROLLUP_ROLES: Array<{ key: ResultViewMode; label: string }> = [
  { key: "execution", label: "Execution" },
  { key: "merchandising", label: "Merchandising" },
  { key: "brand", label: "Brand" },
  { key: "executive", label: "Executive snapshot" },
];

/** All role summaries for the executive tab — omits empty sections. */
export function executiveRollupSections(
  result?: ScanResult | null,
): Array<{ key: ResultViewMode; label: string; text: string }> {
  const summaries = roleSummariesFromResult(result);
  if (summaries) {
    return EXECUTIVE_ROLLUP_ROLES.map(({ key, label }) => ({
      key,
      label,
      text: summaries[key]?.trim() ?? "",
    })).filter((section) => section.text.length > 0);
  }
  const fallback = buildAiSummaryParagraph(result);
  return fallback ? [{ key: "executive", label: "Summary", text: fallback }] : [];
}

export function buildAiSummaryParagraph(result?: ScanResult | null): string {
  if (result?.executive_summary?.trim()) return result.executive_summary.trim();
  const facings = totalFacings(result);
  const s = result?.summary;
  if (!s) return "";
  const recognition = recognitionCoverage(result);
  const execution = executionScore(result);
  const identifiedBrands = s.identified_brand_count ?? s.unique_brands;
  const parts = [
    `Observed ${facings} visible facings across ${s.unique_skus} visual product groups and ${identifiedBrands} identified brands.`,
  ];
  if (recognition !== undefined) {
    parts.push(`Recognition coverage among detections is ${recognition}% (not measured accuracy).`);
  }
  if (execution !== undefined) parts.push(`Execution score ${execution}/100.`);
  else parts.push("Execution score unavailable — insufficient configured KPI coverage.");
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
  if (delta === 0) return "No change vs previous audit";
  return delta > 0 ? `↑ ${delta} points vs previous audit` : `↓ ${Math.abs(delta)} points vs previous audit`;
}

export function formatConfidenceSecondary(value?: number): string | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return `${normalizeConfidence(value).toFixed(1)}% avg model confidence`;
}

/** Resolve financial impact — returns null when pricing/velocity data is insufficient. */
export function resolveFinancialImpact(result?: ScanResult | null): FinancialImpact | null {
  if (result?.financial_impact) return result.financial_impact;
  const s = result?.summary;
  const inventory = result?.inventory ?? [];
  if (!s && !inventory.length) return null;

  const confirmedOos = s?.confirmed_oos_count ?? s?.out_of_stock_products ?? 0;
  const atRisk = s?.possible_oos_count ?? s?.low_stock_products ?? 0;
  if (confirmedOos === 0 && atRisk === 0) return null;

  return {
    level: 1,
    commercial_risk: confirmedOos > 0 ? "high" : atRisk > 0 ? "medium" : "low",
    estimated_daily_lost_sales_inr: 0,
    estimated_weekly_lost_sales_inr: 0,
    estimated_monthly_lost_sales_inr: 0,
    oos_sku_count: confirmedOos,
    at_risk_sku_count: atRisk,
    methodology:
      "Financial impact cannot be estimated until sales velocity and price data are configured.",
    confidence: "indicative",
    source: "image_only",
  };
}

export function formatLostSales(amount?: number | null): string {
  if (amount === undefined || amount === null) return "—";
  return formatInr(Math.round(amount));
}
