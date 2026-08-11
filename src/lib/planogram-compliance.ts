/**
 * Planogram compliance for assigned scans.
 *
 * Populated by the scan pipeline when a scan was launched from an assignment
 * (`shelf_scans.assignment_id`). Scans without an assignment have no comparison
 * row, and the results page keeps its "Shelf compliance —" behaviour.
 */

import { supabase } from "@/integrations/supabase/client";

export type ComparisonIssueType =
  | "ok"
  | "missing"
  | "qty_issue"
  | "wrong_product"
  | "wrong_category"
  | "unexpected"
  | string;

export type ComparisonLine = {
  id: string;
  issue_type: ComparisonIssueType;
  expected_brand: string | null;
  expected_product: string | null;
  expected_qty: number | null;
  actual_brand: string | null;
  actual_product: string | null;
  actual_qty: number | null;
  severity: string;
  detail: string | null;
};

export type CorrectiveAction = {
  id: string;
  issue_type: string;
  suggestion: string;
  status: string;
};

export type PlanogramComparison = {
  id: string;
  compliance_percent: number | null;
  summary: {
    expected?: number;
    found?: number;
    missing?: number;
    qty_issues?: number;
    wrong_product?: number;
    wrong_category?: number;
    unexpected?: number;
    [key: string]: unknown;
  };
  created_at: string;
  lines: ComparisonLine[];
  actions: CorrectiveAction[];
};

const numOrNull = (value: unknown) =>
  value === null || value === undefined ? null : Number(value);

/** Latest comparison for a scan, or null when the scan had no assignment. */
export async function fetchPlanogramComparison(
  scanId: string,
): Promise<PlanogramComparison | null> {
  const { data: comparison, error } = await supabase
    .from("planogram_comparisons")
    .select("id, compliance_percent, summary, created_at")
    .eq("scan_id", scanId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !comparison) return null;

  const comparisonId = comparison.id as string;

  const [{ data: lineRows }, { data: actionRows }] = await Promise.all([
    supabase
      .from("planogram_comparison_lines")
      .select(
        "id, issue_type, expected_brand, expected_product, expected_qty, actual_brand, actual_product, actual_qty, severity, detail",
      )
      .eq("comparison_id", comparisonId)
      .order("created_at", { ascending: true }),
    supabase
      .from("corrective_actions")
      .select("id, issue_type, suggestion, status")
      .eq("comparison_id", comparisonId)
      .order("created_at", { ascending: true }),
  ]);

  return {
    id: comparisonId,
    compliance_percent: numOrNull(comparison.compliance_percent),
    summary: (comparison.summary ?? {}) as PlanogramComparison["summary"],
    created_at: comparison.created_at as string,
    lines: (lineRows ?? []).map((row) => ({
      id: row.id as string,
      issue_type: String(row.issue_type ?? "ok"),
      expected_brand: (row.expected_brand as string | null) ?? null,
      expected_product: (row.expected_product as string | null) ?? null,
      expected_qty: numOrNull(row.expected_qty),
      actual_brand: (row.actual_brand as string | null) ?? null,
      actual_product: (row.actual_product as string | null) ?? null,
      actual_qty: numOrNull(row.actual_qty),
      severity: String(row.severity ?? "low"),
      detail: (row.detail as string | null) ?? null,
    })),
    actions: (actionRows ?? []).map((row) => ({
      id: row.id as string,
      issue_type: String(row.issue_type ?? "other"),
      suggestion: String(row.suggestion ?? ""),
      status: String(row.status ?? "open"),
    })),
  };
}

export function complianceTone(value: number | null | undefined): string {
  if (value === null || value === undefined) return "text-muted-foreground";
  if (value >= 90) return "text-success";
  if (value >= 70) return "text-warning";
  return "text-destructive";
}

export function issueLabel(issueType: string): string {
  const map: Record<string, string> = {
    ok: "Compliant",
    missing: "Missing",
    qty_issue: "Qty mismatch",
    wrong_product: "Wrong product",
    wrong_category: "Wrong category",
    unexpected: "Unexpected",
  };
  return map[issueType] ?? issueType.replace(/_/g, " ");
}

export function issueRowClass(issueType: string): string {
  if (issueType === "ok") return "bg-success/5";
  if (issueType === "missing" || issueType === "wrong_product") return "bg-destructive/5";
  if (issueType === "qty_issue" || issueType === "wrong_category") return "bg-warning/5";
  if (issueType === "unexpected") return "bg-brand-soft/40";
  return "";
}
