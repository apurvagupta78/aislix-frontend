/**
 * Commercial impact section — display/export helpers (uses existing financial gap logic).
 */

import {
  comparePlanogramToInventory,
  computePlanogramFinancialGaps,
  type FinancialGapLine,
  type InventoryFacing,
  type PlanogramMatchResult,
} from "@/lib/demo-planogram-match";
import {
  compareDemoOralCarePlanogram,
  DEMO_ORAL_CARE_META,
  isDemoOralCareResult,
} from "@/lib/demo-oral-care-planogram";
import { planogramRowsFromResult } from "@/lib/execution-metrics";
import type { PlanogramRow } from "@/lib/planogram";
import type { FinancialImpact, ScanResult } from "@/lib/scan-results";
import { resolveFinancialImpact } from "@/lib/scan-execution";

export type SkuExposureRow = FinancialGapLine & {
  label: string;
  sku?: string;
  shelf_position?: string;
  daily_sales_units?: number;
  selling_price?: number;
};

export type CommercialImpactView = {
  impact: FinancialImpact;
  daily: number;
  weekly: number;
  monthly: number;
  sku_rows: SkuExposureRow[];
  estimate_status: "Illustrative" | "Configured" | "Not assessable" | "Not configured";
};

function resolveMatch(result: ScanResult, rows: PlanogramRow[]): PlanogramMatchResult | null {
  if (!rows.length) return null;
  const demoMode =
    isDemoOralCareResult(result) || result.retail_intelligence?.demo_oral_care === true;
  if (demoMode) return compareDemoOralCarePlanogram(rows);
  const inventory = result.inventory ?? [];
  if (!inventory.length) return null;
  return comparePlanogramToInventory(inventory as InventoryFacing[], rows);
}

function salesVelocity(plan: PlanogramRow): number {
  if (plan.avg_daily_sales != null && Number.isFinite(plan.avg_daily_sales) && plan.avg_daily_sales > 0) {
    return plan.avg_daily_sales;
  }
  return 4;
}

export function buildSkuExposureRows(result: ScanResult): SkuExposureRow[] {
  const rows = planogramRowsFromResult(result);
  const match = resolveMatch(result, rows);
  if (!match) return [];
  const gaps = computePlanogramFinancialGaps(match);
  const lineByProduct = new Map(
    match.lines.map((l) => [`${l.expected.brand}|${l.expected.product_name}`, l]),
  );
  return gaps
    .map((gap) => {
      const line = lineByProduct.get(`${gap.brand}|${gap.product}`);
      const plan = line?.expected;
      return {
        ...gap,
        label: gap.product.trim() ? `${gap.brand} ${gap.product}`.trim() : gap.brand,
        sku: plan?.sku,
        shelf_position: plan?.shelf_position,
        daily_sales_units: plan ? salesVelocity(plan) : undefined,
        selling_price: plan?.mrp_inr,
      };
    })
    .sort((a, b) => b.daily_loss_inr - a.daily_loss_inr);
}

function mapEstimateStatus(impact: FinancialImpact): CommercialImpactView["estimate_status"] {
  if (impact.estimate_status === "not_estimated") {
    return impact.oos_sku_count > 0 || impact.at_risk_sku_count > 0 ? "Not assessable" : "Not configured";
  }
  if (impact.level === 2 && impact.estimated_daily_lost_sales_inr > 0) {
    return impact.confidence === "priced" ? "Configured" : "Illustrative";
  }
  if (impact.level === 1) return "Not assessable";
  return "Illustrative";
}

export function buildCommercialImpactView(result: ScanResult): CommercialImpactView | null {
  const impact = resolveFinancialImpact(result) ?? result.financial_impact;
  if (!impact) return null;
  return {
    impact,
    daily: impact.estimated_daily_lost_sales_inr,
    weekly: impact.estimated_weekly_lost_sales_inr,
    monthly: impact.estimated_monthly_lost_sales_inr,
    sku_rows: buildSkuExposureRows(result),
    estimate_status: mapEstimateStatus(impact),
  };
}

export function commercialImpactMeta(result: ScanResult) {
  const rows = planogramRowsFromResult(result);
  return {
    audit_id: result.location ?? result.scan_id ?? "",
    audit_date: result.created_at ?? "",
    store: result.store ?? "Demo Supermarket",
    fixture: rows[0]?.location ?? DEMO_ORAL_CARE_META.fixture_id ?? "",
    category: result.scan_category ?? DEMO_ORAL_CARE_META.category,
    sub_category: result.scan_sub_category ?? DEMO_ORAL_CARE_META.sub_category,
    planogram_version: DEMO_ORAL_CARE_META.version,
    role: result.retail_intelligence?.audit_kpi_dashboard?.role_id ?? "",
  };
}
