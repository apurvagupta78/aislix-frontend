/**
 * Derive execution-style metrics from anonymous landing demo scans.
 * Keeps homepage demo aligned with authenticated /results presentation.
 */

import type { FinancialImpact } from "@/lib/scan-results";
import type { LandingScanResult } from "@/lib/landing-scan-api";

const DEFAULT_ASP = 75;
const UNITS_PER_DAY = 4;
const LOW_STOCK_THRESHOLD = 2;

export function landingExecutionScore(result: LandingScanResult): number | undefined {
  const score =
    (result.metrics as { shelf_execution_score?: number })?.shelf_execution_score ??
    result.metrics?.shelf_health_score;
  return score !== undefined && Number.isFinite(score) ? Math.round(score) : undefined;
}

export function landingFinancialImpact(result: LandingScanResult): FinancialImpact {
  const backend = (result.metrics as { financial_impact?: FinancialImpact })?.financial_impact;
  if (backend) return backend;

  let oos = 0;
  let atRisk = 0;
  for (const row of result.inventory ?? []) {
    const qty = row.quantity ?? 0;
    if (qty <= 0) oos += 1;
    else if (qty <= LOW_STOCK_THRESHOLD) atRisk += 1;
  }

  const daily = Math.round(
    oos * UNITS_PER_DAY * DEFAULT_ASP + atRisk * UNITS_PER_DAY * DEFAULT_ASP * 0.35,
  );

  return {
    estimated_daily_lost_sales_inr: daily,
    estimated_weekly_lost_sales_inr: daily * 7,
    estimated_monthly_lost_sales_inr: daily * 30,
    oos_sku_count: oos,
    at_risk_sku_count: atRisk,
    methodology: "Indicative estimate using category ASP defaults and typical daily velocity.",
    confidence: "indicative",
  };
}
