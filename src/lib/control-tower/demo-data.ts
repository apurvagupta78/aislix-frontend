import type { OperatingModel } from "@/lib/audit-builder/types";
import { getTerminology } from "@/lib/audit-engine/operating-model-catalog";
import { resolveKpiCatalog, templateCategoriesForModel, templateCountForModel } from "./kpi-catalog";
import type { ControlTowerDemoPayload, ControlTowerKpi, ControlTowerModelFilter, KpiTone } from "./types";

const DEMO_VALUES: Record<string, { value: string; detail: string; tone: KpiTone; trend?: number[] }> = {
  audit_completion: { value: "87%", detail: "156 / 179 assignments", tone: "brand", trend: [72, 78, 81, 85, 87] },
  evidence_coverage: { value: "94%", detail: "Verified required evidence units", tone: "good", trend: [88, 90, 91, 93, 94] },
  audit_pass: { value: "79%", detail: "Passed completed audits", tone: "good", trend: [74, 76, 77, 78, 79] },
  value_variance: { value: "₹2.14L", detail: "Potential — not confirmed loss", tone: "warn", trend: [1.4, 1.7, 1.9, 2.0, 2.14] },
  open_findings: { value: "34", detail: "12 critical · 22 high/medium", tone: "warn", trend: [28, 30, 32, 36, 34] },
  critical_findings: { value: "12", detail: "Unresolved high + critical", tone: "bad", trend: [8, 10, 11, 14, 12] },
  open_actions: { value: "28", detail: "Non-closed corrective actions", tone: "warn", trend: [22, 24, 26, 30, 28] },
  overdue_actions: { value: "7", detail: "Past due · not closed", tone: "bad", trend: [4, 5, 6, 9, 7] },
  sla_compliance: { value: "91%", detail: "Closed within SLA", tone: "good", trend: [84, 86, 88, 90, 91] },
  recurring_rate: { value: "18%", detail: "Recurring / total findings", tone: "neutral", trend: [14, 15, 16, 19, 18] },
  inventory_accuracy: { value: "96.2%", detail: "System vs physical alignment", tone: "good" },
  oos_pct: { value: "4.8%", detail: "SKUs out of stock", tone: "warn" },
  expiry_risk: { value: "312 units", detail: "Near-expiry + expired", tone: "bad" },
  shelf_compliance: { value: "82%", detail: "Facing + placement", tone: "brand" },
  planogram_compliance: { value: "76%", detail: "Compliant elements / applicable", tone: "warn" },
  price_compliance: { value: "94%", detail: "Displayed vs expected price", tone: "good" },
  promotion_compliance: { value: "88%", detail: "Active campaigns executed", tone: "good" },
  posm_compliance: { value: "71%", detail: "POSM present and correct", tone: "warn" },
  picking_accuracy: { value: "98.1%", detail: "Pick variance rate", tone: "good" },
  putaway_accuracy: { value: "97.4%", detail: "Putaway variance rate", tone: "good" },
  receiving_accuracy: { value: "95.8%", detail: "Receiving QC pass rate", tone: "good" },
  outlet_coverage: { value: "68%", detail: "Outlets audited this period", tone: "brand" },
  execution_score: { value: "74", detail: "Weighted execution index", tone: "brand" },
  store_health: { value: "81", detail: "Composite store health", tone: "brand" },
  warehouse_health: { value: "78", detail: "Composite warehouse health", tone: "brand" },
};

function demoKpi(id: string, label: string, available: boolean): ControlTowerKpi {
  const preset = DEMO_VALUES[id];
  if (!available || !preset) {
    return {
      id,
      label,
      value: "—",
      detail: "No data available for selected scope",
      tone: "neutral",
      available: false,
      source: "System",
    };
  }
  return { id, label, ...preset, available: true, source: "Demo (Phase 1E)" };
}

function primaryModel(model: ControlTowerModelFilter): OperatingModel {
  if (model === "all") return "local_store";
  return model;
}

export function buildControlTowerDemo(model: ControlTowerModelFilter): ControlTowerDemoPayload {
  const catalog = resolveKpiCatalog(model);
  const terminology = getTerminology(primaryModel(model));

  const universalKpis = catalog.universal.map((d) => demoKpi(d.id, d.label, true));
  const contextualKpis = catalog.contextual.map((d) => demoKpi(d.id, d.label, true));

  const loc = terminology.location;

  return {
    labeledDemo: true,
    operatingModel: model,
    terminology,
    templateCount: templateCountForModel(model),
    templateCategories: templateCategoriesForModel(model),
    universalKpis,
    contextualKpis,
    auditStatus: [
      { name: "Assigned", value: 12 },
      { name: "In Progress", value: 8 },
      { name: "Submitted", value: 6 },
      { name: "Under Review", value: 5 },
      { name: "Approved", value: 142 },
      { name: "Overdue", value: 6 },
    ],
    riskLocations: [
      { id: "loc-1", name: `${loc} Delhi Central 01`, metric: "Critical findings", score: 92, trend: "up" },
      { id: "loc-2", name: `${loc} Gurugram DLF 03`, metric: "Value variance", score: 84, trend: "up" },
      { id: "loc-3", name: `${loc} Noida Sector 18`, metric: "OOS rate", score: 71, trend: "flat" },
      { id: "loc-4", name: `${loc} Saket 02`, metric: "SLA breaches", score: 65, trend: "down" },
    ],
    criticalFindings: [
      { id: "f-1", severity: "Critical", location: `${loc} Delhi Central 01`, sku: "MAGGI-70G", issue: "Expired stock — unit coverage incomplete", status: "Open" },
      { id: "f-2", severity: "Critical", location: `${loc} Gurugram DLF 03`, sku: "COLGATE-200G", issue: "Inventory variance without RCA", status: "Open" },
      { id: "f-3", severity: "High", location: `${loc} Noida Sector 18`, sku: "LAYS-52G", issue: "Planogram violation", status: "Action assigned" },
    ],
    correctiveActions: [
      { id: "a-1", severity: "Critical", location: `${loc} Delhi Central 01`, owner: "R. Sharma", due: "2h overdue", status: "Open" },
      { id: "a-2", severity: "High", location: `${loc} Gurugram DLF 03`, owner: "P. Singh", due: "Today", status: "In progress" },
      { id: "a-3", severity: "Medium", location: `${loc} Saket 02`, owner: "A. Khan", due: "Tomorrow", status: "Pending verification" },
    ],
    sla: { compliancePct: 91, overdue: 7, dueToday: 4, breached: 3, avgResolutionHours: 18 },
    evidenceCoverage: { required: 1240, verified: 1166, pct: 94 },
    recurringIssues: [
      { id: "r-1", issue: "Same SKU repeatedly short — MAGGI-70G", frequency: 5, locations: 3, lastSeen: "2 days ago", valueImpact: "₹42K" },
      { id: "r-2", issue: "Repeated planogram failure — Beverages aisle", frequency: 4, locations: 2, lastSeen: "4 days ago", valueImpact: "—" },
    ],
    auditTrend: [
      { date: "Mon", completed: 22, findings: 8 },
      { date: "Tue", completed: 28, findings: 11 },
      { date: "Wed", completed: 31, findings: 9 },
      { date: "Thu", completed: 26, findings: 14 },
      { date: "Fri", completed: 34, findings: 10 },
      { date: "Sat", completed: 18, findings: 6 },
      { date: "Sun", completed: 12, findings: 4 },
    ],
  };
}
