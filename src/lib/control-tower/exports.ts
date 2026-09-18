import type { ControlTowerDemoPayload } from "./types";
import type { ControlTowerModelFilter } from "./types";
import type { DashboardFilterState } from "@/lib/dashboard-filters";
import { modelFilterLabel } from "./filter-context";

function csvEscape(value: string | number | undefined | null): string {
  let s = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(values: (string | number | undefined | null)[]): string {
  return values.map(csvEscape).join(",");
}

function downloadCsv(filename: string, lines: string[]) {
  const bom = "\uFEFF";
  const blob = new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function metaHeader(
  section: string,
  model: ControlTowerModelFilter,
  filters: DashboardFilterState,
): string[] {
  return [
    "# Aislix Control Tower Export",
    row(["Section", section]),
    row(["Operating Model", modelFilterLabel(model)]),
    row(["Date Range", filters.datePreset ?? "all"]),
    row(["Store Filter", filters.storeId && filters.storeId !== "all" ? filters.storeId : "All"]),
    row(["Category Filter", filters.category && filters.category !== "all" ? filters.category : "All"]),
    row(["Data Source", "Live Control Tower"]),
    row(["Exported At", new Date().toISOString()]),
    "",
  ];
}

export function exportAuditExecutionCsv(
  data: ControlTowerDemoPayload,
  filters: DashboardFilterState,
) {
  const header = row(["Date", "Audit ID", "Store", "City", "Audit Name", "Assigned To", "Stage"]);
  const lines = [
    ...metaHeader("Audit Execution", data.operatingModel, filters),
    header,
    ...data.auditExecutionFull.map((r) =>
      row([r.date, r.auditId, r.location, r.city, r.template, r.assignedTo, r.stage]),
    ),
  ];
  downloadCsv(`audit-execution-${data.operatingModel}.csv`, lines);
}

export function exportRiskLocationsCsv(data: ControlTowerDemoPayload, filters: DashboardFilterState) {
  const header = row(["Location ID", "Location", "Primary Risk Metric", "Risk Score", "Trend", "Operating Model"]);
  const lines = [
    ...metaHeader("Store / Location Risk", data.operatingModel, filters),
    header,
    ...data.riskLocationsFull.map((r) =>
      row([r.id, r.name, r.metric, r.score, r.trend, modelFilterLabel(data.operatingModel)]),
    ),
  ];
  downloadCsv(`location-risk-${data.operatingModel}.csv`, lines);
}

export function exportRiskSkusCsv(data: ControlTowerDemoPayload, filters: DashboardFilterState) {
  const header = row(["SKU", "Product", "Location", "Risk Metric", "Risk Score", "Operating Model"]);
  const lines = [
    ...metaHeader("SKU Risk", data.operatingModel, filters),
    header,
    ...data.riskSkusFull.map((r) =>
      row([r.sku, r.product, r.location, r.metric, r.score, modelFilterLabel(data.operatingModel)]),
    ),
  ];
  downloadCsv(`sku-risk-${data.operatingModel}.csv`, lines);
}

export function exportFindingsCsv(data: ControlTowerDemoPayload, filters: DashboardFilterState) {
  const header = row([
    "Finding ID",
    "Severity",
    "Location",
    "SKU",
    "Issue",
    "Status",
    "Operating Model",
    "Detected At",
  ]);
  const lines = [
    ...metaHeader("Critical Findings", data.operatingModel, filters),
    header,
    ...data.criticalFindingsFull.map((r) =>
      row([
        r.id,
        r.severity,
        r.location,
        r.sku,
        r.issue,
        r.status,
        modelFilterLabel(data.operatingModel),
        r.detectedAt,
      ]),
    ),
  ];
  downloadCsv(`findings-${data.operatingModel}.csv`, lines);
}

export function exportCorrectiveActionsCsv(
  data: ControlTowerDemoPayload,
  filters: DashboardFilterState,
) {
  const header = row([
    "Action ID",
    "Severity",
    "Location",
    "Owner",
    "Due",
    "Status",
    "Operating Model",
  ]);
  const lines = [
    ...metaHeader("Corrective Actions", data.operatingModel, filters),
    header,
    ...data.correctiveActionsFull.map((r) =>
      row([r.id, r.severity, r.location, r.owner, r.due, r.status, modelFilterLabel(data.operatingModel)]),
    ),
  ];
  downloadCsv(`corrective-actions-${data.operatingModel}.csv`, lines);
}

export function exportRecurringIssuesCsv(
  data: ControlTowerDemoPayload,
  filters: DashboardFilterState,
) {
  const header = row([
    "Issue ID",
    "Issue",
    "Frequency",
    "Locations Affected",
    "Last Seen",
    "Value Impact",
    "Operating Model",
  ]);
  const lines = [
    ...metaHeader("Recurring Issues", data.operatingModel, filters),
    header,
    ...data.recurringIssuesFull.map((r) =>
      row([
        r.id,
        r.issue,
        r.frequency,
        r.locations,
        r.lastSeen,
        r.valueImpact,
        modelFilterLabel(data.operatingModel),
      ]),
    ),
  ];
  downloadCsv(`recurring-issues-${data.operatingModel}.csv`, lines);
}

export function exportEvidenceCoverageCsv(
  data: ControlTowerDemoPayload,
  filters: DashboardFilterState,
) {
  const header = row([
    "Unit ID",
    "Audit ID",
    "Location",
    "Evidence Type",
    "Required",
    "Verified",
    "Status",
    "Operating Model",
  ]);
  const lines = [
    ...metaHeader("Evidence Coverage", data.operatingModel, filters),
    header,
    ...data.evidenceCoverageFull.map((r) =>
      row([
        r.unitId,
        r.auditId,
        r.location,
        r.evidenceType,
        r.required ? "Yes" : "No",
        r.verified ? "Yes" : "No",
        r.status,
        modelFilterLabel(data.operatingModel),
      ]),
    ),
  ];
  downloadCsv(`evidence-coverage-${data.operatingModel}.csv`, lines);
}

export function exportOperationalTrendCsv(
  data: ControlTowerDemoPayload,
  filters: DashboardFilterState,
) {
  const keys = Object.keys(data.operationalTrend[0] ?? {}).filter((k) => k !== "date");
  const header = row(["Date", ...keys, "Operating Model"]);
  const lines = [
    ...metaHeader("Operational Trend", data.operatingModel, filters),
    header,
    ...data.operationalTrend.map((point) => {
      const vals = keys.map((k) => (point as Record<string, string | number>)[k]);
      return row([point.date, ...vals, modelFilterLabel(data.operatingModel)]);
    }),
  ];
  downloadCsv(`operational-trend-${data.operatingModel}.csv`, lines);
}

export function exportKpiCsv(data: ControlTowerDemoPayload, filters: DashboardFilterState) {
  const all = [...data.universalKpis, ...data.contextualKpis];
  const header = row(["KPI ID", "KPI", "Value", "Detail", "Tone", "Source", "Operating Model"]);
  const lines = [
    ...metaHeader("KPI Snapshot", data.operatingModel, filters),
    header,
    ...all.map((k) =>
      row([
        k.id,
        k.label,
        k.value,
        k.detail,
        k.tone,
        k.source ?? "Demo",
        modelFilterLabel(data.operatingModel),
      ]),
    ),
  ];
  downloadCsv(`control-tower-kpis-${data.operatingModel}.csv`, lines);
}
