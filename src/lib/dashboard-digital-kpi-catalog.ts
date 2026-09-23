/**
 * Digital dashboard KPI catalog — deterministic formulas shown in UI tooltips.
 * Calculations remain in dashboard-ai-digital; this is the display contract only.
 */

export type DigitalKpiCatalogEntry = {
  id: string;
  name: string;
  definition: string;
  formula: string;
  unit: string;
  naWhen?: string;
};

export const DIGITAL_KPI_CATALOG: Record<string, DigitalKpiCatalogEntry> = {
  kpi_total: {
    id: "kpi_total",
    name: "Total Digital Audits",
    definition: "All digital assignments in the active filter scope.",
    formula: "COUNT(digital assignments)",
    unit: "count",
  },
  kpi_completed: {
    id: "kpi_completed",
    name: "Completed",
    definition: "Digital audits submitted, completed, or approved.",
    formula: "COUNT(status completed OR submitted OR approved)",
    unit: "count",
  },
  kpi_in_progress: {
    id: "kpi_in_progress",
    name: "In Progress",
    definition: "Digital audits currently in progress.",
    formula: "COUNT(status = in_progress)",
    unit: "count",
  },
  kpi_pending_review: {
    id: "kpi_pending_review",
    name: "Pending Review",
    definition: "Submitted audits awaiting review/approval.",
    formula: "COUNT(pending_review OR submitted)",
    unit: "count",
  },
  kpi_reaudit_requested: {
    id: "kpi_reaudit_requested",
    name: "Re-audit Requested",
    definition: "Audits marked for re-audit or needs correction.",
    formula: "COUNT(reaudit_required OR needs_correction)",
    unit: "count",
  },
  kpi_overdue: {
    id: "kpi_overdue",
    name: "Overdue",
    definition: "Open digital audits past due date.",
    formula: "COUNT(due_at < now AND not completed/approved)",
    unit: "count",
  },
  kpi_completion_pct: {
    id: "kpi_completion_pct",
    name: "Completion %",
    definition: "Share of digital audits completed in scope.",
    formula: "completed / total × 100",
    unit: "%",
    naWhen: "No digital audits in scope",
  },
  kpi_ontime_pct: {
    id: "kpi_ontime_pct",
    name: "On-Time Completion %",
    definition: "Completed audits submitted on or before due date.",
    formula: "on_time_completed / completed_with_due × 100",
    unit: "%",
    naWhen: "No completed audits with due dates",
  },
  kpi_total_expected: {
    id: "kpi_total_expected",
    name: "Total Expected",
    definition: "Sum of expected qty where Expected+Actual are mapped.",
    formula: "SUM(expected_qty) for mapped lines",
    unit: "units",
    naWhen: "No Expected+Actual mapped lines",
  },
  kpi_total_actual: {
    id: "kpi_total_actual",
    name: "Total Actual",
    definition: "Sum of actual qty where Expected+Actual are mapped.",
    formula: "SUM(actual_qty) for mapped lines",
    unit: "units",
    naWhen: "No Expected+Actual mapped lines",
  },
  kpi_net_variance: {
    id: "kpi_net_variance",
    name: "Net Variance",
    definition: "Aggregate actual minus expected across mapped lines.",
    formula: "SUM(actual − expected)",
    unit: "units",
    naWhen: "No Expected+Actual mapped lines",
  },
  kpi_abs_variance: {
    id: "kpi_abs_variance",
    name: "Absolute Variance",
    definition: "Sum of absolute row variances (not average of %).",
    formula: "SUM(|actual − expected|)",
    unit: "units",
    naWhen: "No Expected+Actual mapped lines",
  },
  kpi_variance_pct: {
    id: "kpi_variance_pct",
    name: "Variance %",
    definition: "Aggregate variance percent from totals.",
    formula: "(SUM(actual) − SUM(expected)) / SUM(expected) × 100",
    unit: "%",
    naWhen: "SUM(expected) = 0 or no mapped lines",
  },
  kpi_ca_open: {
    id: "kpi_ca_open",
    name: "Open CA",
    definition: "Corrective actions not closed/resolved/cancelled.",
    formula: "COUNT(CA where status not terminal)",
    unit: "count",
  },
  kpi_ca_in_progress: {
    id: "kpi_ca_in_progress",
    name: "CA In Progress",
    definition: "Corrective actions actively in progress.",
    formula: "COUNT(CA status = in_progress)",
    unit: "count",
  },
  kpi_ca_completed: {
    id: "kpi_ca_completed",
    name: "CA Completed",
    definition: "Closed or resolved corrective actions.",
    formula: "COUNT(CA closed OR resolved)",
    unit: "count",
  },
  kpi_ca_overdue: {
    id: "kpi_ca_overdue",
    name: "Overdue CA",
    definition: "Open CAs past due date.",
    formula: "COUNT(open CA AND due_at < now)",
    unit: "count",
  },
  kpi_ca_closure: {
    id: "kpi_ca_closure",
    name: "Action Closure Rate",
    definition: "Share of corrective actions completed.",
    formula: "completed CA / total CA × 100",
    unit: "%",
    naWhen: "No corrective actions",
  },
  kpi_ca_sla: {
    id: "kpi_ca_sla",
    name: "SLA Compliance %",
    definition: "Completed CAs finished on or before due date.",
    formula: "on_time_completed_CA / completed_CA_with_due × 100",
    unit: "%",
    naWhen: "No completed CAs with due dates",
  },
};

export function digitalKpiTooltip(id: string): string | undefined {
  const e = DIGITAL_KPI_CATALOG[id];
  if (!e) return undefined;
  const na = e.naWhen ? ` · N/A: ${e.naWhen}` : "";
  return `${e.definition} Formula: ${e.formula}${na}`;
}
