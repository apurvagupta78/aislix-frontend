/**
 * Retail execution metric states and renormalized scoring.
 * Never treat missing configuration as 0% performance.
 */

import type { MetricState, RetailExecutionScore, ScoreComponent } from "@/lib/retail-intelligence";
import type { ScanResult } from "@/lib/scan-results";
import { formatPercent } from "@/lib/scan-results";

const SCORE_WEIGHTS_WITH_PLANO: Record<string, number> = {
  availability: 30,
  planogram: 25,
  facing: 25,
  placement: 20,
};

const SCORE_WEIGHTS_NO_PLANO: Record<string, number> = {
  availability: 35,
  facing: 35,
  placement: 30,
};

export type KpiMetric = {
  key: string;
  label: string;
  value: string;
  numeric?: number;
  state: MetricState;
};

export function planogramIsConfigured(result?: ScanResult | null): boolean {
  if (!result) return false;
  if (result.planogram?.requested) return true;
  const summary = result.planogram?.summary as { configured_rows?: unknown[] } | undefined;
  return Array.isArray(summary?.configured_rows) && summary.configured_rows.length > 0;
}

export function assortmentIsConfigured(result?: ScanResult | null): boolean {
  return planogramIsConfigured(result);
}

function displayForState(state: MetricState, formatted?: string): string {
  if (state === "not_configured") return "Not configured";
  if (state === "insufficient_evidence") return "Insufficient evidence";
  if (state === "not_applicable") return "Not applicable";
  if (state === "unavailable") return "Unavailable";
  if (formatted) return formatted;
  return "—";
}

function resolvePercentMetric(
  key: string,
  label: string,
  value: number | undefined | null,
  opts: { configured: boolean; hasEvidence: boolean },
): KpiMetric {
  if (!opts.configured) {
    return { key, label, value: "Not configured", state: "not_configured" };
  }
  if (!opts.hasEvidence || value === undefined || value === null || !Number.isFinite(value)) {
    return { key, label, value: "Insufficient evidence", state: "insufficient_evidence" };
  }
  return {
    key,
    label,
    value: formatPercent(value) ?? `${Math.round(value)}%`,
    numeric: value,
    state: "available",
  };
}

/** Build KPI strip with explicit metric states (no false zeros). */
export function buildKpiMetrics(result?: ScanResult | null): KpiMetric[] {
  const s = result?.summary;
  const hasInventory = (result?.inventory?.length ?? 0) > 0;
  const hasFacings = (s?.total_facings ?? s?.total_products ?? 0) > 0;
  const planoConfigured = planogramIsConfigured(result);
  const assortmentConfigured = assortmentIsConfigured(result);

  const availabilityPct = s?.availability_percent ?? s?.osa_percent;
  const availability = assortmentConfigured
    ? resolvePercentMetric("availability", "Availability", availabilityPct, {
        configured: true,
        hasEvidence: hasInventory,
      })
    : hasInventory && availabilityPct !== undefined
      ? {
          key: "availability",
          label: "Availability",
          value: formatPercent(availabilityPct) ?? "—",
          numeric: availabilityPct,
          state: "estimated" as MetricState,
        }
      : {
          key: "availability",
          label: "SKU Availability",
          value: "Target assortment not configured",
          state: "not_configured" as MetricState,
        };

  const planoPct =
    result?.planogram?.sku_match_percent ??
    result?.planogram?.percent ??
    s?.shelf_compliance;
  const planogram = resolvePercentMetric("planogram", "Planogram", planoPct, {
    configured: planoConfigured,
    hasEvidence: planoConfigured && planoPct !== undefined && planoPct !== null,
  });

  const kpis: KpiMetric[] = [availability, planogram];

  if (s?.brand_share_percent !== undefined && Number.isFinite(s.brand_share_percent)) {
    kpis.push({
      key: "share_of_facings",
      label: "Share of facings",
      value: formatPercent(s.brand_share_percent) ?? "—",
      numeric: s.brand_share_percent,
      state: "available",
    });
  }
  if (s?.product_share_percent !== undefined && Number.isFinite(s.product_share_percent)) {
    kpis.push({
      key: "product_share",
      label: "Product share",
      value: formatPercent(s.product_share_percent) ?? "—",
      numeric: s.product_share_percent,
      state: "available",
    });
  }

  const facingPct = s?.facing_compliance_percent;
  kpis.push(
    resolvePercentMetric("facing", "Facing compliance", facingPct, {
      configured: hasFacings,
      hasEvidence: hasFacings && facingPct !== undefined,
    }),
  );

  const placementPct = s?.placement_compliance_percent;
  kpis.push(
    resolvePercentMetric("placement", "Placement", placementPct, {
      configured: hasFacings,
      hasEvidence: hasFacings && placementPct !== undefined,
    }),
  );

  return kpis;
}

function componentFromMetric(
  key: string,
  label: string,
  weight: number,
  metric: KpiMetric,
): ScoreComponent {
  return {
    key,
    label,
    score: metric.numeric ?? null,
    state: metric.state,
    weight,
  };
}

/** Renormalize execution score — only configured, evidence-backed KPIs contribute. */
export function computeRetailExecutionScore(result?: ScanResult | null): RetailExecutionScore {
  const structured = result?.retail_intelligence?.retail_execution_score;
  if (structured?.components?.length && structured.overall != null) {
    return structured;
  }

  const kpis = buildKpiMetrics(result);
  const byKey = Object.fromEntries(kpis.map((k) => [k.key, k]));
  const planoConfigured = planogramIsConfigured(result);
  const weights = planoConfigured ? SCORE_WEIGHTS_WITH_PLANO : SCORE_WEIGHTS_NO_PLANO;

  const components: ScoreComponent[] = [];
  if (byKey.availability?.state === "available" || byKey.availability?.state === "estimated") {
    components.push(
      componentFromMetric("availability", "Availability", weights.availability, byKey.availability),
    );
  }
  if (planoConfigured && byKey.planogram?.state === "available") {
    components.push(componentFromMetric("planogram", "Planogram", weights.planogram, byKey.planogram));
  }
  if (byKey.facing?.state === "available") {
    components.push(componentFromMetric("facing", "Facing", weights.facing, byKey.facing));
  }
  if (byKey.placement?.state === "available") {
    components.push(
      componentFromMetric("placement", "Placement", weights.placement, byKey.placement),
    );
  }

  const scorable = components.filter(
    (c) =>
      (c.state === "available" || c.state === "calculated" || c.state === "estimated") &&
      c.score !== null &&
      Number.isFinite(c.score),
  );

  if (!scorable.length) {
    return { overall: null, state: "not_configured", components };
  }

  const totalWeight = scorable.reduce((n, c) => n + (c.weight ?? 0), 0);
  if (totalWeight <= 0) {
    return { overall: null, state: "insufficient_evidence", components };
  }

  const overall = Math.round(
    scorable.reduce((sum, c) => sum + (c.score as number) * ((c.weight ?? 0) / totalWeight), 0),
  );

  return { overall, state: "available", components: scorable };
}

export function executionScoreFromResult(result?: ScanResult | null): number | undefined {
  const computed = computeRetailExecutionScore(result);
  if (computed.overall != null && computed.state !== "not_configured") {
    return computed.overall;
  }
  const legacy = result?.summary?.shelf_execution_score ?? result?.summary?.shelf_health_score;
  return legacy !== undefined && Number.isFinite(legacy) ? Math.round(legacy) : undefined;
}

export function formatKpiValue(metric: KpiMetric): string {
  return displayForState(metric.state, metric.value !== "—" ? metric.value : undefined);
}
