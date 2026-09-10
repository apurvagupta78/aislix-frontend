/**
 * Retail Execution Intelligence — shared types for scan results, actions, and metric states.
 * Every metric must declare how it was derived; never fabricate unavailable data.
 */

import type { ResultViewMode } from "@/lib/customer-context";
import type { PlanogramIssueType } from "@/lib/demo-planogram-match";

/** How a metric value was produced. */
export type MetricState =
  | "available"
  | "calculated"
  | "estimated"
  | "not_configured"
  | "insufficient_evidence";

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

export type RetailIntelligencePayload = {
  scan_summary?: string;
  image_quality?: ImageQualityAssessment;
  role_summaries?: RoleSummaries;
  role_insights?: RoleFamilyInsight[];
  next_best_actions?: NextBestAction[];
  retail_execution_score?: RetailExecutionScore;
  planogram_analysis?: PlanogramAnalysis;
  recognition_coverage?: MetricValue;
  ai_confidence?: MetricValue;
  competitive_insights?: Array<{
    brand: string;
    share_note: string;
    action: string;
  }>;
};

export const ROLE_HERO: Record<ResultViewMode, string> = {
  execution: "What needs attention?",
  merchandising: "How is my category performing?",
  brand: "How is my brand performing against competitors?",
  executive: "Where should I intervene?",
};

export function metricLabel(state: MetricState): string {
  switch (state) {
    case "not_configured":
      return "Not configured";
    case "insufficient_evidence":
      return "Insufficient evidence";
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
  if (metric.value == null) return metricLabel(metric.state);
  const suffix = metric.state === "estimated" ? " (est.)" : "";
  return `${formatter(metric.value)}${suffix}`;
}
