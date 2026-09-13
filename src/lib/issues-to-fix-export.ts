/**
 * Issues to fix CSV export — one row per issue with full action metadata.
 */

import {
  buildIssuesToFixView,
  issuesToFixMeta,
  type IssueItem,
} from "@/lib/issues-to-fix-display";
import { downloadCsvFile } from "@/lib/kpi-details-csv";
import { exceptionCategoryLabel } from "@/lib/unified-exceptions";
import type { PlanogramComparison } from "@/lib/planogram-compliance";
import type { ScanResult } from "@/lib/scan-results";

function csvEscape(value: string | number | undefined | null): string {
  let s = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(values: (string | number | undefined | null)[]): string {
  return values.map(csvEscape).join(",");
}

function formatTimestamp(iso?: string): string {
  if (!iso) return new Date().toISOString();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString();
}

function variance(item: IssueItem): string {
  if (item.expected_value && item.observed_value) {
    return `${item.expected_value} → ${item.observed_value}`;
  }
  return "";
}

function flattenIssues(
  result: ScanResult,
  comparison?: PlanogramComparison | null,
  demoMode?: boolean,
): IssueItem[] {
  return buildIssuesToFixView(result, comparison, demoMode).groups.flatMap((g) => g.items);
}

export function buildIssuesToFixCsv(
  result: ScanResult,
  comparison?: PlanogramComparison | null,
  demoMode?: boolean,
): string {
  const meta = issuesToFixMeta(result);
  const items = flattenIssues(result, comparison, demoMode);
  const lines: string[] = [
    "# Aislix Issues to Fix Export",
    row(["Audit ID", meta.audit_id]),
    row(["Audit Date", formatTimestamp(meta.audit_date)]),
    "",
    row([
      "Audit ID",
      "Audit Date",
      "Store",
      "Fixture",
      "Role",
      "Category",
      "Sub-category",
      "Planogram Version",
      "Issue ID",
      "Issue Group",
      "Priority",
      "Severity",
      "Issue Type",
      "SKU",
      "Product Name",
      "Brand",
      "Shelf",
      "Location",
      "Expected Result",
      "Observed Result",
      "Expected Value",
      "Observed Value",
      "Variance",
      "Recommended Action",
      "Review Status",
      "Detection Confidence",
      "Coverage",
      "Evidence Reference",
      "Created At",
      "Resolved At",
      "Resolution Notes",
      "Action Status",
    ]),
  ];

  for (const item of items) {
    lines.push(
      row([
        meta.audit_id,
        formatTimestamp(meta.audit_date),
        meta.store,
        meta.fixture,
        meta.role,
        meta.category,
        meta.sub_category,
        meta.planogram_version,
        item.id,
        exceptionCategoryLabel(item.group_key),
        item.priority,
        item.priority,
        item.issue_type,
        item.sku ?? "",
        item.product_name ?? "",
        item.brand ?? "",
        item.shelf ?? "",
        item.location ?? "",
        item.expected ?? "",
        item.observed ?? "",
        item.expected_value ?? "",
        item.observed_value ?? "",
        variance(item),
        item.next_step,
        item.review_status,
        item.confidence ?? "",
        item.coverage ?? "",
        `${meta.audit_id}:${item.id}`,
        formatTimestamp(meta.audit_date),
        "",
        "",
        item.action_status,
      ]),
    );
  }

  return lines.join("\n");
}

export function downloadIssuesToFixCsv(
  result: ScanResult,
  comparison?: PlanogramComparison | null,
  demoMode?: boolean,
): void {
  const scan = result.scan_id ?? "audit";
  downloadCsvFile(
    `aislix-${scan}-issues-to-fix.csv`,
    buildIssuesToFixCsv(result, comparison, demoMode),
  );
}
