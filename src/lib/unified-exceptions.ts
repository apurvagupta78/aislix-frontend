/**
 * Aggregates shelf audit exceptions from planogram, actions, compliance, and review queue.
 */

import { issueLabel, normalizeIssueType, type PlanogramComparison } from "@/lib/planogram-compliance";
import type { RetailIntelligencePayload } from "@/lib/retail-intelligence";
import {
  buildActionCenterItems,
  buildDetailedActions,
  type DetailedActionItem,
} from "@/lib/scan-execution";
import { needsReviewFacings, type ScanResult } from "@/lib/scan-results";
import type { ResultViewMode } from "@/lib/customer-context";

export type ExceptionCategory =
  | "planogram"
  | "availability"
  | "placement"
  | "pricing"
  | "promotion"
  | "review"
  | "compliance"
  | "action"
  | "opportunity";

export type UnifiedException = {
  id: string;
  category: ExceptionCategory;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  detail?: string;
  expected?: string;
  actual?: string;
  source: string;
};

const CATEGORY_LABELS: Record<ExceptionCategory, string> = {
  planogram: "Planogram",
  availability: "Availability",
  placement: "Placement",
  pricing: "Pricing",
  promotion: "Promotion",
  review: "AI review",
  compliance: "Compliance",
  action: "Recommended action",
  opportunity: "Opportunity",
};

export function exceptionCategoryLabel(category: ExceptionCategory): string {
  return CATEGORY_LABELS[category] ?? category;
}

const SEVERITY_ORDER: Record<UnifiedException["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function severityFromString(value?: string): UnifiedException["severity"] {
  const v = (value ?? "").toLowerCase();
  if (v === "critical") return "critical";
  if (v === "high") return "high";
  if (v === "low") return "low";
  return "medium";
}

function pushUnique(out: UnifiedException[], seen: Set<string>, row: UnifiedException) {
  if (seen.has(row.id)) return;
  seen.add(row.id);
  out.push(row);
}

/** Merge all exception sources for the unified dashboard. */
export function buildUnifiedExceptions(
  result?: ScanResult | null,
  comparison?: PlanogramComparison | null,
  view?: ResultViewMode,
): UnifiedException[] {
  if (!result) return [];
  const out: UnifiedException[] = [];
  const seen = new Set<string>();

  for (const item of buildActionCenterItems(result)) {
    const category: ExceptionCategory =
      item.id === "planogram"
        ? "planogram"
        : item.id === "placement"
          ? "placement"
          : "availability";
    pushUnique(out, seen, {
      id: `action-center-${item.id}`,
      category,
      severity: item.severity,
      title: item.label,
      detail: item.detail,
      source: "Action center",
    });
  }

  for (const action of buildDetailedActions(result, view)) {
    pushUnique(out, seen, {
      id: `nba-${action.action_id}`,
      category: "action",
      severity: severityFromString(action.priority),
      title: action.title,
      detail: action.recommended_action || action.reason,
      expected: action.expected_state,
      actual: action.actual_state,
      source: "Next best action",
    });
  }

  for (const line of comparison?.lines ?? []) {
    if (normalizeIssueType(line.issue_type) === "ok") continue;
    pushUnique(out, seen, {
      id: `planogram-line-${line.id}`,
      category: "planogram",
      severity: severityFromString(line.severity),
      title: issueLabel(line.issue_type),
      detail: line.detail ?? undefined,
      expected: [line.expected_brand, line.expected_product].filter(Boolean).join(" · ") || undefined,
      actual: [line.actual_brand, line.actual_product].filter(Boolean).join(" · ") || undefined,
      source: "Planogram comparison",
    });
  }

  for (const action of comparison?.actions ?? []) {
    pushUnique(out, seen, {
      id: `planogram-action-${action.id}`,
      category: "planogram",
      severity: "medium",
      title: issueLabel(action.issue_type),
      detail: action.suggestion,
      source: "Corrective action",
    });
  }

  for (const [i, alert] of (result.compliance_alerts ?? []).entries()) {
    pushUnique(out, seen, {
      id: `compliance-${i}-${alert.id ?? i}`,
      category: "compliance",
      severity: alert.alert.severity as string === "critical" ? "critical" : alert.severity === "high" ? "high" : "medium",
      title: alert.title,
      detail: alert.detail ?? alert.interpretation,
      expected: alert.expected_sub_category_label,
      source: "Placement compliance",
    });
  }

  for (const facing of needsReviewFacings(result)) {
    pushUnique(out, seen, {
      id: `review-${facing.id}`,
      category: "review",
      severity: "medium",
      title: `${facing.brand} · ${facing.product}`,
      detail: facing.pack_text ? `OCR: “${facing.pack_text}”` : "Low-confidence recognition",
      source: "AI review queue",
    });
  }

  const ri = result.retail_intelligence as RetailIntelligencePayload | undefined;
  for (const [i, row] of (ri?.opportunity_ledger ?? []).entries()) {
    pushUnique(out, seen, {
      id: `opportunity-${i}-${row.id ?? row.sku ?? i}`,
      category: "opportunity",
      severity: row.priority === "high" || row.severity === "high" ? "high" : "medium",
      title: row.issue ?? row.sku ?? row.brand ?? "Revenue opportunity",
      detail: row.recommended_action ?? row.evidence,
      expected: row.expected,
      actual: row.actual,
      source: "Opportunity ledger",
    });
  }

  const priceExceptions = (result as { metrics?: { planogram_compliance?: { price_exceptions?: unknown[] } } })
    .metrics?.planogram_compliance?.price_exceptions;
  if (Array.isArray(priceExceptions)) {
    for (const [i, raw] of priceExceptions.entries()) {
      const row = raw as Record<string, unknown>;
      pushUnique(out, seen, {
        id: `price-${i}-${row.sku ?? i}`,
        category: "pricing",
        severity: "high",
        title: String(row.product ?? row.sku ?? "Price mismatch"),
        detail: String(row.detail ?? row.issue ?? "Price does not match planogram"),
        expected: row.expected_price != null ? String(row.expected_price) : undefined,
        actual: row.actual_price != null ? String(row.actual_price) : undefined,
        source: "Price audit",
      });
    }
  }

  out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return out;
}

export function exceptionCountsByCategory(
  rows: UnifiedException[],
): Partial<Record<ExceptionCategory, number>> {
  const counts: Partial<Record<ExceptionCategory, number>> = {};
  for (const row of rows) {
    counts[row.category] = (counts[row.category] ?? 0) + 1;
  }
  return counts;
}

export function filterExceptions(
  rows: UnifiedException[],
  opts: { category?: ExceptionCategory | "all"; severity?: UnifiedException["severity"] | "all"; query?: string },
): UnifiedException[] {
  const q = (opts.query ?? "").trim().toLowerCase();
  return rows.filter((row) => {
    if (opts.category && opts.category !== "all" && row.category !== opts.category) return false;
    if (opts.severity && opts.severity !== "all" && row.severity !== opts.severity) return false;
    if (!q) return true;
    const hay = [row.title, row.detail, row.expected, row.actual, row.source].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });
}

export type { DetailedActionItem };
