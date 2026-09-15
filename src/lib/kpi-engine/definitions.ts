/**
 * Centralized KPI catalog — dashboards, reports, intelligence and exports consume this layer.
 */

import type { OperatingModel, StandardFieldConcept } from "@/lib/audit-builder/types";

export type KpiLayer = "universal" | "operating_model" | "audit_specific";

export type KpiDataSourceRole =
  | "master_data"
  | "manager_csv"
  | "auditor_input"
  | "ai_suggested"
  | "human_confirmed"
  | "calculated"
  | "findings"
  | "corrective_actions"
  | "historical_audits";

export type KpiDefinition = {
  id: string;
  name: string;
  layer: KpiLayer;
  description: string;
  calculation: string;
  dataSource: string;
  dataSourceRoles: KpiDataSourceRole[];
  requiredConcepts?: StandardFieldConcept[];
  requiredPurposes?: string[];
  unit: "percent" | "count" | "currency" | "score" | "ratio";
  format: "percent" | "integer" | "decimal" | "currency_inr";
  operatingModels?: OperatingModel[];
  interpretation: string;
  whyItMatters?: string;
  unavailableReason?: string;
  csvColumns: string[];
};

export const KPI_CATALOG: KpiDefinition[] = [
  {
    id: "audit_completion",
    name: "Audit Completion %",
    layer: "universal",
    description: "Share of assigned audits completed within the selected period.",
    calculation: "Completed assignments / Total assignments × 100",
    dataSource: "scan_assignments (status = approved or submitted)",
    dataSourceRoles: ["historical_audits"],
    unit: "percent",
    format: "percent",
    interpretation: "Higher is better. Below 80% may indicate capacity or assignment issues.",
    whyItMatters: "Measures field execution discipline and audit program coverage.",
    csvColumns: ["Audit ID", "Status", "Location", "Template", "Assigned To", "Due Date", "Completed At"],
  },
  {
    id: "evidence_coverage",
    name: "Evidence Coverage %",
    layer: "universal",
    description: "Required evidence units verified vs required.",
    calculation: "Verified evidence units / Required evidence units × 100",
    dataSource: "audit evidence records linked to assignments",
    dataSourceRoles: ["auditor_input", "historical_audits"],
    unit: "percent",
    format: "percent",
    interpretation: "Below 90% indicates audit integrity risk.",
    csvColumns: ["Unit ID", "Audit ID", "Location", "Evidence Type", "Required", "Verified", "Status"],
  },
  {
    id: "audit_pass",
    name: "Audit Pass %",
    layer: "universal",
    description: "Completed audits that passed configured scoring thresholds.",
    calculation: "Passed audits / Completed audits × 100",
    dataSource: "audit submissions with scoring_config",
    dataSourceRoles: ["calculated", "historical_audits"],
    unit: "percent",
    format: "percent",
    interpretation: "Declining pass rate signals systemic execution issues.",
    csvColumns: ["Audit ID", "Template", "Score", "Pass Threshold", "Result", "Location"],
  },
  {
    id: "value_variance",
    name: "Potential Inventory Value Variance",
    layer: "universal",
    description: "Potential financial impact from quantity variance using MRP/reference price.",
    calculation: "Σ|Actual − Expected| × MRP (where both quantity fields exist)",
    dataSource: "Audit responses mapped to Expected Quantity, Actual Quantity and MRP",
    dataSourceRoles: ["manager_csv", "auditor_input", "calculated"],
    requiredConcepts: ["expected_quantity", "actual_quantity"],
    unit: "currency",
    format: "currency_inr",
    interpretation: "Potential — not confirmed loss. Use for prioritization, not accounting.",
    csvColumns: ["Location", "SKU", "Expected Qty", "Actual Qty", "Variance", "MRP", "Value Impact", "Audit ID"],
  },
  {
    id: "open_findings",
    name: "Open Findings",
    layer: "universal",
    description: "Unresolved findings across selected scope.",
    calculation: "Count of findings where status ≠ closed",
    dataSource: "findings table",
    dataSourceRoles: ["findings"],
    unit: "count",
    format: "integer",
    interpretation: "Track critical vs high/medium separately.",
    csvColumns: ["Finding ID", "Severity", "Location", "SKU", "Issue", "Status", "Detected At"],
  },
  {
    id: "critical_findings",
    name: "Critical Findings",
    layer: "universal",
    description: "Unresolved critical and high severity findings.",
    calculation: "Count where severity ∈ {critical, high} AND status ≠ closed",
    dataSource: "findings table",
    dataSourceRoles: ["findings"],
    unit: "count",
    format: "integer",
    interpretation: "Requires immediate action when > 0.",
    csvColumns: ["Finding ID", "Severity", "Location", "SKU", "Issue", "Status", "SLA Due"],
  },
  {
    id: "open_actions",
    name: "Open Corrective Actions",
    layer: "universal",
    description: "Non-closed corrective actions.",
    calculation: "Count where status ≠ closed",
    dataSource: "corrective_actions table",
    dataSourceRoles: ["corrective_actions"],
    unit: "count",
    format: "integer",
    interpretation: "Rising open actions indicate unresolved root causes.",
    csvColumns: ["Action ID", "Finding ID", "Owner", "Due Date", "Status", "Severity"],
  },
  {
    id: "overdue_actions",
    name: "Overdue Actions",
    layer: "universal",
    description: "Corrective actions past due date and not closed.",
    calculation: "Count where due_date < today AND status ≠ closed",
    dataSource: "corrective_actions table",
    dataSourceRoles: ["corrective_actions"],
    unit: "count",
    format: "integer",
    interpretation: "Each overdue action is an SLA breach risk.",
    csvColumns: ["Action ID", "Owner", "Due Date", "Days Overdue", "Status", "Severity"],
  },
  {
    id: "sla_compliance",
    name: "SLA Compliance %",
    layer: "universal",
    description: "Corrective actions closed within configured SLA.",
    calculation: "Closed within SLA / Total closed actions × 100",
    dataSource: "corrective_actions with SLA timestamps",
    dataSourceRoles: ["corrective_actions"],
    unit: "percent",
    format: "percent",
    interpretation: "Target ≥ 90% for mature programs.",
    csvColumns: ["Action ID", "Severity", "SLA Hours", "Resolution Hours", "Within SLA", "Closed At"],
  },
  {
    id: "recurring_rate",
    name: "Recurring Issue Rate",
    layer: "universal",
    description: "Share of findings that recur at the same location/SKU.",
    calculation: "Recurring findings / Total findings × 100",
    dataSource: "findings with recurrence detection",
    dataSourceRoles: ["findings", "historical_audits"],
    unit: "percent",
    format: "percent",
    interpretation: "High recurrence indicates RCA or process failure.",
    csvColumns: ["Issue", "Frequency", "Locations", "Last Seen", "Value Impact"],
  },
  {
    id: "inventory_accuracy",
    name: "Inventory Accuracy",
    layer: "operating_model",
    description: "Alignment between reference/system quantity and verified physical quantity.",
    calculation: "1 − Σ|Actual − Expected| / ΣExpected × 100",
    dataSource: "Audit responses mapped to Expected Quantity and Actual Quantity",
    dataSourceRoles: ["manager_csv", "auditor_input", "calculated"],
    requiredConcepts: ["expected_quantity", "actual_quantity"],
    operatingModels: ["local_store", "dark_store", "warehouse"],
    unit: "percent",
    format: "percent",
    interpretation: "≥ 95% is target for dark store and warehouse operations.",
    unavailableReason: "Requires Expected + Actual Quantity fields mapped in audit template.",
    csvColumns: ["Location", "SKU", "Expected Qty", "Actual Qty", "Variance", "Variance %", "Audit ID", "Audit Date"],
  },
  {
    id: "expiry_risk",
    name: "Expiry Risk",
    layer: "operating_model",
    description: "Units at expiry risk (expired + near-expiry).",
    calculation: "Count of units where days_remaining ≤ threshold OR status = Expired",
    dataSource: "Audit responses with Expiry Date or Days Remaining",
    dataSourceRoles: ["auditor_input", "calculated", "ai_suggested"],
    requiredConcepts: ["expiry_date"],
    operatingModels: ["local_store", "supermarket", "dark_store", "warehouse", "fmcg_distributor"],
    unit: "count",
    format: "integer",
    interpretation: "Prioritize by value and days remaining.",
    unavailableReason: "Requires Expiry Date field mapped in audit template.",
    csvColumns: ["Location", "SKU", "Batch", "Expiry Date", "Days Remaining", "Expiry Status", "Audit ID"],
  },
  {
    id: "facing_compliance",
    name: "Facing Compliance",
    layer: "audit_specific",
    description: "Actual facings vs expected facings.",
    calculation: "Actual Facings / Expected Facings × 100 (per record, aggregated)",
    dataSource: "Audit responses with Expected Facing and Actual Facing",
    dataSourceRoles: ["manager_csv", "auditor_input", "calculated"],
    requiredConcepts: ["expected_facing", "actual_facing"],
    unit: "percent",
    format: "percent",
    interpretation: "Below 85% indicates shelf execution gaps.",
    csvColumns: ["Location", "Shelf", "SKU", "Expected Facing", "Actual Facing", "Compliance %", "Audit ID"],
  },
  {
    id: "stacking_compliance",
    name: "Stacking Compliance",
    layer: "audit_specific",
    description: "Compliant stacking checks vs total stacking checks.",
    calculation: "Compliant checks / Total stacking checks × 100",
    dataSource: "Shelf Stacking Audit execution fields",
    dataSourceRoles: ["auditor_input", "ai_suggested", "human_confirmed", "calculated"],
    requiredConcepts: ["stacking_compliance"],
    unit: "percent",
    format: "percent",
    interpretation: "Measures product arrangement quality on shelf.",
    csvColumns: ["Location", "Shelf", "SKU", "Expected Units", "Actual Units", "Wrong SKU", "Compliance %", "Audit ID"],
  },
  {
    id: "visible_unit_compliance",
    name: "Visible Unit Compliance",
    layer: "audit_specific",
    description: "Actual visible units vs expected visible units.",
    calculation: "Actual Visible Units / Expected Visible Units × 100",
    dataSource: "Shelf Stacking Audit fields",
    dataSourceRoles: ["manager_csv", "auditor_input", "calculated"],
    requiredConcepts: ["visible_unit_compliance"],
    unit: "percent",
    format: "percent",
    interpretation: "Detects under-fill and overflow conditions.",
    csvColumns: ["Location", "Shelf", "Expected Visible", "Actual Visible", "Compliance %", "Audit ID"],
  },
  {
    id: "qc_pass_rate",
    name: "QC Pass %",
    layer: "audit_specific",
    description: "Share of records passing QC status check.",
    calculation: "Pass count / Total QC records × 100",
    dataSource: "Audit responses with QC Status",
    dataSourceRoles: ["auditor_input"],
    requiredConcepts: ["qc_status"],
    unit: "percent",
    format: "percent",
    interpretation: "Declining QC pass rate signals supplier or handling issues.",
    csvColumns: ["Location", "SKU", "QC Status", "Result", "Audit ID", "Auditor"],
  },
  {
    id: "expired_units",
    name: "Expired Units",
    layer: "audit_specific",
    description: "Count of units already expired at audit time.",
    calculation: "Count where expiry_status = Expired OR days_remaining < 0",
    dataSource: "Expiry audit responses",
    dataSourceRoles: ["auditor_input", "calculated"],
    requiredConcepts: ["expiry_date"],
    unit: "count",
    format: "integer",
    interpretation: "Each expired unit requires immediate action.",
    csvColumns: ["Location", "SKU", "Batch", "Expiry Date", "Physical Qty", "Audit ID"],
  },
  {
    id: "near_expiry_units",
    name: "Near Expiry Units",
    layer: "audit_specific",
    description: "Units within configured near-expiry threshold.",
    calculation: "Count where 0 ≤ days_remaining ≤ threshold",
    dataSource: "Expiry audit responses",
    dataSourceRoles: ["auditor_input", "calculated"],
    requiredConcepts: ["expiry_date", "days_remaining"],
    unit: "count",
    format: "integer",
    interpretation: "Prioritize markdown or rotation.",
    csvColumns: ["Location", "SKU", "Batch", "Days Remaining", "Physical Qty", "Audit ID"],
  },
];

export function getKpiDefinition(id: string): KpiDefinition | undefined {
  return KPI_CATALOG.find((k) => k.id === id);
}

export function kpisForLayer(layer: KpiLayer): KpiDefinition[] {
  return KPI_CATALOG.filter((k) => k.layer === layer);
}
