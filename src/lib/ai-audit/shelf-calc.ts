/**
 * TypeScript mirror of Railway shelf_calc — tests only, not production KPI authority.
 */

export type MetricStatus =
  | "CALCULATED"
  | "UNAVAILABLE"
  | "UNVERIFIABLE"
  | "NOT_APPLICABLE"
  | "COUNT_MISMATCH";

export type MetricResult = {
  metric_id: string;
  value: number | string | null;
  unit: string;
  status: MetricStatus;
  source: string;
  formula_version?: string;
  inputs?: Record<string, unknown>;
};

export function percentage(numerator: number | null, denominator: number | null, decimals = 1): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(decimals));
}

export function facingCompliance(actual: number | null, expected: number | null): MetricResult {
  if (actual === null || expected === null || expected === 0) {
    return {
      metric_id: "facing_compliance",
      value: null,
      unit: "percent",
      status: "UNAVAILABLE",
      source: "aislix_calculation",
    };
  }
  return {
    metric_id: "facing_compliance",
    value: percentage(actual, expected),
    unit: "percent",
    status: "CALCULATED",
    source: "aislix_calculation",
    formula_version: "v1",
    inputs: { actual_facings: actual, expected_facings: expected },
  };
}

export function aggregateFacingCompliance(
  rows: Array<{ actual_facings?: number | null; expected_facings?: number | null }>,
): MetricResult {
  let actualSum = 0;
  let expectedSum = 0;
  for (const row of rows) {
    if (row.actual_facings == null || row.expected_facings == null) continue;
    actualSum += row.actual_facings;
    expectedSum += row.expected_facings;
  }
  if (expectedSum === 0) {
    return {
      metric_id: "overall_facing_compliance",
      value: null,
      unit: "percent",
      status: "UNAVAILABLE",
      source: "aislix_calculation",
    };
  }
  return {
    metric_id: "overall_facing_compliance",
    value: percentage(actualSum, expectedSum),
    unit: "percent",
    status: "CALCULATED",
    source: "aislix_calculation",
    formula_version: "v1",
    inputs: { sum_actual_facings: actualSum, sum_expected_facings: expectedSum },
  };
}
