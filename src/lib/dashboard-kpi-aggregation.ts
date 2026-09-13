/**
 * Workspace dashboard KPI aggregation — weighted rollups from real audit metrics.
 * Never average audit-level percentages when numerator/denominator exist.
 */

import type { ScoringTargets } from "@/lib/planogram-audit-package";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import type {
  AuditKpiResult,
  RetailExecutionScore,
  RetailIntelligencePayload,
} from "@/lib/retail-intelligence";
import { normalizePercent } from "@/lib/dashboard";

export type WeightedKpiRollup = {
  percent: number | null;
  numerator: number;
  denominator: number;
  eligible_audit_ids: string[];
  worst_scan_id: string | null;
};

export const KPI_TARGET_FIELD: Partial<Record<AuditKpiId, keyof ScoringTargets>> = {
  osa: "osa_target",
  planogram_compliance: "planogram_target",
  assortment_compliance: "assortment_target",
  price_compliance: "price_target",
  promotional_compliance: "promotional_target",
  msl_compliance: "msl_target",
  share_of_shelf: "share_of_shelf_target",
  location_accuracy: "location_accuracy_target",
  facing_count: "facing_target",
};

type ScanRef = { id: string; osa_percent?: number | null; planogram_compliance_percent?: number | null; share_of_shelf_percent?: number | null };

function kpiDashboard(
  metrics: RetailIntelligencePayload | null,
  role: AuditRoleTab,
): { primary_kpis: AuditKpiResult[] } | null {
  const dash =
    metrics?.audit_kpi_dashboards?.[role] ??
    (metrics?.audit_kpi_dashboard?.role_id === role ? metrics.audit_kpi_dashboard : null) ??
    metrics?.audit_kpi_dashboard;
  return dash ?? null;
}

export function kpiResultFromMetrics(
  metrics: RetailIntelligencePayload | null,
  role: AuditRoleTab,
  kpiId: AuditKpiId,
): AuditKpiResult | null {
  const dash = kpiDashboard(metrics, role);
  return dash?.primary_kpis?.find((k) => k.kpi_id === kpiId) ?? null;
}

export function scoringTargetsFromMetrics(metrics: RetailIntelligencePayload | null): ScoringTargets {
  const pkg = metrics?.audit_package as { scoring?: ScoringTargets } | undefined;
  return pkg?.scoring ?? {};
}

function planogramConfigured(metrics: RetailIntelligencePayload | null): boolean {
  const analysis = metrics?.planogram_analysis;
  return analysis?.status === "configured";
}

function scanColumnFallbackPercent(
  scan: ScanRef,
  kpiId: AuditKpiId,
): number | null {
  if (kpiId === "osa" && typeof scan.osa_percent === "number") {
    return normalizePercent(scan.osa_percent) ?? scan.osa_percent;
  }
  if (kpiId === "planogram_compliance" && typeof scan.planogram_compliance_percent === "number") {
    return normalizePercent(scan.planogram_compliance_percent) ?? scan.planogram_compliance_percent;
  }
  if (kpiId === "share_of_shelf" && typeof scan.share_of_shelf_percent === "number") {
    return normalizePercent(scan.share_of_shelf_percent) ?? scan.share_of_shelf_percent;
  }
  return null;
}

export function aggregateWeightedKpi(
  audits: ScanRef[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  role: AuditRoleTab,
  kpiId: AuditKpiId,
  options?: { requirePlanogram?: boolean },
): WeightedKpiRollup {
  let numerator = 0;
  let denominator = 0;
  const eligible: string[] = [];
  const percentFallback: Array<{ scanId: string; value: number }> = [];
  let worstScanId: string | null = null;
  let worstValue = Infinity;

  for (const scan of audits) {
    const metrics = metricsMap.get(scan.id) ?? null;
    if (options?.requirePlanogram && !planogramConfigured(metrics)) continue;

    const kpi = kpiResultFromMetrics(metrics, role, kpiId);
    if (kpi && (kpi.status === "complete" || kpi.status === "partial")) {
      const num = typeof kpi.numerator === "number" ? kpi.numerator : null;
      const den = typeof kpi.denominator === "number" ? kpi.denominator : null;
      if (num !== null && den !== null && den > 0) {
        numerator += num;
        denominator += den;
        eligible.push(scan.id);
        const pct = (num / den) * 100;
        if (pct < worstValue) {
          worstValue = pct;
          worstScanId = scan.id;
        }
        continue;
      }
      if (kpi.unit === "percent" && typeof kpi.value === "number") {
        const pct = normalizePercent(kpi.value) ?? kpi.value;
        eligible.push(scan.id);
        percentFallback.push({ scanId: scan.id, value: pct });
        if (pct < worstValue) {
          worstValue = pct;
          worstScanId = scan.id;
        }
        continue;
      }
      if (kpi.unit === "count" && typeof kpi.numerator === "number") {
        const num = kpi.numerator;
        const den = typeof kpi.denominator === "number" && kpi.denominator > 0 ? kpi.denominator : null;
        if (den !== null) {
          numerator += num;
          denominator += den;
        }
        eligible.push(scan.id);
        const pct = den ? (num / den) * 100 : num;
        if (pct < worstValue) {
          worstValue = pct;
          worstScanId = scan.id;
        }
        continue;
      }
    }

    const fallback = scanColumnFallbackPercent(scan, kpiId);
    if (fallback !== null && !options?.requirePlanogram) {
      eligible.push(scan.id);
      percentFallback.push({ scanId: scan.id, value: fallback });
      if (fallback < worstValue) {
        worstValue = fallback;
        worstScanId = scan.id;
      }
    }
  }

  if (denominator > 0) {
    return {
      percent: (numerator / denominator) * 100,
      numerator,
      denominator,
      eligible_audit_ids: eligible,
      worst_scan_id: worstScanId,
    };
  }

  if (percentFallback.length) {
    const avgPct =
      percentFallback.reduce((sum, row) => sum + row.value, 0) / percentFallback.length;
    const worst = percentFallback.reduce((a, b) => (a.value <= b.value ? a : b));
    return {
      percent: avgPct,
      numerator: 0,
      denominator: 0,
      eligible_audit_ids: eligible,
      worst_scan_id: worst.scanId,
    };
  }

  return {
    percent: null,
    numerator: 0,
    denominator: 0,
    eligible_audit_ids: [],
    worst_scan_id: null,
  };
}

export function averageConfiguredTarget(
  audits: ScanRef[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  kpiId: AuditKpiId,
): number | null {
  const field = KPI_TARGET_FIELD[kpiId];
  if (!field) return null;
  const targets: number[] = [];
  for (const scan of audits) {
    const scoring = scoringTargetsFromMetrics(metricsMap.get(scan.id) ?? null);
    const raw = scoring[field];
    if (raw != null && Number.isFinite(Number(raw))) targets.push(Number(raw));
  }
  if (!targets.length) return null;
  return targets.reduce((a, b) => a + b, 0) / targets.length;
}

export type IssueResolutionRollup = {
  rate: number | null;
  display: string;
  resolved_count: number;
  outcome_count: number;
};

const TERMINAL_ISSUE = new Set(["resolved", "verified", "closed", "fixed", "dismissed"]);
const RESOLVED_ISSUE = new Set(["resolved", "verified", "closed", "fixed"]);

export function aggregateIssueResolution(
  audits: ScanRef[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
): IssueResolutionRollup {
  let resolved = 0;
  let outcome = 0;

  for (const scan of audits) {
    const metrics = metricsMap.get(scan.id);
    const rows = [...(metrics?.opportunity_ledger ?? []), ...(metrics?.next_best_actions ?? [])];
    for (const row of rows) {
      const status = (row.status ?? "open").toLowerCase();
      if (TERMINAL_ISSUE.has(status)) {
        outcome += 1;
        if (RESOLVED_ISSUE.has(status)) resolved += 1;
      }
    }
  }

  if (outcome === 0) {
    return {
      rate: null,
      display: resolved > 0 ? "Not enough history" : "No follow-up data",
      resolved_count: resolved,
      outcome_count: 0,
    };
  }

  const rate = Math.round((resolved / outcome) * 100);
  return {
    rate,
    display: `${rate}%`,
    resolved_count: resolved,
    outcome_count: outcome,
  };
}

export type ShelfHealthRollup = {
  score: number | null;
  display: string;
  available: boolean;
  audit_count: number;
};

export function aggregateShelfHealth(
  audits: ScanRef[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
): ShelfHealthRollup {
  const scores: Array<{ score: number; weight: number }> = [];

  for (const scan of audits) {
    const metrics = metricsMap.get(scan.id);
    const exec = metrics?.retail_execution_score as RetailExecutionScore | undefined;
    if (exec?.state === "available" || exec?.state === "calculated") {
      if (typeof exec.overall === "number" && Number.isFinite(exec.overall)) {
        const weight =
          exec.components?.reduce((sum, c) => sum + (c.weight ?? 0), 0) || 1;
        scores.push({ score: exec.overall, weight });
        continue;
      }
    }
  }

  if (scores.length >= 2) {
    const totalWeight = scores.reduce((s, x) => s + x.weight, 0);
    const weighted =
      scores.reduce((s, x) => s + x.score * x.weight, 0) / (totalWeight || scores.length);
    return {
      score: Math.round(weighted),
      display: `${Math.round(weighted)}/100`,
      available: true,
      audit_count: scores.length,
    };
  }

  return {
    score: null,
    display: "Not enough data",
    available: false,
    audit_count: scores.length,
  };
}

export function formatWeightedDetail(
  rollup: WeightedKpiRollup,
  unit: "percent" | "count",
  labels?: { numerator: string; denominator: string },
): string | null {
  if (rollup.denominator > 0 && rollup.numerator >= 0) {
    const dLabel = labels?.denominator ?? "assessed";
    return `${rollup.numerator.toLocaleString()} / ${rollup.denominator.toLocaleString()} ${dLabel}`;
  }
  if (unit === "count" && rollup.eligible_audit_ids.length) {
    return `${rollup.eligible_audit_ids.length} audit${rollup.eligible_audit_ids.length === 1 ? "" : "s"}`;
  }
  if (rollup.eligible_audit_ids.length) {
    return `${rollup.eligible_audit_ids.length} audit${rollup.eligible_audit_ids.length === 1 ? "" : "s"} assessed`;
  }
  return null;
}
