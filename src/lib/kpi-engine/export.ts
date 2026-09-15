/**
 * Reusable CSV export for KPI datasets — used by Control Tower and future reports.
 */

import type { DashboardFilterState } from "@/lib/dashboard-filters";
import type { KpiDefinition } from "./definitions";

function csvEscape(value: string | number | undefined | null): string {
  let s = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(values: (string | number | undefined | null)[]): string {
  return values.map(csvEscape).join(",");
}

export type DownloadCsvOptions = {
  filename: string;
  section: string;
  columns: string[];
  rows: Record<string, string | number>[];
  filters?: DashboardFilterState;
  operatingModel?: string;
  dataSourceNote?: string;
};

export function downloadCsvDataset(options: DownloadCsvOptions): void {
  const { filename, section, columns, rows, filters, operatingModel, dataSourceNote } = options;
  const meta: string[] = [
    "# Aislix KPI Export",
    row(["Section", section]),
    row(["Operating Model", operatingModel ?? "All"]),
    row(["Date Range", filters?.dateRange ?? "30d"]),
    row(["Store Filter", filters?.storeId ?? "All"]),
    row(["Category Filter", filters?.category ?? "All"]),
    row(["Data Source", dataSourceNote ?? "Illustrative demo data (Phase 1E)"]),
    row(["Exported At", new Date().toISOString()]),
    "",
    row(columns),
    ...rows.map((r) => row(columns.map((c) => r[c] ?? ""))),
  ];

  const bom = "\uFEFF";
  const blob = new Blob([bom + meta.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportKpiCsv(
  kpi: KpiDefinition,
  demoRows: Record<string, string | number>[],
  filters: DashboardFilterState,
  operatingModel: string,
): void {
  downloadCsvDataset({
    filename: `aislix-${kpi.id}.csv`,
    section: kpi.name,
    columns: kpi.csvColumns,
    rows: demoRows,
    filters,
    operatingModel,
    dataSourceNote: kpi.dataSource,
  });
}
