/**
 * Retail Execution Intelligence — shared types for scan results, actions, and metric states.
 * Every metric must declare how it was derived; never fabricate unavailable data.
 */

import type { ResultViewMode } from "@/lib/customer-context";
import type { PlanogramIssueType } from "@/lib/demo-planogram-match";

/** How a metric value was produced — never show 0% when state is not `available`. */
export type MetricState =
  | "available"
  | "calculated"
  | "estimated"
  | "not_configured"
  | "insufficient_evidence"
  | "not_applicable"
  | "unavailable";

export type MetricValue<T = number> = {
  value: T | null;
  state: MetricState;
  label?: string;
};

export type RoleFamilyInsight = {
  role_family: "field" | "store_ops" | "merchandising" | "executive";
  headline: string;
  summary: string;
  top_actions: string[];
};

export type RoleSummaries = Partial<Record<ResultViewMode, string>>;

export type NextBestAction = {
  action_id: string;
  issue_type: string;
  priority: "critical" | "high" | "medium" | "low";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  detail: string;
  reason: string;
  recommended_action: string;
  expected_state?: string;
  actual_state?: string;
  brand?: string;
  product?: string;
  sku?: string;
  location?: string;
  evidence?: string;
  confidence?: number;
  estimated_daily_impact_inr?: number;
  status?: "open" | "assigned" | "in_progress" | "fixed" | "rescan_required" | "verified" | "dismissed";
  role?: ResultViewMode | "field" | "store_ops" | "merchandising" | "executive";
};

export type ScoreComponent = {
  key: string;
  label: string;
  score: number | null;
  state: MetricState;
  weight?: number;
};

export type RetailExecutionScore = {
  overall: number | null;
  state: MetricState;
  components: ScoreComponent[];
  withhold_reason?: string;
};

export type PlanogramAnalysis = {
  status: "configured" | "not_configured";
  sku_match_percent: MetricValue;
  qty_compliance_percent: MetricValue;
  lines: Array<{
    brand: string;
    product: string;
    expected_qty: number;
    detected_qty: number;
    issue_type: PlanogramIssueType;
    detail?: string;
  }>;
};

export type ImageQualityAssessment = {
  blur?: MetricValue<boolean>;
  brightness?: MetricValue<boolean>;
  obstruction?: MetricValue<boolean>;
  angle?: MetricValue<boolean>;
  completeness?: MetricValue<boolean>;
  overall_state: MetricState;
  rescan_recommended?: boolean;
  notes?: string;
};

export type OpportunityLedgerRow = {
  id: string;
  issue?: string;
  sku?: string;
  brand?: string;
  severity?: string;
  priority?: string;
  expected?: string;
  actual?: string;
  gap?: string;
  evidence?: string;
  revenue_at_risk_inr?: number | null;
  commercial_risk?: string | null;
  source?: string;
  confidence?: string;
  recommended_action?: string;
  status?: "open" | "assigned" | "in_progress" | "fixed" | "rescan_required" | "verified" | "dismissed" | "closed" | string;
  commercial_impact_score?: number;
};

export type ExecutionVerification = {
  previous_score?: number | null;
  current_score?: number | null;
  previous_target_sku_availability?: string;
  current_target_sku_availability?: string;
  previous_planogram_presence?: string;
  current_planogram_presence?: string;
  improved: boolean;
  verified: boolean;
  summary: string;
};

export type AuditKpiResult = {
  kpi_id: string;
  label: string;
  value: number | null;
  unit: "percent" | "count";
  status: "complete" | "partial" | "not_assessable" | "not_applicable" | "not_configured";
  numerator?: number | null;
  denominator?: number | null;
  coverage_percent?: number | null;
  coverage_numerator?: number | null;
  coverage_denominator?: number | null;
  excluded_count?: number;
  formula?: string;
  scope?: string;
  tooltip?: string;
  warnings?: string[];
  formula_version?: string;
};

export type AuditKpiDashboard = {
  role_id: string;
  role_label: string;
  introduction: string;
  primary_kpis: AuditKpiResult[];
  kpi_count: number;
  readiness?: Array<{ kpi_id: string; ready: boolean; label: string }>;
  formula_version?: string;
};

export type RetailIntelligencePayload = {
  scan_summary?: string;
  image_quality?: ImageQualityAssessment & {
    audit_image_quality_score?: MetricValue;
    status?: string;
    notes?: string;
  };
  shelf_structure?: Record<string, unknown>;
  assortment?: Record<string, MetricValue | string>;
  availability?: Record<string, MetricValue | string>;
  facings?: Record<string, MetricValue | string>;
  placement_compliance?: MetricValue;
  share_of_facings?: MetricValue;
  linear_shelf_share?: MetricValue;
  presentability?: { score?: MetricValue; methodology?: string };
  pricing?: MetricValue | Record<string, unknown>;
  audit_scope?: Record<string, unknown>;
  adjacent_category_findings?: Array<{
    brand?: string;
    product_name?: string;
    reason?: string;
    zone?: string;
  }>;
  multi_photo?: {
    photo_count?: number;
    merged_facings?: number;
    facings_per_photo?: number[];
  };
  promotions?: MetricValue | Record<string, unknown>;
  posm?: MetricValue | Record<string, unknown>;
  freshness?: MetricValue | Record<string, unknown>;
  opportunity_ledger?: OpportunityLedgerRow[];
  execution_verification?: ExecutionVerification;
  historical_patterns?: string[];
  role_summaries?: RoleSummaries;
  role_insights?: RoleFamilyInsight[];
  role_specific_insights?: Record<string, unknown>;
  next_best_actions?: NextBestAction[];
  retail_execution_score?: RetailExecutionScore;
  planogram_analysis?: PlanogramAnalysis;
  recognition_coverage?: MetricValue;
  ai_confidence?: MetricValue;
  financial_impact?: import("@/lib/scan-results").FinancialImpact;
  competitive_insights?: Array<{
    brand: string;
    share_note: string;
    action: string;
  }>;
  audit_kpi_dashboard?: AuditKpiDashboard;
  /** All five customer-role dashboards for tab switching. */
  audit_kpi_dashboards?: Partial<Record<string, AuditKpiDashboard>>;
  /** Homepage demo oral-care fixture — client KPIs override backend zeros. */
  demo_oral_care?: boolean;
  audit_package?: import("@/lib/planogram-audit-package").PlanogramAuditPackage;
};

export const ROLE_HERO: Record<ResultViewMode, string> = {
  execution: "What needs attention?",
  merchandising: "How is my category performing?",
  brand: "How is my brand performing against competitors?",
  executive: "Where should I intervene?",
  exceptions: "What failed the audit?",
};

export function metricLabel(state: MetricState): string {
  switch (state) {
    case "not_configured":
      return "Not configured";
    case "insufficient_evidence":
      return "Insufficient evidence";
    case "not_applicable":
      return "Not applicable";
    case "unavailable":
      return "Unavailable";
    case "estimated":
      return "Estimated";
    default:
      return "";
  }
}

export function formatMetricValue(
  metric: MetricValue<number> | undefined,
  formatter: (n: number) => string = (n) => String(n),
): string {
  if (!metric) return "Not configured";
  if (metric.state === "not_configured") return "Not configured";
  if (metric.state === "insufficient_evidence") return "Insufficient evidence";
  if (metric.state === "not_applicable") return "Not applicable";
  if (metric.state === "unavailable") return "Unavailable";
  if (metric.value == null) return metricLabel(metric.state);
  const suffix = metric.state === "estimated" ? " (est.)" : "";
  return `${formatter(metric.value)}${suffix}`;
}
