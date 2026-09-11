/**
 * Build commercial opportunity ledger from scan results — prioritized by impact.
 */

import type { PlanogramMatchResult } from "@/lib/demo-planogram-match";
import { executionScoreFromResult, expectedFacingsForRow } from "@/lib/execution-metrics";
import type { OpportunityLedgerRow } from "@/lib/retail-intelligence";
import type { FinancialImpact, ScanResult } from "@/lib/scan-results";

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

function priorityFromImpact(dailyInr: number, issue: string): OpportunityLedgerRow["priority"] {
  if (issue === "missing" || issue === "wrong_product") {
    if (dailyInr >= 1000) return "critical";
    if (dailyInr >= 300) return "high";
    return dailyInr > 0 ? "medium" : "high";
  }
  if (dailyInr >= 500) return "high";
  if (dailyInr >= 100) return "medium";
  return "low";
}

function commercialImpactScore(dailyInr: number, priority: string, confidence = 0.85): number {
  const pri = { critical: 1, high: 0.85, medium: 0.6, low: 0.35 }[priority] ?? 0.5;
  const fin = dailyInr > 0 ? Math.min(dailyInr / 10000, 1) : 0.2;
  return Math.round(fin * pri * confidence * 100);
}

/** Merge backend ledger with client-side planogram/financial opportunities. */
export function buildOpportunityLedger(
  result?: ScanResult | null,
  match?: PlanogramMatchResult | null,
  financial?: FinancialImpact | null,
): OpportunityLedgerRow[] {
  const backend = result?.retail_intelligence?.opportunity_ledger;
  if (Array.isArray(backend) && backend.length) {
    return [...backend].sort(
      (a, b) =>
        (b.commercial_impact_score ?? 0) - (a.commercial_impact_score ?? 0) ||
        (PRIORITY_ORDER[(a.priority as keyof typeof PRIORITY_ORDER) ?? "medium"] ?? 2) -
          (PRIORITY_ORDER[(b.priority as keyof typeof PRIORITY_ORDER) ?? "medium"] ?? 2),
    );
  }

  const rows: OpportunityLedgerRow[] = [];
  const seen = new Set<string>();

  if (match?.lines.length) {
    for (const line of match.lines) {
      if (line.issue_type === "correct") continue;
      const plan = line.expected;
      const key = `${plan.brand}|${plan.product_name}|${line.issue_type}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const expectedFacings = expectedFacingsForRow(plan);
      const dailyInr =
        financial?.level === 2 && financial.estimated_daily_lost_sales_inr > 0
          ? Math.round(financial.estimated_daily_lost_sales_inr / Math.max(match.lines.filter((l) => l.issue_type !== "correct").length, 1))
          : undefined;

      const priority = priorityFromImpact(dailyInr ?? 0, line.issue_type);
      const issueLabel =
        line.issue_type === "missing"
          ? "SKU OOS"
          : line.issue_type === "wrong_product"
            ? "Wrong product on shelf"
            : "Facing gap";

      rows.push({
        id: `opp-${key}`,
        issue: issueLabel,
        sku: plan.product_name,
        brand: plan.brand,
        severity: priority === "critical" ? "critical" : priority,
        priority,
        expected: expectedFacings != null ? String(expectedFacings) : String(line.expected_qty),
        actual: String(line.detected_qty),
        gap:
          expectedFacings != null
            ? String(line.detected_qty - expectedFacings)
            : String(line.detected_qty - line.expected_qty),
        revenue_at_risk_inr: dailyInr ?? null,
        commercial_risk: financial?.level === 1 ? financial.commercial_risk : undefined,
        source: financial?.source ?? "planogram_match",
        confidence: financial?.confidence ?? "indicative",
        recommended_action:
          line.detail ??
          (line.issue_type === "missing"
            ? `Replenish ${plan.brand} ${plan.product_name} and capture a follow-up shelf image.`
            : `Correct ${plan.brand} ${plan.product_name} placement or facings, then rescan.`),
        status: "open",
        commercial_impact_score: commercialImpactScore(dailyInr ?? 0, priority),
      });
    }
  }

  const s = result?.summary;
  if (s?.placement_issue_count && s.placement_issue_count > 0 && !seen.has("placement")) {
    rows.push({
      id: "opp-placement",
      issue: "Placement violations",
      severity: "medium",
      priority: "medium",
      recommended_action: "Review misplaced facings in the audited bay and rescan after correction.",
      status: "open",
      commercial_impact_score: 25,
      source: "scan_analysis",
      confidence: "indicative",
    });
  }

  return rows.sort(
    (a, b) =>
      (b.commercial_impact_score ?? 0) - (a.commercial_impact_score ?? 0) ||
      (PRIORITY_ORDER[(a.priority as keyof typeof PRIORITY_ORDER) ?? "medium"] ?? 2) -
        (PRIORITY_ORDER[(b.priority as keyof typeof PRIORITY_ORDER) ?? "medium"] ?? 2),
  );
}

export type VerificationSnapshot = {
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

export function buildVerificationSnapshot(result?: ScanResult | null): VerificationSnapshot | null {
  const nav = result?.navigation;
  if (nav?.previous_execution_score == null) return null;

  const currentScore = executionScoreFromResult(result);
  const previous = nav.previous_execution_score;
  const current = currentScore ?? undefined;
  const improved = current != null && current > previous;

  const summary = planogramSummaryFromResult(result);
  const expected = summary.expected_sku_count ?? 0;
  const missing = summary.missing ?? 0;
  const detected = Math.max(0, expected - missing);
  const currentAvail = expected ? `${detected}/${expected}` : undefined;

  return {
    previous_score: previous,
    current_score: current ?? null,
    current_target_sku_availability: currentAvail,
    current_planogram_presence: currentAvail,
    improved,
    verified: improved && (missing === 0 || detected === expected),
    summary: improved
      ? "Execution improved vs the previous scan at this location."
      : "Follow-up scan recorded — compare KPIs below to confirm fixes.",
  };
}

function planogramSummaryFromResult(result?: ScanResult | null) {
  return (result?.planogram?.summary as { expected_sku_count?: number; missing?: number }) ?? {};
}
