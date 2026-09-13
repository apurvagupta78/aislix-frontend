/**
 * Recommended actions CSV export — full issue/action details.
 */

import {
  buildRecommendedActionCards,
  recommendedActionsMeta,
  type RecommendedActionCard,
} from "@/lib/recommended-actions-display";
import { downloadCsvFile } from "@/lib/kpi-details-csv";
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

function variance(card: RecommendedActionCard): string {
  if (card.expected_value && card.observed_value) {
    return `${card.expected_value} → ${card.observed_value}`;
  }
  return "";
}

export function buildRecommendedActionsCsv(result: ScanResult): string {
  const meta = recommendedActionsMeta(result);
  const cards = buildRecommendedActionCards(result);
  const lines: string[] = [
    "# Aislix Recommended Actions Export",
    row(["Audit ID", meta.audit_id]),
    row(["Audit Date", formatTimestamp(meta.audit_date)]),
    row(["Store", meta.store]),
    row(["Fixture", meta.fixture]),
    row(["Role", meta.role]),
    row(["Category", meta.category]),
    row(["Sub-category", meta.sub_category]),
    row(["Planogram Version", meta.planogram_version]),
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
      "Confidence",
      "Coverage",
      "Evidence Reference",
      "Created At",
    ]),
  ];

  for (const card of cards) {
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
        card.id,
        card.priority,
        card.priority,
        card.issue_type,
        card.sku ?? "",
        card.product_name ?? "",
        card.brand ?? "",
        card.shelf ?? "",
        card.location ?? "",
        card.expected_result ?? "",
        card.observed_result ?? "",
        card.expected_value ?? "",
        card.observed_value ?? "",
        variance(card),
        card.recommended_action,
        card.review_status,
        card.confidence ?? "",
        card.coverage ?? "",
        `${meta.audit_id}:${card.id}`,
        formatTimestamp(meta.audit_date),
      ]),
    );
  }

  return lines.join("\n");
}

export function downloadRecommendedActionsCsv(result: ScanResult): void {
  const scan = result.scan_id ?? "audit";
  downloadCsvFile(`aislix-${scan}-recommended-actions.csv`, buildRecommendedActionsCsv(result));
}
