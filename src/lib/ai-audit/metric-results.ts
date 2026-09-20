/** Helpers for Railway MetricResult blocks stored under metrics.calculated_metrics. */

export type MetricStatus =
  | "CALCULATED"
  | "VERIFIED"
  | "UNAVAILABLE"
  | "UNVERIFIABLE"
  | "NOT_APPLICABLE"
  | "COUNT_MISMATCH"
  | string;

export type MetricResultView = {
  id: string;
  value: number | string | null;
  status: MetricStatus;
  unit?: string;
  source?: string;
  explanation?: string | null;
};

function pickRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function readMetricResult(
  metrics: Record<string, unknown> | null | undefined,
  key: string,
): MetricResultView | null {
  if (!metrics) return null;
  const raw = metrics[key];
  if (raw == null) return null;
  if (typeof raw === "number" || typeof raw === "string") {
    return { id: key, value: raw, status: "CALCULATED" };
  }
  const block = pickRecord(raw);
  if (!block) return null;
  const value = block.value;
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))
        ? Number(value)
        : value == null
          ? null
          : String(value);
  return {
    id: String(block.metric_id ?? key),
    value: numeric as number | string | null,
    status: String(block.status ?? "CALCULATED"),
    unit: typeof block.unit === "string" ? block.unit : undefined,
    source: typeof block.source === "string" ? block.source : undefined,
    explanation: typeof block.explanation === "string" ? block.explanation : null,
  };
}

export function metricDisplayValue(
  metric: MetricResultView | null,
  fallback?: number | string | null,
): string {
  if (metric) {
    if (metric.status === "COUNT_MISMATCH") return "COUNT VERIFICATION PENDING";
    if (metric.status === "NOT_APPLICABLE") return "N/A";
    if (
      metric.status === "UNAVAILABLE" ||
      metric.status === "UNVERIFIABLE" ||
      metric.value == null
    ) {
      return fallback != null && fallback !== "" ? String(fallback) : "—";
    }
    if (
      typeof metric.value === "number" &&
      (metric.unit === "percent" ||
        /compliance|percent|share/i.test(metric.id) ||
        (typeof fallback === "string" && fallback.includes("%")))
    ) {
      return `${Math.round(metric.value)}%`;
    }
    // Prefer a positive observed/fallback count when the stored metric is a stale 0.
    if (
      typeof metric.value === "number" &&
      metric.value === 0 &&
      typeof fallback === "number" &&
      fallback > 0
    ) {
      return String(fallback);
    }
    return String(metric.value);
  }
  if (fallback != null && fallback !== "") return String(fallback);
  return "—";
}

/** Count KPIs: never show 0 when product rows clearly exist. */
export function metricCountDisplay(
  metric: MetricResultView | null,
  observedCount: number,
  summaryCount?: number | null,
): string {
  if (metric?.status === "COUNT_MISMATCH") return "COUNT VERIFICATION PENDING";
  if (metric?.status === "NOT_APPLICABLE") return "N/A";
  const candidates = [
    typeof metric?.value === "number" ? metric.value : null,
    typeof summaryCount === "number" ? summaryCount : null,
    observedCount,
  ].filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  const positive = candidates.find((n) => n > 0);
  if (positive != null) return String(positive);
  if (candidates.includes(0)) return "0";
  return "—";
}

export function metricStatusLabel(status: MetricStatus | undefined): string | null {
  if (!status) return null;
  switch (status) {
    case "VERIFIED":
      return "Verified";
    case "CALCULATED":
      return "Calculated";
    case "COUNT_MISMATCH":
      return "COUNT VERIFICATION PENDING";
    case "NOT_APPLICABLE":
      return "N/A";
    case "UNAVAILABLE":
    case "UNVERIFIABLE":
      return "Unavailable";
    default:
      return status;
  }
}

export function pickCalculatedMetrics(
  result: { metrics?: Record<string, unknown> | null },
): Record<string, unknown> {
  const metrics = pickRecord(result.metrics) ?? {};
  const calc = pickRecord(metrics.calculated_metrics);
  if (calc) return calc;
  const aislix =
    pickRecord(metrics.aislix_shelf_analysis) ?? pickRecord(metrics.aislix_planogram_analysis);
  return pickRecord(aislix?.calculated_metrics) ?? {};
}

export function pickExecutionRisk(
  result: { metrics?: Record<string, unknown> | null },
): { severity: string; reasons: string[]; rules_triggered: Array<Record<string, unknown>> } | null {
  const metrics = pickRecord(result.metrics);
  const risk = pickRecord(metrics?.execution_risk);
  if (!risk) return null;
  const reasons = Array.isArray(risk.reasons)
    ? risk.reasons.map((r) => String(r)).filter(Boolean)
    : [];
  const rules = Array.isArray(risk.rules_triggered)
    ? (risk.rules_triggered as Array<Record<string, unknown>>)
    : [];
  return {
    severity: String(risk.severity ?? "NONE"),
    reasons,
    rules_triggered: rules,
  };
}

/** Soften shelf-only executive summaries for plain-English display. */
export function sanitizeShelfOnlyExecutiveSummary(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  return text
    .replace(
      /Overall facing compliance:\s*Data unavailable/gi,
      "Facing compliance: Not applicable for this photo-only audit",
    )
    .replace(
      /Planogram compliance:\s*Data unavailable/gi,
      "Planogram compliance: Not applicable for this photo-only audit",
    )
    .replace(
      /Price and promotion intelligence:\s*Data unavailable\.?/gi,
      "Prices and promotions: Not readable in this photo.",
    )
    .replace(
      /Brand share metrics available in calculated analysis\./gi,
      "Brand share: see the brand charts below.",
    )
    .replace(/\bAstra\b/gi, "AI")
    .replace(/\bLuna\b/gi, "price reading")
    .replace(/\bMetricResults?\b/gi, "metrics")
    .replace(/\bAislix calculated\b/gi, "calculated")
    .replace(/\bshelf_cv\b/gi, "shelf analysis")
    .replace(/\bUNVERIFIABLE\b/g, "not readable");
}
