/**

 * Derive execution-style metrics from anonymous landing demo audits.

 * Keeps homepage demo aligned with authenticated /results presentation.

 */



import type { FinancialImpact, ScanResult } from "@/lib/scan-results";

import type { LandingScanResult } from "@/lib/landing-audit-api";



const DEFAULT_ASP = 75;

const UNITS_PER_DAY = 4;

const LOW_STOCK_THRESHOLD = 2;



function toDataUrl(value: string | undefined, mime = "image/jpeg"): string | undefined {

  if (!value) return undefined;

  return value.startsWith("data:") ? value : `data:${mime};base64,${value}`;

}



export function landingExecutionScore(result: LandingScanResult): number | undefined {

  const score =

    (result.metrics as { shelf_execution_score?: number })?.shelf_execution_score ??

    result.metrics?.shelf_health_score;

  return score !== undefined && Number.isFinite(score) ? Math.round(score) : undefined;

}



function inventoryFromLanding(landing: LandingScanResult) {
  const rows = landing.inventory ?? [];
  if (rows.length) {
    return rows.map((row, i) => ({
      id: `demo-${i}`,
      brand: row.brand || "Unknown",
      product: row.product_name || "Unknown product",
      variant: row.variant,
      quantity: row.quantity ?? 0,
      confidence: row.confidence ?? 0,
      low_stock: (row.quantity ?? 0) > 0 && (row.quantity ?? 0) <= LOW_STOCK_THRESHOLD,
      out_of_stock: (row.quantity ?? 0) <= 0,
    }));
  }
  const products = (landing as { products?: Array<Record<string, unknown>> }).products ?? [];
  if (products.length) {
    return products.map((row, i) => ({
      id: `demo-${i}`,
      brand: String(row.brand ?? "Unknown"),
      product: String(row.product_name ?? row.product ?? "Unknown product"),
      variant: row.variant != null ? String(row.variant) : undefined,
      quantity: Number(row.quantity ?? row.qty ?? 0),
      confidence: Number(row.confidence ?? 0),
      low_stock: false,
      out_of_stock: false,
    }));
  }
  return [];
}

export function landingFinancialImpact(result: LandingScanResult): FinancialImpact {

  const backend = (result.metrics as { financial_impact?: FinancialImpact })?.financial_impact;

  if (backend) return backend;



  let oos = 0;

  let atRisk = 0;

  for (const row of result.inventory ?? []) {
    const qty = row.quantity ?? 0;
    if (qty <= 0) oos += 1;
    else if (qty < LOW_STOCK_THRESHOLD) {
      oos += 1;
      atRisk += 1;
    }
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



/** Map anonymous landing scan payload into the same shape /results panels consume. */

export function landingToScanResult(landing: LandingScanResult): ScanResult {

  const m = landing.metrics ?? {};

  const metricsAny = m as Record<string, unknown>;

  const num = (key: string): number | undefined => {

    const v = metricsAny[key];

    return typeof v === "number" && Number.isFinite(v) ? v : undefined;

  };



  const brandShare = landing.top_brands?.length

    ? landing.top_brands

    : (landing.brand_share ?? []);



  const financial = landingFinancialImpact(landing);



  return {

    scan_id: landing.scan_id,

    created_at: landing.audited_at,

    status: "completed",

    executive_summary: landing.executive_summary,
    role_summaries: landing.role_summaries,
    retail_intelligence: landing.retail_intelligence,

    summary: {

      total_products: num("total_products") ?? 0,

      unique_skus: num("unique_skus") ?? num("total_skus") ?? 0,

      unique_brands: num("unique_brands") ?? brandShare.length,

      low_stock_products: num("low_stock_products") ?? 0,

      average_confidence: num("average_confidence") ?? 0,

      processing_time_ms: num("processing_time_ms") ?? 0,

      shelf_health_score: num("shelf_health_score"),

      shelf_execution_score: num("shelf_execution_score") ?? num("shelf_health_score"),

      total_facings: num("total_facings") ?? num("total_products"),

      share_of_shelf_percent: num("share_of_shelf_percent"),

      availability_percent: num("availability_percent") ?? num("osa_percent"),

      osa_percent: num("osa_percent"),

      facing_compliance_percent: num("facing_compliance_percent"),

      placement_compliance_percent: num("placement_compliance_percent"),

      recognition_coverage_percent: num("recognition_coverage_percent"),

      confirmed_oos_count: num("confirmed_oos_count"),

      possible_oos_count: num("possible_oos_count"),

      placement_issue_count: num("placement_issue_count"),

      misplaced_products: num("misplaced_products"),

      needs_review_facings: num("needs_review_facings"),

      low_stock_threshold: num("low_stock_threshold") ?? LOW_STOCK_THRESHOLD,

    },

    financial_impact: financial,

    inventory: inventoryFromLanding(landing),

    recommendations: (landing.recommendations ?? []).map((r, i) => ({

      id: r.id ?? `rec-${i}`,

      title: r.title,

      detail: r.detail,

      impact: r.impact,

      category: r.category,

    })),

    alerts: (landing.alerts ?? []).map((a, i) => ({

      id: a.id ?? `alert-${i}`,

      severity: (a.severity as "high" | "medium" | "low") ?? "medium",

      title: a.title,

      detail: a.detail,

    })),

    compliance_alerts: (landing.compliance_alerts ?? []).map((a, i) => ({

      id: a.id ?? `comp-${i}`,

      severity: (a.severity as "high" | "medium" | "low") ?? "medium",

      title: a.title,

      detail: a.detail,

      interpretation: a.interpretation,

    })),

    planogram: {

      requested: Boolean(landing.has_planogram),

      percent: num("planogram_compliance_percent") ?? num("planogram_sku_match_percent") ?? null,

      sku_match_percent: num("planogram_sku_match_percent") ?? num("planogram_compliance_percent") ?? null,

      qty_compliance_percent: num("planogram_qty_compliance_percent") ?? null,

      summary: (metricsAny["planogram_summary"] as Record<string, unknown>) ?? {},

    },

    charts: {

      top_brands: brandShare.map((b) => ({ brand: b.brand, share: b.share })),

    },

    annotated_image_url: toDataUrl(landing.annotated_image_base64, landing.annotated_image_mime),

    original_image_url: toDataUrl(landing.original_image_base64, landing.original_image_mime),

    scan_category: landing.category,

    scan_sub_category: landing.sub_category_label ?? landing.sub_category,

    location: landing.shelf_label,

    created_at: landing.audited_at,

  };

}


