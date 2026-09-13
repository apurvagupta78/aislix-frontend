/**
 * Planogram vs shelf comparison — display/export helpers (no calculation changes).
 */

import {
  compareDemoOralCarePlanogram,
  DEMO_ORAL_CARE_META,
  DEMO_ORAL_CARE_OBSERVATIONS,
  isDemoOralCareResult,
} from "@/lib/demo-oral-care-planogram";
import {
  comparePlanogramToInventory,
  type PlanogramMatchLine,
  type PlanogramMatchResult,
} from "@/lib/demo-planogram-match";
import { planogramRowsFromResult } from "@/lib/execution-metrics";
import type { PlanogramComparison } from "@/lib/planogram-compliance";
import { normalizeIssueType } from "@/lib/planogram-compliance";
import type { PlanogramRow } from "@/lib/planogram";
import type { ScanResult } from "@/lib/scan-results";

export type PositionDisplayStatus = "match" | "moved" | "low_facings" | "missing" | "review";

export type PositionComparisonRow = {
  position_id: string;
  shelf_key: string;
  shelf_label: string;
  row: PlanogramRow;
  expected_facings: number;
  observed_facings: number;
  observed_location?: string;
  observed_sku?: string;
  observed_product?: string;
  observed_brand?: string;
  status: PositionDisplayStatus;
  status_short: string;
  status_detail: string;
  issue_type: string;
  severity: string;
  confidence?: string;
  review_status: string;
  corrective_action?: string;
  match_line?: PlanogramMatchLine;
};

export type ShelfExecutionSummary = {
  matched: number;
  total: number;
  placement_issues: number;
  facing_deviations: number;
  needs_review: number;
};

function expectedFacings(row: PlanogramRow): number {
  if (row.expected_facings != null && Number.isFinite(Number(row.expected_facings))) {
    return Number(row.expected_facings);
  }
  const qty = Number(row.expected_qty);
  return Number.isFinite(qty) ? qty : 1;
}

function parseShelf(row: PlanogramRow): { key: string; label: string } {
  const level = String(row.expected_shelf_level ?? "").trim();
  if (level) {
    const num = level.replace(/^S/i, "");
    return { key: level.toUpperCase(), label: `Shelf ${num || level}` };
  }
  const pos = String(row.shelf_position ?? "").trim();
  const match = pos.match(/^S(\d+)/i);
  if (match) return { key: `S${match[1]}`, label: `Shelf ${match[1]}` };
  return { key: "Shelf", label: "Shelf" };
}

function isUncertainEvidence(detail?: string | null): boolean {
  if (!detail) return false;
  const d = detail.toLowerCase();
  return (
    d.includes("not clearly visible") ||
    d.includes("uncertain") ||
    d.includes("insufficient") ||
    d.includes("not assessable")
  );
}

function isMovedProduct(line: PlanogramMatchLine): boolean {
  if (line.issue_type !== "wrong_product") return false;
  const detail = line.detail?.toLowerCase() ?? "";
  return detail.includes("shelf") || detail.includes("position") || detail.includes("observed on");
}

function observedShelfFromDetail(detail?: string | null): string | undefined {
  if (!detail) return undefined;
  const observed = detail.match(/observed on shelf (\d+)/i);
  if (observed?.[1]) return `Shelf ${observed[1]}`;
  const observedS = detail.match(/observed on (S\d+)/i);
  if (observedS?.[1]) return observedS[1].replace(/^S/i, "Shelf ");
  return undefined;
}

export function mapLineToDisplayStatus(line: PlanogramMatchLine): {
  status: PositionDisplayStatus;
  short: string;
  detail: string;
} {
  const expected = expectedFacings(line.expected);
  const observed = line.detected_qty ?? 0;
  const detailText = line.detail ?? "";

  if (line.issue_type === "correct") {
    return { status: "match", short: "✓ Match", detail: "" };
  }

  if (isMovedProduct(line)) {
    const foundShelf = observedShelfFromDetail(detailText) ?? "another shelf";
    return {
      status: "moved",
      short: `↔ Found on ${foundShelf}`,
      detail: detailText,
    };
  }

  if (line.issue_type === "qty_mismatch" || (observed > 0 && observed < expected)) {
    const missing = Math.max(0, expected - observed);
    return {
      status: "low_facings",
      short: `! ${observed} found · ${missing} missing`,
      detail: detailText || `Expected ${expected} facings, observed ${observed}.`,
    };
  }

  if (line.issue_type === "missing" || (observed === 0 && !line.present)) {
    if (isUncertainEvidence(detailText)) {
      return { status: "review", short: "? Review", detail: detailText };
    }
    return { status: "missing", short: "✕ Missing", detail: detailText };
  }

  if (line.issue_type === "wrong_product") {
    return {
      status: "review",
      short: "? Review",
      detail: detailText || "Product identity could not be confirmed.",
    };
  }

  return { status: "review", short: "? Review", detail: detailText || "Evidence insufficient." };
}

function resolveMatch(result: ScanResult, rows: PlanogramRow[]): PlanogramMatchResult | null {
  if (!rows.length) return null;
  const demoMode =
    isDemoOralCareResult(result) || result.retail_intelligence?.demo_oral_care === true;
  if (demoMode) return compareDemoOralCarePlanogram(rows);
  const inventory = result.inventory ?? [];
  if (!inventory.length) return null;
  return comparePlanogramToInventory(inventory, rows);
}

function lineForRow(match: PlanogramMatchResult | null, row: PlanogramRow): PlanogramMatchLine | undefined {
  return match?.lines.find((l) => l.expected.shelf_position === row.shelf_position);
}

function comparisonLineForRow(
  comparison: PlanogramComparison | null | undefined,
  row: PlanogramRow,
): PlanogramComparison["lines"][number] | undefined {
  return comparison?.lines.find(
    (l) =>
      l.expected_product?.trim().toLowerCase() === row.product_name.trim().toLowerCase() &&
      (l.expected_brand ?? "").trim().toLowerCase() === row.brand.trim().toLowerCase(),
  );
}

export function buildPositionComparisons(
  result: ScanResult,
  comparison?: PlanogramComparison | null,
): PositionComparisonRow[] {
  const rows = planogramRowsFromResult(result);
  const match = resolveMatch(result, rows);

  return rows.map((row) => {
    const matchLine = lineForRow(match, row);
    const compLine = comparisonLineForRow(comparison, row);
    const mapped = matchLine
      ? mapLineToDisplayStatus(matchLine)
      : compLine
        ? mapComparisonLineToDisplay(compLine, row)
        : { status: "review" as const, short: "? Review", detail: "Not assessable" };

    const { key, label } = parseShelf(row);
    const expected = expectedFacings(row);
    const observed =
      matchLine?.detected_qty ??
      compLine?.actual_qty ??
      (DEMO_ORAL_CARE_OBSERVATIONS[row.shelf_position]?.facings ?? 0);

    const obs = DEMO_ORAL_CARE_OBSERVATIONS[row.shelf_position];
    const observedLoc = obs?.observed_shelf
      ? `${obs.observed_shelf}-${row.shelf_position.split("-")[1]}`
      : matchLine && isMovedProduct(matchLine)
        ? observedShelfFromDetail(matchLine.detail)
        : row.shelf_position;

    const action = comparison?.actions.find(
      (a) =>
        a.suggestion.includes(row.product_name) ||
        a.issue_type === matchLine?.issue_type,
    );

    return {
      position_id: row.shelf_position,
      shelf_key: key,
      shelf_label: label,
      row,
      expected_facings: expected,
      observed_facings: observed,
      observed_location: observedLoc,
      observed_sku: row.sku,
      observed_product: matchLine?.matched_product ?? compLine?.actual_product ?? undefined,
      observed_brand: matchLine?.matched_brand ?? compLine?.actual_brand ?? undefined,
      status: mapped.status,
      status_short: mapped.short,
      status_detail: mapped.detail,
      issue_type: matchLine?.issue_type ?? compLine?.issue_type ?? "unknown",
      severity:
        mapped.status === "missing"
          ? "critical"
          : mapped.status === "match"
            ? "none"
            : mapped.status === "review"
              ? "low"
              : "warning",
      confidence: observed > 0 ? "High" : mapped.status === "review" ? "Low" : "Medium",
      review_status: mapped.status === "review" ? "Needs review" : "Complete",
      corrective_action: action?.suggestion,
      match_line: matchLine,
    };
  });
}

function mapComparisonLineToDisplay(
  line: PlanogramComparison["lines"][number],
  row: PlanogramRow,
): { status: PositionDisplayStatus; short: string; detail: string } {
  const issue = normalizeIssueType(line.issue_type);
  const expected = line.expected_qty ?? expectedFacings(row);
  const observed = line.actual_qty ?? 0;
  const detail = line.detail ?? "";

  if (issue === "ok") return { status: "match", short: "✓ Match", detail: "" };
  if (issue === "wrong_location" || (issue === "wrong_product" && detail.toLowerCase().includes("shelf"))) {
    return {
      status: "moved",
      short: `↔ Found on ${observedShelfFromDetail(detail) ?? "another shelf"}`,
      detail,
    };
  }
  if (issue === "qty_issue" || (observed > 0 && observed < expected)) {
    return {
      status: "low_facings",
      short: `! ${observed} found · ${Math.max(0, expected - observed)} missing`,
      detail,
    };
  }
  if (issue === "missing") {
    if (isUncertainEvidence(detail)) return { status: "review", short: "? Review", detail };
    return { status: "missing", short: "✕ Missing", detail };
  }
  return { status: "review", short: "? Review", detail: detail || "Not assessable" };
}

export function buildShelfExecutionSummary(positions: PositionComparisonRow[]): ShelfExecutionSummary {
  const total = positions.length;
  const matched = positions.filter((p) => p.status === "match").length;
  const placement_issues = positions.filter((p) => p.status === "moved" || p.status === "missing").length;
  const facing_deviations = positions.filter((p) => p.status === "low_facings").length;
  const needs_review = positions.filter((p) => p.status === "review").length;
  return { matched, total, placement_issues, facing_deviations, needs_review };
}

export function planogramComparisonMeta(result: ScanResult) {
  return {
    audit_id: result.location ?? result.scan_id ?? "",
    audit_date: result.created_at ?? "",
    store: result.store ?? "Demo Supermarket",
    fixture: planogramRowsFromResult(result)[0]?.location ?? DEMO_ORAL_CARE_META.fixture_id ?? "",
    category: result.scan_category ?? DEMO_ORAL_CARE_META.category,
    sub_category: result.scan_sub_category ?? DEMO_ORAL_CARE_META.sub_category,
    planogram_version: DEMO_ORAL_CARE_META.version,
  };
}

export const STATUS_PILL: Record<PositionDisplayStatus, string> = {
  match: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
  moved: "bg-amber-500/12 text-amber-900 dark:text-amber-200",
  low_facings: "bg-amber-500/12 text-amber-900 dark:text-amber-200",
  missing: "bg-destructive/10 text-destructive",
  review: "bg-muted text-muted-foreground",
};

export const STATUS_ACCENT: Record<PositionDisplayStatus, string> = {
  match: "border-l-emerald-500/70",
  moved: "border-l-amber-500/70",
  low_facings: "border-l-amber-500/70",
  missing: "border-l-destructive/70",
  review: "border-l-muted-foreground/50",
};
