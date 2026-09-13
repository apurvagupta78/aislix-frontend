/**
 * KPI "How is this calculated?" panel — display content from audit metrics (no formula changes).
 */

import { buildOsaEvidence, type KpiDetailsContext } from "@/lib/kpi-details-data";
import { isDemoOralCareResult } from "@/lib/demo-oral-care-planogram";
import type { KpiMetric } from "@/lib/execution-metrics";
import type { ScoringTargets } from "@/lib/planogram-audit-package";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import type { AuditKpiResult } from "@/lib/retail-intelligence";
import { scoringFromResult } from "@/lib/kpi-results-display";
import type { ScanResult } from "@/lib/scan-results";

export type CalculationSection = {
  title: string;
  lines: string[];
};

export type KpiCalculationPanelContent = {
  sections: CalculationSection[];
  demo_label?: boolean;
};

const KPI_TARGET_KEY: Partial<Record<AuditKpiId, keyof ScoringTargets>> = {
  osa: "osa_target",
  planogram_compliance: "planogram_target",
  assortment_compliance: "assortment_target",
  price_compliance: "price_target",
  promotional_compliance: "promotional_target",
  msl_compliance: "msl_target",
  share_of_shelf: "share_of_shelf_target",
};

type KpiSpec = {
  measure: string;
  dataUsed: string[];
  formula: string;
  formulaExplain?: string;
  notes: string[];
};

const KPI_SPEC: Record<AuditKpiId, KpiSpec> = {
  osa: {
    measure: "The percentage of listed products that were visibly available on the audited shelf.",
    dataUsed: [
      "Listed SKU",
      "Product identity",
      "Visible shelf presence",
      "Shelf/fixture scope",
      "Image assessment status",
    ],
    formula: "OSA = Visibly available listed SKUs ÷ Listed SKUs assessed × 100",
    notes: [
      "Multiple facings of the same SKU count as one available SKU.",
      "Being in the wrong shelf position does not automatically make a SKU unavailable.",
    ],
  },
  location_accuracy: {
    measure: "Whether products are in the shelf locations where they are expected to be.",
    dataUsed: [
      "Expected SKU",
      "Expected shelf",
      "Expected location",
      "Observed SKU",
      "Observed shelf",
      "Observed location",
      "Occupied location status",
    ],
    formula:
      "Location Accuracy = Occupied locations containing the approved SKU ÷ Occupied locations assessed × 100",
    notes: ["Empty locations are not automatically treated as location-accuracy failures."],
  },
  planogram_compliance: {
    measure: "How closely the actual shelf matches the expected shelf setup.",
    dataUsed: [
      "Expected SKU",
      "Expected position",
      "Observed SKU",
      "Observed position",
      "Expected orientation",
      "Observed orientation",
      "Planned facings",
      "Observed facings",
      "Configured placement tolerance",
      "Configured facing tolerance",
    ],
    formula:
      "Planogram Compliance = Positions passing all required checks ÷ Required positions assessed × 100",
    formulaExplain: "A position passes only when all configured required checks pass.",
    notes: [
      "If evidence is unclear or insufficient, the position should be marked Not assessable rather than automatically passing or failing.",
    ],
  },
  assortment_compliance: {
    measure: "Whether the products required for this store or shelf are actually present.",
    dataUsed: [
      "Required SKU list",
      "Mandatory/optional status",
      "Store/outlet scope",
      "Observed SKU presence",
      "Approved substitutions",
      "Assessment status",
    ],
    formula: "Assortment Compliance = Required SKUs visibly present ÷ Required SKUs assessed × 100",
    notes: ["Optional products do not enter the denominator."],
  },
  price_compliance: {
    measure: "Whether visible shelf prices match the configured expected price.",
    dataUsed: [
      "SKU",
      "Expected price",
      "Observed price",
      "Currency",
      "Price basis",
      "Price-label location",
      "Validity dates",
      "OCR confidence",
      "Store timezone",
    ],
    formula:
      "Price Compliance = Price-label positions meeting all required checks ÷ Price-label positions assessed × 100",
    formulaExplain:
      "Required checks may include correct SKU, price, currency, price basis and label location.",
    notes: [
      "If the price cannot be read reliably, it is Not assessable. Aislix does not guess the price.",
      "Visible shelf price compliance does not prove checkout price compliance.",
    ],
  },
  promotional_compliance: {
    measure: "Whether active promotions are being executed as configured.",
    dataUsed: [
      "Promotion ID",
      "Promotion dates",
      "Participating SKUs",
      "Required location",
      "Offer text",
      "Promotional price",
      "Required facings",
      "Required signage",
      "Observed promotion evidence",
      "Capture date/time",
      "Store timezone",
    ],
    formula:
      "Promotional Compliance = Active promotions passing all required checks ÷ Active promotions assessed × 100",
    formulaExplain: "A promotion passes only when all configured required checks pass.",
    notes: [],
  },
  facing_count: {
    measure:
      "The number of visible front-facing units compared with the number expected on the audited shelf.",
    dataUsed: [
      "SKU",
      "Shelf",
      "Location",
      "Planned facings",
      "Observed facings",
      "Facing tolerance",
      "Image coverage",
      "Duplicate/overlap checks",
    ],
    formula:
      "Observed Facings = Sum of visible front facings across assessed products/positions\nPlanned Facings = Sum of planned facings for the same assessed scope\nFacing Attainment = Observed Facings ÷ Planned Facings × 100",
    notes: ["Coverage is calculated separately from facing attainment."],
  },
  share_of_shelf: {
    measure:
      "The percentage of occupied linear shelf space belonging to the selected brand within the defined category.",
    dataUsed: [
      "Target brand",
      "Category",
      "Included competitor brands",
      "Shelf geometry",
      "Product linear width",
      "Shelf boundaries",
      "Category boundaries",
      "Occupied shelf space",
      "Measurement/calibration data",
    ],
    formula:
      "Share of Shelf = Target brand occupied linear shelf space ÷ Total occupied linear shelf space in the category × 100",
    notes: [
      "Share of Shelf is based on occupied linear shelf space, not raw image pixels.",
      "Share of Shelf is not Market Share.",
      "If required geometry/calibration is insufficient, the metric is Not assessable.",
    ],
  },
  msl_compliance: {
    measure: "Whether distributor-required must-stock products are visibly present at the outlet.",
    dataUsed: [
      "Distributor",
      "Outlet",
      "MSL SKU",
      "Required status",
      "Effective dates",
      "Approved substitutes",
      "Observed SKU presence",
    ],
    formula: "MSL Compliance = Required MSL SKUs visibly present ÷ Required MSL SKUs assessed × 100",
    notes: ["Optional products do not enter the denominator."],
  },
};

function num(metric?: KpiMetric, raw?: AuditKpiResult): number | null {
  const v = raw?.numerator ?? metric?.numerator;
  return v != null && Number.isFinite(v) ? v : null;
}

function den(metric?: KpiMetric, raw?: AuditKpiResult): number | null {
  const v = raw?.denominator ?? metric?.denominator;
  return v != null && Number.isFinite(v) ? v : null;
}

function status(metric?: KpiMetric, raw?: AuditKpiResult): AuditKpiResult["status"] | undefined {
  return metric?.audit_status ?? raw?.status;
}

function formatResult(metric?: KpiMetric, raw?: AuditKpiResult): string {
  const st = status(metric, raw);
  if (st === "not_configured") return "Not configured";
  if (st === "not_applicable") return "Not applicable";
  if (st === "not_assessable") return "Not assessable";
  if (metric?.unit === "count") {
    const n = num(metric, raw);
    const d = den(metric, raw);
    if (n != null && d != null) return `${n} observed / ${d} planned`;
    if (n != null) return String(n);
    return metric?.value ?? "Not assessable";
  }
  if (metric?.numeric != null && Number.isFinite(metric.numeric)) {
    return `${Math.round(metric.numeric)}%`;
  }
  if (raw?.value != null && Number.isFinite(raw.value)) {
    return `${Math.round(raw.value)}%`;
  }
  return metric?.value ?? "Not assessable";
}

function formatPercentCalculation(
  numerator: number | null,
  denominator: number | null,
  resultPct: number | null,
): string {
  if (numerator == null || denominator == null || denominator <= 0) return "Not assessable";
  if (resultPct != null && Number.isFinite(resultPct)) {
    return `${numerator} ÷ ${denominator} × 100 = ${Math.round(resultPct)}%`;
  }
  return `${numerator} ÷ ${denominator} × 100`;
}

function formatCoverage(
  kpiId: AuditKpiId,
  metric?: KpiMetric,
  raw?: AuditKpiResult,
): string {
  const st = status(metric, raw);
  if (st === "not_configured") return "Not configured";
  if (st === "not_applicable") return "Not applicable";
  if (st === "not_assessable") return "Not assessable";

  const pct = raw?.coverage_percent ?? metric?.coverage_percent;
  const covNum = raw?.coverage_numerator ?? (kpiId === "facing_count" ? den(metric, raw) : undefined);
  const covDen = raw?.coverage_denominator;
  const excluded = raw?.excluded_count ?? metric?.excluded_count;
  const parts: string[] = [];

  if (kpiId === "facing_count" && covNum != null && covDen != null && covDen > 0) {
    parts.push(`${covNum} assessed planned positions / ${covDen} total planned positions`);
    if (pct != null && Number.isFinite(pct)) {
      parts.push(`${covNum} ÷ ${covDen} × 100 = ${Math.round(pct)}%`);
    }
  } else if (covNum != null && covDen != null && covDen > 0) {
    parts.push(`${covNum} / ${covDen} positions assessed`);
    if (pct != null && Number.isFinite(pct)) {
      parts.push(`Coverage ${Math.round(pct)}%`);
    }
  } else if (pct != null && Number.isFinite(pct)) {
    parts.push(`Coverage ${Math.round(pct)}%`);
  }

  if (excluded && excluded > 0) {
    parts.push(`${excluded} excluded (not assessable)`);
  }

  const isPartial =
    st === "partial" || (pct != null && Number.isFinite(pct) && Math.round(pct) < 100);
  if (isPartial) {
    parts.push("Partial");
  } else if (st === "complete" || (pct != null && Math.round(pct) >= 100)) {
    parts.push("Complete");
  }

  if (!parts.length) return "—";
  return parts.join(" · ");
}

function formatTarget(kpiId: AuditKpiId, result: ScanResult): string {
  const scoring = scoringFromResult(result);
  const key = KPI_TARGET_KEY[kpiId];
  const target = key ? scoring[key] : undefined;
  if (target == null || !Number.isFinite(Number(target))) return "Not configured";
  return `${Math.round(Number(target))}%`;
}

function buildThisAudit(
  kpiId: AuditKpiId,
  metric?: KpiMetric,
  raw?: AuditKpiResult,
  ctx?: KpiDetailsContext | null,
): string[] {
  const st = status(metric, raw);
  if (st === "not_configured") return ["Not configured — expected shelf data or reference list not available."];
  if (st === "not_applicable") return ["Not applicable — no active promotions or scope for this KPI on this audit."];
  if (st === "not_assessable") return ["Not assessable — insufficient evidence to calculate this KPI reliably."];

  const n = num(metric, raw);
  const d = den(metric, raw);
  const lines: string[] = [];

  switch (kpiId) {
    case "osa": {
      if (ctx) {
        const ev = buildOsaEvidence(ctx);
        lines.push(`${ev.available} visible / ${ev.assessed} assessed`);
        if (n != null && d != null && d > 0) {
          lines.push(formatPercentCalculation(ev.available, ev.assessed, metric?.numeric ?? raw?.value ?? null));
        }
      } else if (n != null && d != null) {
        lines.push(`${n} visible / ${d} assessed`);
        lines.push(formatPercentCalculation(n, d, metric?.numeric ?? raw?.value ?? null));
      }
      break;
    }
    case "location_accuracy":
      if (n != null && d != null) {
        lines.push(`${n} correct occupied locations / ${d} occupied locations assessed`);
        lines.push(formatPercentCalculation(n, d, metric?.numeric ?? raw?.value ?? null));
      }
      break;
    case "planogram_compliance":
      if (n != null && d != null) {
        lines.push(`${n} passing positions / ${d} required positions assessed`);
        lines.push(formatPercentCalculation(n, d, metric?.numeric ?? raw?.value ?? null));
      }
      break;
    case "assortment_compliance":
    case "msl_compliance":
      if (n != null && d != null) {
        lines.push(`${n} required SKUs present / ${d} required SKUs assessed`);
        lines.push(formatPercentCalculation(n, d, metric?.numeric ?? raw?.value ?? null));
      }
      break;
    case "price_compliance":
      if (n != null && d != null) {
        lines.push(`${n} price-label positions passing / ${d} price-label positions assessed`);
        lines.push(formatPercentCalculation(n, d, metric?.numeric ?? raw?.value ?? null));
      }
      break;
    case "promotional_compliance":
      if (n != null && d != null) {
        lines.push(`${n} promotions passing / ${d} active promotions assessed`);
        lines.push(formatPercentCalculation(n, d, metric?.numeric ?? raw?.value ?? null));
      }
      break;
    case "facing_count": {
      if (n != null && d != null) {
        lines.push(`${n} observed / ${d} planned`);
        if (d > 0) {
          const attainment = metric?.numeric ?? raw?.value ?? (n / d) * 100;
          lines.push(`${Math.round(attainment)}% of planned`);
        }
      }
      break;
    }
    case "share_of_shelf":
      if (metric?.numeric != null) {
        lines.push(`Target brand occupied ${Math.round(metric.numeric)}% of assessed category linear space`);
      } else if (raw?.value != null) {
        lines.push(`Target brand occupied ${Math.round(raw.value)}% of assessed category linear space`);
      }
      break;
    default:
      if (n != null && d != null) {
        lines.push(`${n} / ${d}`);
        lines.push(formatPercentCalculation(n, d, metric?.numeric ?? raw?.value ?? null));
      }
  }

  if (!lines.length) lines.push("No assessed values available for this audit.");
  return lines;
}

function extraNotes(kpiId: AuditKpiId, raw?: AuditKpiResult): string[] {
  const notes: string[] = [];
  if (raw?.tooltip?.trim()) notes.push(raw.tooltip.trim());
  if (raw?.warnings?.length) notes.push(...raw.warnings);
  return notes;
}

export function buildKpiCalculationPanelContent(
  kpiId: AuditKpiId,
  result: ScanResult,
  metric?: KpiMetric,
  raw?: AuditKpiResult,
  ctx?: KpiDetailsContext | null,
): KpiCalculationPanelContent {
  const spec = KPI_SPEC[kpiId];
  const sections: CalculationSection[] = [
    { title: "What we measure", lines: [spec.measure] },
    { title: "Data used", lines: spec.dataUsed },
    {
      title: "How it is calculated",
      lines: spec.formulaExplain ? [spec.formula, spec.formulaExplain] : [spec.formula],
    },
    { title: "This audit", lines: buildThisAudit(kpiId, metric, raw, ctx) },
    { title: "Result", lines: [formatResult(metric, raw)] },
    { title: "Coverage", lines: [formatCoverage(kpiId, metric, raw)] },
    { title: "Target", lines: [formatTarget(kpiId, result)] },
    {
      title: "Notes",
      lines: [...spec.notes, ...extraNotes(kpiId, raw)].filter(Boolean),
    },
  ];

  const demo =
    isDemoOralCareResult(result) || result.retail_intelligence?.demo_oral_care === true;

  return {
    sections,
    demo_label: demo,
  };
}
