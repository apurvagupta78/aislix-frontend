/**
 * Performance-over-time series — per-audit or daily weighted points from real audit KPIs.
 */

import { normalizePercent } from "@/lib/dashboard";
import { KPI_DASHBOARD_LABELS } from "@/lib/dashboard-config";
import {
  aggregateWeightedKpi,
  averageConfiguredTarget,
  kpiResultFromMetrics,
  KPI_TARGET_FIELD,
  scoringTargetsFromMetrics,
  type WeightedKpiRollup,
} from "@/lib/dashboard-kpi-aggregation";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import { roleTabLabel } from "@/lib/role-audit-ui";
import type { AuditKpiResult, RetailIntelligencePayload } from "@/lib/retail-intelligence";

type ScanRow = {
  id: string;
  created_at: string;
  store_id?: string | null;
  osa_percent?: number | null;
  planogram_compliance_percent?: number | null;
  share_of_shelf_percent?: number | null;
  stores?: { name?: string | null } | null;
};

export type PerformanceTrendChartPoint = {
  point_key: string;
  date_label: string;
  date_iso: string;
  scan_id: string | null;
  store_name: string | null;
  role_label: string | null;
  values: Partial<Record<AuditKpiId, number | null>>;
  targets: Partial<Record<AuditKpiId, number | null>>;
  variances: Partial<Record<AuditKpiId, number | null>>;
  units: Partial<Record<AuditKpiId, "percent" | "count">>;
  open_issues: number | null;
};

export type OpenIssuesTrendPoint = {
  point_key: string;
  date_label: string;
  date_iso: string;
  scan_id: string;
  store_name: string;
  count: number;
};

export type PerformancePeriodMetric = {
  kpi_id: AuditKpiId;
  label: string;
  current: number | null;
  previous: number | null;
  change: number | null;
  target: number | null;
  last_audit_value: number | null;
  variance_vs_target: number | null;
  unit: "percent" | "count";
  no_data: boolean;
  no_data_reason: string | null;
};

export type PerformanceOverTimeData = {
  audit_count: number;
  store_count: number;
  chart_points: PerformanceTrendChartPoint[];
  open_issues_points: OpenIssuesTrendPoint[];
  period_metrics: PerformancePeriodMetric[];
  configured_targets: Partial<Record<AuditKpiId, number | null>>;
  valid_trend_points: number;
};

const PER_AUDIT_MAX = 35;

function planogramConfigured(metrics: RetailIntelligencePayload | null): boolean {
  return metrics?.planogram_analysis?.status === "configured";
}

function scanRole(metrics: RetailIntelligencePayload | null): AuditRoleTab | null {
  const role = metrics?.audit_kpi_dashboard?.role_id;
  return typeof role === "string" && role.length ? (role as AuditRoleTab) : null;
}

function targetFromMetrics(
  metrics: RetailIntelligencePayload | null,
  kpiId: AuditKpiId,
): number | null {
  const field = KPI_TARGET_FIELD[kpiId];
  if (!field) return null;
  const raw = scoringTargetsFromMetrics(metrics)[field];
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  return Number(raw);
}

function kpiPointValue(
  kpi: AuditKpiResult | null,
  scan: ScanRow,
  kpiId: AuditKpiId,
): { value: number | null; unit: "percent" | "count" } {
  if (!kpi || (kpi.status !== "complete" && kpi.status !== "partial")) {
    if (kpiId === "osa" && typeof scan.osa_percent === "number") {
      return { value: normalizePercent(scan.osa_percent) ?? scan.osa_percent, unit: "percent" };
    }
    if (kpiId === "planogram_compliance" && typeof scan.planogram_compliance_percent === "number") {
      return {
        value: normalizePercent(scan.planogram_compliance_percent) ?? scan.planogram_compliance_percent,
        unit: "percent",
      };
    }
    if (kpiId === "share_of_shelf" && typeof scan.share_of_shelf_percent === "number") {
      return {
        value: normalizePercent(scan.share_of_shelf_percent) ?? scan.share_of_shelf_percent,
        unit: "percent",
      };
    }
    return { value: null, unit: kpi?.unit === "count" ? "count" : "percent" };
  }

  const num = typeof kpi.numerator === "number" ? kpi.numerator : null;
  const den = typeof kpi.denominator === "number" ? kpi.denominator : null;
  if (num !== null && den !== null && den > 0) {
    return {
      value: kpi.unit === "count" ? num : (num / den) * 100,
      unit: kpi.unit === "count" ? "count" : "percent",
    };
  }
  if (typeof kpi.value === "number") {
    return {
      value: kpi.unit === "percent" ? normalizePercent(kpi.value) ?? kpi.value : kpi.value,
      unit: kpi.unit === "count" ? "count" : "percent",
    };
  }
  return { value: null, unit: kpi.unit === "count" ? "count" : "percent" };
}

function auditKpiPoint(
  scan: ScanRow,
  metrics: RetailIntelligencePayload | null,
  role: AuditRoleTab,
  kpiId: AuditKpiId,
): { value: number | null; unit: "percent" | "count"; skipped: boolean } {
  if (kpiId === "planogram_compliance" && !planogramConfigured(metrics)) {
    return { value: null, unit: "percent", skipped: true };
  }
  if (kpiId === "share_of_shelf") {
    const kpi = kpiResultFromMetrics(metrics, role, kpiId);
    const hasSpace =
      kpi &&
      (kpi.status === "complete" || kpi.status === "partial") &&
      (typeof kpi.numerator === "number" || typeof kpi.value === "number");
    const brandShare = metrics?.share_of_facings ?? metrics?.linear_shelf_share;
    const fallback =
      typeof scan.share_of_shelf_percent === "number"
        ? scan.share_of_shelf_percent
        : brandShare && typeof brandShare === "object" && "value" in brandShare
          ? (brandShare as { value?: number }).value
          : null;
    if (!hasSpace && fallback === null) {
      return { value: null, unit: "percent", skipped: true };
    }
  }
  const kpi = kpiResultFromMetrics(metrics, role, kpiId);
  const { value, unit } = kpiPointValue(kpi, scan, kpiId);
  return { value, unit, skipped: false };
}

function countOpenIssues(metrics: RetailIntelligencePayload | null): number {
  const open = (rows: Array<{ status?: string }>) =>
    rows.filter((r) => {
      const st = (r.status ?? "open").toLowerCase();
      return st !== "resolved" && st !== "verified" && st !== "dismissed" && st !== "closed" && st !== "fixed";
    }).length;
  return open(metrics?.opportunity_ledger ?? []) + open(metrics?.next_best_actions ?? []);
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }).toUpperCase();
}

function formatAuditLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function rollupToDisplay(rollup: WeightedKpiRollup, unit: "percent" | "count"): number | null {
  if (rollup.denominator > 0) {
    return unit === "count" ? rollup.numerator : rollup.percent;
  }
  return rollup.percent;
}

function buildAuditPoint(
  scan: ScanRow,
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  role: AuditRoleTab,
  kpiIds: AuditKpiId[],
): PerformanceTrendChartPoint {
  const metrics = metricsMap.get(scan.id) ?? null;
  const auditRole = scanRole(metrics) ?? role;
  const values: Partial<Record<AuditKpiId, number | null>> = {};
  const targets: Partial<Record<AuditKpiId, number | null>> = {};
  const variances: Partial<Record<AuditKpiId, number | null>> = {};
  const units: Partial<Record<AuditKpiId, "percent" | "count">> = {};

  for (const kpiId of kpiIds) {
    const { value, unit } = auditKpiPoint(scan, metrics, auditRole, kpiId);
    values[kpiId] = value;
    units[kpiId] = unit;
    const target = targetFromMetrics(metrics, kpiId);
    targets[kpiId] = target;
    variances[kpiId] =
      value !== null && target !== null ? Math.round((value - target) * 10) / 10 : null;
  }

  return {
    point_key: scan.id,
    date_label: formatAuditLabel(scan.created_at),
    date_iso: scan.created_at,
    scan_id: scan.id,
    store_name: scan.stores?.name ?? "—",
    role_label: roleTabLabel(auditRole),
    values,
    targets,
    variances,
    units,
    open_issues: countOpenIssues(metrics),
  };
}

function buildDailyPoint(
  day: string,
  dayScans: ScanRow[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  role: AuditRoleTab,
  kpiIds: AuditKpiId[],
): PerformanceTrendChartPoint {
  const latest = dayScans[dayScans.length - 1]!;
  const values: Partial<Record<AuditKpiId, number | null>> = {};
  const targets: Partial<Record<AuditKpiId, number | null>> = {};
  const variances: Partial<Record<AuditKpiId, number | null>> = {};
  const units: Partial<Record<AuditKpiId, "percent" | "count">> = {};
  const targetSamples: Partial<Record<AuditKpiId, number[]>> = {};

  for (const kpiId of kpiIds) {
    const rollup = aggregateWeightedKpi(dayScans, metricsMap, role, kpiId, {
      requirePlanogram: kpiId === "planogram_compliance",
    });
    const kpi = kpiResultFromMetrics(metricsMap.get(latest.id) ?? null, role, kpiId);
    const unit = kpi?.unit === "count" ? "count" : "percent";
    units[kpiId] = unit;
    values[kpiId] =
      rollup.eligible_audit_ids.length > 0 ? rollupToDisplay(rollup, unit) : null;
    if (values[kpiId] !== null && typeof values[kpiId] === "number") {
      values[kpiId] = Math.round(values[kpiId]! * 10) / 10;
    }

    for (const s of dayScans) {
      const t = targetFromMetrics(metricsMap.get(s.id) ?? null, kpiId);
      if (t !== null) {
        targetSamples[kpiId] = [...(targetSamples[kpiId] ?? []), t];
      }
    }
    const avgTarget = targetSamples[kpiId]?.length
      ? targetSamples[kpiId]!.reduce((a, b) => a + b, 0) / targetSamples[kpiId]!.length
      : null;
    targets[kpiId] = avgTarget !== null ? Math.round(avgTarget * 10) / 10 : null;
    variances[kpiId] =
      values[kpiId] !== null && targets[kpiId] !== null
        ? Math.round((values[kpiId]! - targets[kpiId]!) * 10) / 10
        : null;
  }

  let issues = 0;
  for (const s of dayScans) {
    issues += countOpenIssues(metricsMap.get(s.id) ?? null);
  }

  const storeNames = new Set(dayScans.map((s) => s.stores?.name).filter(Boolean));
  return {
    point_key: day,
    date_label: formatDayLabel(day),
    date_iso: latest.created_at,
    scan_id: dayScans.length === 1 ? latest.id : null,
    store_name: storeNames.size === 1 ? [...storeNames][0]! : `${storeNames.size} stores`,
    role_label: roleTabLabel(role),
    values,
    targets,
    variances,
    units,
    open_issues: issues,
  };
}

function buildPeriodMetrics(
  audits: ScanRow[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  role: AuditRoleTab,
  kpiIds: AuditKpiId[],
): PerformancePeriodMetric[] {
  if (audits.length < 2) return [];
  const mid = Math.floor(audits.length / 2);
  const previous = audits.slice(0, mid);
  const current = audits.slice(mid);

  return kpiIds.map((kpiId) => {
    const prevRollup = aggregateWeightedKpi(previous, metricsMap, role, kpiId, {
      requirePlanogram: kpiId === "planogram_compliance",
    });
    const currRollup = aggregateWeightedKpi(current, metricsMap, role, kpiId, {
      requirePlanogram: kpiId === "planogram_compliance",
    });
    const kpi = kpiResultFromMetrics(metricsMap.get(audits[audits.length - 1]!.id) ?? null, role, kpiId);
    const unit = kpi?.unit === "count" ? "count" : "percent";
    const prevVal = rollupToDisplay(prevRollup, unit);
    const currVal = rollupToDisplay(currRollup, unit);
    const roundedPrev = prevVal !== null ? Math.round(prevVal) : null;
    const roundedCurr = currVal !== null ? Math.round(currVal) : null;
    const change =
      roundedPrev !== null && roundedCurr !== null ? roundedCurr - roundedPrev : null;

    const lastScan = [...audits].reverse().find((s) => {
      const { value } = auditKpiPoint(s, metricsMap.get(s.id) ?? null, role, kpiId);
      return value !== null;
    });
    const lastMetrics = lastScan ? metricsMap.get(lastScan.id) ?? null : null;
    const lastPoint = lastScan
      ? auditKpiPoint(lastScan, lastMetrics, role, kpiId)
      : { value: null, unit: "percent" as const };
    const target = averageConfiguredTarget(audits, metricsMap, kpiId);
    const lastVal =
      lastPoint.value !== null ? Math.round(lastPoint.value) : null;
    const variance =
      lastVal !== null && target !== null ? Math.round(lastVal - target) : null;

    const noData = currRollup.eligible_audit_ids.length === 0;
    let noDataReason: string | null = null;
    if (noData && kpiId === "planogram_compliance") {
      noDataReason = "No planogram audits in view";
    } else if (noData && kpiId === "share_of_shelf") {
      noDataReason = "Not enough shelf-space data";
    } else if (noData) {
      noDataReason = "Not enough audits";
    }

    return {
      kpi_id: kpiId,
      label: KPI_DASHBOARD_LABELS[kpiId],
      current: roundedCurr,
      previous: roundedPrev,
      change,
      target: target !== null ? Math.round(target) : null,
      last_audit_value: lastVal,
      variance_vs_target: variance,
      unit,
      no_data: noData,
      no_data_reason: noDataReason,
    };
  });
}

export function buildPerformanceOverTime(
  audits: ScanRow[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  role: AuditRoleTab,
  kpiIds: AuditKpiId[],
): PerformanceOverTimeData {
  const storeIds = new Set(audits.map((s) => s.store_id).filter(Boolean));
  const configured_targets: Partial<Record<AuditKpiId, number | null>> = {};
  for (const kpiId of kpiIds) {
    configured_targets[kpiId] = averageConfiguredTarget(audits, metricsMap, kpiId);
    if (configured_targets[kpiId] !== null) {
      configured_targets[kpiId] = Math.round(configured_targets[kpiId]!);
    }
  }

  const chart_points: PerformanceTrendChartPoint[] =
    audits.length <= PER_AUDIT_MAX
      ? audits.map((scan) => buildAuditPoint(scan, metricsMap, role, kpiIds))
      : (() => {
          const byDay = new Map<string, ScanRow[]>();
          for (const scan of audits) {
            const key = dayKey(scan.created_at);
            byDay.set(key, [...(byDay.get(key) ?? []), scan]);
          }
          return [...byDay.keys()]
            .sort()
            .map((day) => buildDailyPoint(day, byDay.get(day)!, metricsMap, role, kpiIds));
        })();

  const open_issues_points: OpenIssuesTrendPoint[] = audits.map((scan) => ({
    point_key: scan.id,
    date_label: formatAuditLabel(scan.created_at),
    date_iso: scan.created_at,
    scan_id: scan.id,
    store_name: scan.stores?.name ?? "—",
    count: countOpenIssues(metricsMap.get(scan.id) ?? null),
  }));

  const valid_trend_points = chart_points.filter((p) =>
    kpiIds.some((k) => p.values[k] !== null && p.values[k] !== undefined),
  ).length;

  return {
    audit_count: audits.length,
    store_count: storeIds.size,
    chart_points,
    open_issues_points,
    period_metrics: buildPeriodMetrics(audits, metricsMap, role, kpiIds),
    configured_targets,
    valid_trend_points,
  };
}

/** Whether higher values indicate improvement for trend arrows. */
export function kpiHigherIsBetter(kpiId: AuditKpiId): boolean {
  return true;
}

export function formatTrendValue(value: number | null, unit: "percent" | "count"): string {
  if (value === null) return "No data";
  return unit === "percent" ? `${Math.round(value)}%` : String(Math.round(value));
}

export function varianceArrow(
  variance: number | null,
  higherIsBetter: boolean,
): "up" | "down" | "flat" | null {
  if (variance === null || variance === 0) return variance === 0 ? "flat" : null;
  const positive = variance > 0;
  if (higherIsBetter) return positive ? "up" : "down";
  return positive ? "down" : "up";
}
