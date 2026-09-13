/**
 * Role-scoped Excel workbook — one sheet per relevant KPI/metric.
 */

import * as XLSX from "xlsx";
import { buildKpiDetailCsv } from "@/lib/kpi-details-csv";
import { KPI_DISPLAY_LABEL } from "@/lib/kpi-results-display";
import { primaryKpiIds, type AuditRoleTab } from "@/lib/role-audit-ui";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import { downloadBlobBytes, type ScanResult } from "@/lib/scan-results";

function excelSheetName(label: string): string {
  return label.replace(/[\\/?*[\]:]/g, "").slice(0, 31);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function csvToRows(csv: string): (string | number)[][] {
  return csv
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => parseCsvLine(line));
}

function appendSheet(wb: XLSX.WorkBook, name: string, rows: (string | number)[][]) {
  if (!rows.length) return;
  const sheet = XLSX.utils.aoa_to_sheet(rows.map((row) => row.map((cell) => cell ?? "")));
  const ref = sheet["!ref"];
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    sheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: range.e.r, c: range.e.c },
      }),
    };
  }
  XLSX.utils.book_append_sheet(wb, sheet, excelSheetName(name));
}

function buildObservedProductsSheet(result: ScanResult): (string | number)[][] {
  const header = ["Brand", "Product", "Variant", "Category", "Visible facings", "Confidence %", "Status"];
  const rows = (result.inventory ?? []).map((row) => [
    row.brand,
    row.product,
    row.variant ?? "",
    row.category ?? "",
    row.quantity ?? 0,
    row.confidence != null ? Math.round(row.confidence * (row.confidence <= 1 ? 100 : 1)) : "",
    row.out_of_stock ? "Out of stock" : row.low_stock ? "Low stock" : "In stock",
  ]);
  return [header, ...rows];
}

function buildIssuesSheet(result: ScanResult): (string | number)[][] {
  const header = ["Priority", "Title", "Detail", "Category"];
  const recs = (result.recommendations ?? []).map((r) => [
    r.impact ?? "medium",
    r.title,
    r.detail ?? "",
    r.category ?? "",
  ]);
  const alerts = (result.compliance_alerts ?? []).map((a) => [
    a.severity ?? "medium",
    a.title,
    a.detail ?? a.interpretation ?? "",
    "Compliance",
  ]);
  return [header, ...recs, ...alerts];
}

function buildSummarySheet(result: ScanResult, role: AuditRoleTab): (string | number)[][] {
  return [
    ["Field", "Value"],
    ["Audit ID", result.scan_id ?? ""],
    ["Store", result.store ?? ""],
    ["Fixture", result.location ?? result.aisle ?? ""],
    ["Category", result.scan_category ?? ""],
    ["Sub-category", result.scan_sub_category ?? ""],
    ["Role", role],
    ["Audit date", result.created_at ?? ""],
    ["Executive summary", result.executive_summary ?? ""],
  ];
}

/** Build a multi-tab Excel workbook with one sheet per role-relevant KPI. */
export function buildRoleAuditExcel(result: ScanResult, role: AuditRoleTab): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  appendSheet(wb, "Summary", buildSummarySheet(result, role));

  for (const kpiId of primaryKpiIds(role)) {
    const label = KPI_DISPLAY_LABEL[kpiId] ?? kpiId;
    const csv = buildKpiDetailCsv(result, role, kpiId);
    appendSheet(wb, label, csvToRows(csv));
  }

  appendSheet(wb, "Observed Products", buildObservedProductsSheet(result));
  appendSheet(wb, "Issues", buildIssuesSheet(result));

  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

export function downloadRoleAuditExcel(result: ScanResult, role: AuditRoleTab): void {
  const slug = result.scan_id || "demo";
  const buffer = buildRoleAuditExcel(result, role);
  if (!buffer?.byteLength) {
    throw new Error("Could not generate Excel report — no audit data available.");
  }
  downloadBlobBytes(
    buffer,
    `aislix-${slug}-audit-report.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
