/**
 * Retail execution metric states and renormalized scoring.
 * Never treat missing configuration as 0% performance.
 */

import type { PlanogramRow } from "@/lib/planogram";
import type { MetricState, RetailExecutionScore, ScoreComponent } from "@/lib/retail-intelligence";
import type { ScanResult } from "@/lib/scan-results";
import { formatPercent } from "@/lib/scan-results";

/** Default execution-score weights (renormalized when KPIs are unavailable). */
const SCORE_WEIGHTS: Record<string, number> = {
  availability: 25,
  planogram: 20,
  facing: 15,
  placement: 15,
  share_of_facings: 10,
  price: 5,
  promotion: 5,
  presentability: 5,
};

/** Minimum fraction of planned score weight required (matches backend 80% gate). */
const MIN_SCORE_COVERAGE_FRACTION = 0.8;
const PLANNED_SCORE_WEIGHT = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
const MIN_SCORE_COVERAGE_WEIGHT = PLANNED_SCORE_WEIGHT * MIN_SCORE_COVERAGE_FRACTION;

const UNCLASSIFIED_BRANDS = new Set(["", "unknown", "unidentified", "unclassified"]);

export type KpiMetric = {
  key: string;
  label: string;
  value: string;
  numeric?: number;
  state: MetricState;
  detail?: string;
};

export type PlanogramSummaryShape = {
  configured_rows?: PlanogramRow[];
  expected_sku_count?: number;
  correct?: number;
  missing?: number;
  wrong_product?: number;
  qty_short?: number;
};

export function planogramRowsFromResult(result?: ScanResult | null): PlanogramRow[] {
  const summary = result?.planogram?.summary as PlanogramSummaryShape | undefined;
  return Array.isArray(summary?.configured_rows) ? summary.configured_rows : [];
}

export function planogramIsConfigured(result?: ScanResult | null): boolean {
  if (!result) return false;
  if (result.planogram?.requested) return true;
  return planogramRowsFromResult(result).length > 0;
}

export function hasExplicitExpectedFacings(rows: PlanogramRow[]): boolean {
  return rows.some(
    (r) => r.expected_facings != null && Number.isFinite(Number(r.expected_facings)) && Number(r.expected_facings) >= 0,
  );
}

export function hasPlacementRules(rows: PlanogramRow[]): boolean {
  return rows.some(
    (r) =>
      String(r.shelf_position ?? "").trim().length > 0 ||
      String(r.expected_shelf_level ?? "").trim().length > 0 ||
      String(r.expected_position ?? "").trim().length > 0,
  );
}

export function hasFullPlanogramRules(rows: PlanogramRow[]): boolean {
  return hasExplicitExpectedFacings(rows) && hasPlacementRules(rows);
}

export function expectedFacingsForRow(row: PlanogramRow): number | null {
  if (row.expected_facings != null && Number.isFinite(Number(row.expected_facings))) {
    return Math.max(0, Number(row.expected_facings));
  }
  return null;
}

function planogramSummary(result?: ScanResult | null): PlanogramSummaryShape {
  return (result?.planogram?.summary as PlanogramSummaryShape | undefined) ?? {};
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
  opts: { configured: boolean; hasEvidence: boolean; detail?: string },
): KpiMetric {
  if (!opts.configured) {
    return { key, label, value: "Not configured", state: "not_configured", detail: opts.detail };
  }
  if (!opts.hasEvidence || value === undefined || value === null || !Number.isFinite(value)) {
    return {
      key,
      label,
      value: "Insufficient evidence",
      state: "insufficient_evidence",
      detail: opts.detail,
    };
  }
  return {
    key,
    label,
    value: formatPercent(value) ?? `${Math.round(value)}%`,
    numeric: value,
    state: "available",
    detail: opts.detail,
  };
}

function targetSkuAvailabilityMetric(result?: ScanResult | null): KpiMetric {
  const rows = planogramRowsFromResult(result);
  if (!rows.length) {
    return {
      key: "target_sku_availability",
      label: "Target SKU availability",
      value: "Not configured",
      state: "not_configured",
      detail: "Configure a planogram or target assortment to measure SKU availability.",
    };
  }

  const summary = planogramSummary(result);
  const expected = summary.expected_sku_count ?? rows.length;
  const missing = summary.missing ?? 0;
  const detected = Math.max(0, expected - missing);
  const pct = Math.round((detected / Math.max(expected, 1)) * 100);

  return {
    key: "target_sku_availability",
    label: "Target SKU availability",
    value: `${detected}/${expected} — ${pct}%`,
    numeric: pct,
    state: "available",
    detail: `${detected} of ${expected} configured target SKU(s) detected on the audited shelf.`,
  };
}

function categoryOsaMetric(result?: ScanResult | null): KpiMetric {
  const assortmentConfigured = Boolean(
    (result?.retail_intelligence?.assortment as { state?: string } | undefined)?.state === "available",
  );
  if (!assortmentConfigured) {
    return {
      key: "category_osa",
      label: "Category OSA",
      value: "Not configured",
      state: "not_configured",
      detail: "Configure the full category assortment to measure on-shelf availability.",
    };
  }
  const pct = result?.summary?.availability_percent ?? result?.summary?.osa_percent;
  return resolvePercentMetric("category_osa", "Category OSA", pct, {
    configured: true,
    hasEvidence: pct !== undefined && pct !== null,
  });
}

function planogramMetrics(result?: ScanResult | null): KpiMetric[] {
  const rows = planogramRowsFromResult(result);
  const configured = planogramIsConfigured(result);
  if (!configured) {
    return [
      {
        key: "planogram",
        label: "Planogram",
        value: "Not configured",
        state: "not_configured",
      },
    ];
  }

  const summary = planogramSummary(result);
  const expected = summary.expected_sku_count ?? rows.length;
  const missing = summary.missing ?? 0;
  const detected = Math.max(0, expected - missing);
  const presencePct =
    result?.planogram?.sku_match_percent ??
    result?.planogram?.percent ??
    Math.round((detected / Math.max(expected, 1)) * 100);

  const presence: KpiMetric = {
    key: "planogram_sku_presence",
    label: "Planogram SKU presence",
    value: `${detected}/${expected} — ${Math.round(presencePct ?? 0)}%`,
    numeric: presencePct ?? undefined,
    state: "available",
    detail: "SKU presence only — facing and placement rules not fully configured.",
  };

  if (hasFullPlanogramRules(rows)) {
    const compliancePct =
      result?.planogram?.qty_compliance_percent ??
      result?.summary?.shelf_compliance ??
      presencePct;
    return [
      presence,
      resolvePercentMetric("planogram_compliance", "Planogram compliance", compliancePct, {
        configured: true,
        hasEvidence: compliancePct !== undefined && compliancePct !== null,
      }),
    ];
  }

  return [
    presence,
    {
      key: "planogram_compliance",
      label: "Planogram compliance",
      value: "Not scoreable",
      state: "not_configured",
      detail: "Expected facings and shelf placement rules are required for full planogram compliance.",
    },
  ];
}

/** Build KPI strip with explicit metric states (no false zeros). */
export function buildKpiMetrics(result?: ScanResult | null): KpiMetric[] {
  const s = result?.summary;
  const rows = planogramRowsFromResult(result);
  const hasFacings = (s?.total_facings ?? s?.total_products ?? 0) > 0;
  const facingConfigured = hasExplicitExpectedFacings(rows);
  const placementConfigured = hasPlacementRules(rows);

  const kpis: KpiMetric[] = [
    targetSkuAvailabilityMetric(result),
    categoryOsaMetric(result),
    ...planogramMetrics(result),
  ];

  if (s?.brand_share_percent !== undefined && Number.isFinite(s.brand_share_percent)) {
    const denom = s.brand_share_denominator;
    const scopeLabel =
      s.brand_share_scope === "eligible_category" ? "eligible category" : "full image";
    const denomNote =
      denom != null && Number.isFinite(denom)
        ? ` (${formatPercent(s.brand_share_percent) ?? s.brand_share_percent}% · ${denom} ${scopeLabel} facings)`
        : ` (${scopeLabel})`;
    kpis.push({
      key: "share_of_facings",
      label: "Share of facings",
      value: `${formatPercent(s.brand_share_percent) ?? s.brand_share_percent}%${denomNote}`,
      numeric: s.brand_share_percent,
      state: "available",
      detail: s.brand_share_denominator_definition,
    });
  }

  if (s?.product_share_percent !== undefined && Number.isFinite(s.product_share_percent)) {
    kpis.push({
      key: "product_share",
      label: "Product share of facings",
      value: formatPercent(s.product_share_percent) ?? "—",
      numeric: s.product_share_percent,
      state: "available",
    });
  }

  kpis.push(
    facingConfigured
      ? resolvePercentMetric("facing", "Facing compliance", s?.facing_compliance_percent, {
          configured: true,
          hasEvidence: hasFacings && s?.facing_compliance_percent !== undefined,
        })
      : {
          key: "facing",
          label: "Facing compliance",
          value: "Not configured",
          state: "not_configured",
          detail: "Set expected facings on planogram rows to measure facing compliance.",
        },
  );

  kpis.push(
    placementConfigured
      ? resolvePercentMetric("placement", "Placement", s?.placement_compliance_percent, {
          configured: true,
          hasEvidence: hasFacings && s?.placement_compliance_percent !== undefined,
        })
      : {
          key: "placement",
          label: "Placement",
          value: "Not scoreable",
          state: "not_configured",
          detail: "Shelf level and position rules are not configured.",
        },
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

function scoreCoverageReason(components: ScoreComponent[], scorable: ScoreComponent[]): string | undefined {
  if (!scorable.length) {
    return "Score withheld — no configured execution KPIs with sufficient evidence.";
  }
  const excludedLabels = components
    .filter((c) => !scorable.some((s) => s.key === c.key))
    .map((c) => c.label);
  if (excludedLabels.length) {
    return `Weights renormalized across ${scorable.length} KPI(s). Excluded: ${excludedLabels.join(", ")}.`;
  }
  return undefined;
}

/** Renormalize execution score — only configured, evidence-backed KPIs contribute. */
export function computeRetailExecutionScore(result?: ScanResult | null): RetailExecutionScore {
  const kpis = buildKpiMetrics(result);
  const byKey = Object.fromEntries(kpis.map((k) => [k.key, k]));

  const components: ScoreComponent[] = [];

  const targetAvail = byKey.target_sku_availability;
  if (targetAvail?.state === "available" && targetAvail.numeric != null) {
    components.push(
      componentFromMetric("availability", "Target SKU availability", SCORE_WEIGHTS.availability, targetAvail),
    );
  }

  const planoCompliance = byKey.planogram_compliance;
  const planoPresence = byKey.planogram_sku_presence;
  if (planoCompliance?.state === "available" && planoCompliance.numeric != null) {
    components.push(
      componentFromMetric("planogram", "Planogram compliance", SCORE_WEIGHTS.planogram, planoCompliance),
    );
  } else if (planoPresence?.state === "available" && planoPresence.numeric != null) {
    components.push(
      componentFromMetric(
        "planogram_sku_presence",
        "Planogram SKU presence",
        SCORE_WEIGHTS.planogram,
        planoPresence,
      ),
    );
  }

  const facing = byKey.facing;
  if (facing?.state === "available" && facing.numeric != null) {
    components.push(componentFromMetric("facing", "Facing compliance", SCORE_WEIGHTS.facing, facing));
  }

  const placement = byKey.placement;
  if (placement?.state === "available" && placement.numeric != null) {
    components.push(componentFromMetric("placement", "Placement", SCORE_WEIGHTS.placement, placement));
  }

  const share = byKey.share_of_facings;
  if (share?.state === "available" && share.numeric != null) {
    components.push(
      componentFromMetric("share_of_facings", "Share of facings", SCORE_WEIGHTS.share_of_facings, share),
    );
  }

  const scorable = components.filter(
    (c) =>
      (c.state === "available" || c.state === "calculated" || c.state === "estimated") &&
      c.score !== null &&
      Number.isFinite(c.score),
  );

  const nominalWeight = scorable.reduce((n, c) => n + (c.weight ?? 0), 0);

  if (!scorable.length || nominalWeight < MIN_SCORE_COVERAGE_WEIGHT) {
    return {
      overall: null,
      state: scorable.length ? "insufficient_evidence" : "not_configured",
      components,
      withhold_reason:
        nominalWeight < MIN_SCORE_COVERAGE_WEIGHT
          ? "Score withheld because expected facings, placement rules, or assortment coverage are insufficient."
          : "Score withheld — no configured execution KPIs with sufficient evidence.",
    };
  }

  const totalWeight = scorable.reduce((n, c) => n + (c.weight ?? 0), 0);
  const overall = Math.round(
    scorable.reduce((sum, c) => sum + (c.score as number) * ((c.weight ?? 0) / totalWeight), 0),
  );

  return {
    overall,
    state: "available",
    components: scorable,
    withhold_reason: scoreCoverageReason(components, scorable),
  };
}

/** Never fall back to legacy shelf_health_score (includes AI confidence). */
export function executionScoreFromResult(result?: ScanResult | null): number | undefined {
  const computed = computeRetailExecutionScore(result);
  if (computed.overall != null && computed.state === "available") {
    return computed.overall;
  }
  return undefined;
}

export function formatKpiValue(metric: KpiMetric): string {
  return displayForState(metric.state, metric.value !== "—" ? metric.value : undefined);
}

export function isUnclassifiedBrand(brand: string): boolean {
  return UNCLASSIFIED_BRANDS.has(brand.trim().toLowerCase());
}
