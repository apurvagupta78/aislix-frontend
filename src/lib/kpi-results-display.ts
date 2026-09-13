/**
 * Audit results KPI strip — display helpers only (no calculation changes).
 */

import type { ScoringTargets } from "@/lib/planogram-audit-package";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import type { KpiMetric } from "@/lib/execution-metrics";

const KPI_TARGET_KEY: Partial<Record<AuditKpiId, keyof ScoringTargets>> = {
  osa: "osa_target",
  planogram_compliance: "planogram_target",
  assortment_compliance: "assortment_target",
  price_compliance: "price_target",
  promotional_compliance: "promotional_target",
  msl_compliance: "msl_target",
  share_of_shelf: "share_of_shelf_target",
};

export const KPI_DISPLAY_LABEL: Record<AuditKpiId, string> = {
  osa: "On-Shelf Availability",
  location_accuracy: "Location Accuracy",
  planogram_compliance: "Planogram Compliance",
  assortment_compliance: "Assortment Compliance",
  facing_count: "Facing Count",
  share_of_shelf: "Share of Shelf",
  price_compliance: "Price Compliance",
  promotional_compliance: "Promotional Compliance",
  msl_compliance: "Must-Stock Compliance",
};

const KPI_ACCENT_BORDER: Record<string, string> = {
  osa: "border-l-brand",
  location_accuracy: "border-l-brand/80",
  planogram_compliance: "border-l-brand/70",
  assortment_compliance: "border-l-brand/60",
  facing_count: "border-l-brand/50",
  share_of_shelf: "border-l-brand",
  price_compliance: "border-l-brand/70",
  promotional_compliance: "border-l-brand/60",
  msl_compliance: "border-l-brand/70",
};

export type EnrichedKpiMetric = KpiMetric & {
  display_label: string;
  display_value: string;
  plain_english?: string;
  progress_percent: number | null;
  target_percent: number | null;
  target_delta_pts: number | null;
  target_line: string;
  coverage_display: string | null;
  accent_border: string;
  facing_observed?: number;
  facing_planned?: number;
  facing_of_planned_label?: string;
};

export function scoringFromResult(result?: {
  retail_intelligence?: { audit_package?: { scoring?: ScoringTargets } };
} | null): ScoringTargets {
  return result?.retail_intelligence?.audit_package?.scoring ?? {};
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatCoverage(coverage_percent?: number | null, excluded_count?: number): string | null {
  const parts: string[] = [];
  if (coverage_percent != null && Number.isFinite(coverage_percent)) {
    parts.push(`Coverage ${Math.round(coverage_percent)}%`);
  }
  if (excluded_count && excluded_count > 0) {
    parts.push(`${excluded_count} not assessable`);
  }
  return parts.length ? parts.join(" · ") : null;
}

function formatTargetLine(target: number | null, delta: number | null, unit: "percent" | "count"): string {
  if (target == null || unit !== "percent") return "Target not configured";
  if (delta == null) return `Target ${Math.round(target)}%`;
  const sign = delta >= 0 ? "+" : "";
  return `Target ${Math.round(target)}% · ${sign}${delta} pts`;
}

export function enrichKpiMetric(
  metric: KpiMetric,
  scoring: ScoringTargets,
  plainEnglish?: string,
): EnrichedKpiMetric {
  const kpiId = metric.key as AuditKpiId;
  const targetKey = KPI_TARGET_KEY[kpiId];
  const rawTarget = targetKey ? scoring[targetKey] : undefined;
  const target_percent =
    rawTarget != null && Number.isFinite(Number(rawTarget)) ? Number(rawTarget) : null;

  let display_value = metric.value;
  let progress_percent: number | null = null;
  let target_delta_pts: number | null = null;
  let facing_observed: number | undefined;
  let facing_planned: number | undefined;
  let facing_of_planned_label: string | undefined;

  if (metric.unit === "percent" && metric.numeric != null && Number.isFinite(metric.numeric)) {
    progress_percent = clampPercent(metric.numeric);
    display_value = `${Math.round(metric.numeric)}%`;
    if (target_percent != null) {
      target_delta_pts = Math.round(metric.numeric - target_percent);
    }
  } else if (metric.unit === "count" && metric.value != null) {
    const observed = metric.numerator ?? null;
    const planned = metric.denominator ?? null;
    if (observed != null && planned != null && planned > 0) {
      facing_observed = observed;
      facing_planned = planned;
      display_value = `${observed} / ${planned}`;
      progress_percent = clampPercent((observed / planned) * 100);
      facing_of_planned_label = `${Math.round(progress_percent)}% of planned`;
    }
  } else if (metric.numeric != null && Number.isFinite(metric.numeric)) {
    progress_percent = clampPercent(metric.numeric);
  }

  const excluded = (metric as KpiMetric & { excluded_count?: number }).excluded_count;

  return {
    ...metric,
    display_label: KPI_DISPLAY_LABEL[kpiId] ?? metric.label.replace(/\s*\(OSA\)\s*/i, "").trim(),
    display_value,
    plain_english: plainEnglish,
    progress_percent,
    target_percent,
    target_delta_pts,
    target_line: formatTargetLine(target_percent, target_delta_pts, metric.unit ?? "percent"),
    coverage_display: formatCoverage(metric.coverage_percent, excluded),
    accent_border: KPI_ACCENT_BORDER[metric.key] ?? "border-l-brand/40",
    facing_observed,
    facing_planned,
    facing_of_planned_label,
  };
}

export function enrichKpiMetrics(
  metrics: KpiMetric[],
  scoring: ScoringTargets,
  plainEnglishFor: (key: string) => string | undefined,
): EnrichedKpiMetric[] {
  return metrics.map((m) => enrichKpiMetric(m, scoring, plainEnglishFor(m.key)));
}
