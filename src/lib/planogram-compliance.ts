/**
 * Planogram compliance for assigned audits.
 *
 * Populated by the audit pipeline when an audit was launched from an assignment
 * (`shelf_scans.assignment_id`). Scans without an assignment have no comparison
 * row, and the results page keeps its "Shelf compliance —" behaviour.
 */

import { supabase } from "@/integrations/supabase/client";

export type ComparisonIssueType =
  "ok" | "missing" | "qty_issue" | "wrong_product" | "wrong_category" | "unexpected" | string;

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

/** Latest comparison for an audit, or null when the audit had no assignment. */
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

/**
 * The vision backend sends `expected_products` / `products_found` style keys,
 * while earlier payloads used short names. Normalise both shapes so the summary
 * tiles never render "—" when the data exists.
 */
export const SUMMARY_TILES: { key: string; label: string; aliases: string[] }[] = [
  { key: "expected", label: "Expected", aliases: ["expected_products", "expected"] },
  {
    key: "found",
    label: "Found",
    aliases: ["products_found", "found_products", "correct_products", "found", "correct"],
  },
  { key: "missing", label: "Missing", aliases: ["missing_products", "missing"] },
  {
    key: "qty_issues",
    label: "Qty issues",
    aliases: ["quantity_issues", "qty_mismatch", "qty_issues"],
  },
  { key: "wrong_product", label: "Wrong product", aliases: ["wrong_products", "wrong_product"] },
  { key: "wrong_category", label: "Wrong category", aliases: ["wrong_category", "wrong_categories"] },
  { key: "unexpected", label: "Unexpected", aliases: ["unexpected_products", "unexpected"] },
];

function readCount(summary: Record<string, unknown>, aliases: string[]): number | null {
  for (const alias of aliases) {
    const raw = summary[alias];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw)))
      return Number(raw);
  }
  return null;
}

/** Normalised summary counts keyed by tile key. */
export function summaryCounts(
  summary: PlanogramComparison["summary"] | null | undefined,
): Record<string, number | null> {
  const source = (summary ?? {}) as Record<string, unknown>;
  const out: Record<string, number | null> = {};
  for (const tile of SUMMARY_TILES) out[tile.key] = readCount(source, tile.aliases);
  return out;
}

export function complianceTone(value: number | null | undefined): string {
  if (value === null || value === undefined) return "text-muted-foreground";
  if (value >= 90) return "text-success";
  if (value >= 70) return "text-warning";
  return "text-destructive";
}

/** Backend sends several spellings for the same issue; collapse them. */
export function normalizeIssueType(issueType: string): string {
  const value = String(issueType ?? "").toLowerCase().trim();
  if (["ok", "correct", "compliant", "match", "matched"].includes(value)) return "ok";
  if (["qty_issue", "qty_mismatch", "quantity_mismatch", "quantity_issue"].includes(value))
    return "qty_issue";
  if (["wrong_product", "wrong_sku"].includes(value)) return "wrong_product";
  if (["wrong_category", "wrong_sub_category"].includes(value)) return "wrong_category";
  if (["wrong_location", "misplaced"].includes(value)) return "wrong_location";
  if (["missing", "not_found", "out_of_stock"].includes(value)) return "missing";
  if (["unexpected", "extra"].includes(value)) return "unexpected";
  return value || "ok";
}

export function issueLabel(issueType: string): string {
  const map: Record<string, string> = {
    ok: "Correct",
    missing: "Missing",
    qty_issue: "Qty mismatch",
    wrong_product: "Wrong product",
    wrong_category: "Wrong category",
    wrong_location: "Wrong location",
    unexpected: "Unexpected",
  };
  const key = normalizeIssueType(issueType);
  return map[key] ?? key.replace(/_/g, " ");
}

/** Colour-coded badge classes per spec (green / red / amber / orange / gray). */
export function issueBadgeClass(issueType: string): string {
  const key = normalizeIssueType(issueType);
  if (key === "ok") return "bg-success/10 text-success";
  if (key === "missing") return "bg-destructive/10 text-destructive";
  if (key === "qty_issue") return "bg-warning/10 text-warning";
  if (key === "wrong_product" || key === "wrong_category" || key === "wrong_location")
    return "bg-warning/15 text-warning";
  if (key === "unexpected") return "bg-muted text-muted-foreground";
  return "bg-muted text-muted-foreground";
}

export function issueRowClass(issueType: string): string {
  const key = normalizeIssueType(issueType);
  if (key === "ok") return "bg-success/5";
  if (key === "missing" || key === "wrong_product") return "bg-destructive/5";
  if (key === "qty_issue" || key === "wrong_category" || key === "wrong_location")
    return "bg-warning/5";
  if (key === "unexpected") return "bg-brand-soft/40";
  return "";
}

