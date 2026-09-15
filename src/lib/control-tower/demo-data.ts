import type { OperatingModel } from "@/lib/audit-builder/types";
import { getTerminology } from "@/lib/audit-engine/operating-model-catalog";
import { resolveKpiCatalog, templateCategoriesForModel, templateCountForModel } from "./kpi-catalog";
import { resolveKpiEngine } from "@/lib/kpi-engine";
import type {
  ControlTowerDemoPayload,
  ControlTowerKpi,
  ControlTowerModelFilter,
  KpiTone,
  OperationalTrendPoint,
} from "./types";

const DEMO_VALUES: Record<
  string,
  {
    value: string;
    detail: string;
    tone: KpiTone;
    trend?: number[];
    trendLabel?: string;
    progressPct?: number;
  }
> = {
  audit_completion: {
    value: "87%",
    detail: "156 / 179 assignments",
    tone: "brand",
    trend: [72, 78, 81, 85, 87],
    trendLabel: "+4.2% vs previous period",
    progressPct: 87,
  },
  evidence_coverage: {
    value: "94%",
    detail: "Verified required evidence units",
    tone: "good",
    trend: [88, 90, 91, 93, 94],
    trendLabel: "6% incomplete",
    progressPct: 94,
  },
  audit_pass: {
    value: "79%",
    detail: "Passed completed audits",
    tone: "good",
    trend: [74, 76, 77, 78, 79],
    trendLabel: "+2.1% vs previous period",
    progressPct: 79,
  },
  value_variance: {
    value: "₹2.14L",
    detail: "Potential inventory value impact",
    tone: "warn",
    trendLabel: "Potential — not confirmed loss",
  },
  open_findings: {
    value: "34",
    detail: "12 critical · 22 high/medium",
    tone: "warn",
    trendLabel: "12 critical",
  },
  critical_findings: {
    value: "12",
    detail: "Unresolved high + critical",
    tone: "bad",
    trendLabel: "Requires immediate action",
  },
  open_actions: {
    value: "28",
    detail: "Non-closed corrective actions",
    tone: "warn",
  },
  overdue_actions: {
    value: "7",
    detail: "Past due · not closed",
    tone: "bad",
    trendLabel: "3 breached SLA",
  },
  sla_compliance: {
    value: "91%",
    detail: "Closed within SLA",
    tone: "good",
    trend: [84, 86, 88, 90, 91],
    progressPct: 91,
  },
  recurring_rate: {
    value: "18%",
    detail: "Recurring / total findings",
    tone: "neutral",
  },
  inventory_accuracy: { value: "96.2%", detail: "System vs physical alignment", tone: "good", progressPct: 96 },
  oos_pct: { value: "4.8%", detail: "SKUs out of stock", tone: "warn" },
  expiry_risk: { value: "312 units", detail: "Near-expiry + expired", tone: "bad" },
  shelf_compliance: { value: "82%", detail: "Facing + placement", tone: "brand", progressPct: 82 },
  planogram_compliance: { value: "76%", detail: "Compliant elements / applicable", tone: "warn", progressPct: 76 },
  price_compliance: { value: "94%", detail: "Displayed vs expected price", tone: "good", progressPct: 94 },
  promotion_compliance: { value: "88%", detail: "Active campaigns executed", tone: "good", progressPct: 88 },
  posm_compliance: { value: "71%", detail: "POSM present and correct", tone: "warn", progressPct: 71 },
  picking_accuracy: { value: "98.1%", detail: "Pick variance rate", tone: "good", progressPct: 98 },
  putaway_accuracy: { value: "97.4%", detail: "Putaway variance rate", tone: "good", progressPct: 97 },
  receiving_accuracy: { value: "95.8%", detail: "Receiving QC pass rate", tone: "good", progressPct: 96 },
  outlet_coverage: { value: "68%", detail: "Outlets audited this period", tone: "brand", progressPct: 68 },
  execution_score: { value: "74", detail: "Weighted execution index", tone: "brand" },
  store_health: { value: "81", detail: "Composite store health", tone: "brand" },
  warehouse_health: { value: "78", detail: "Composite warehouse health", tone: "brand" },
  facing_compliance: { value: "88%", detail: "Actual / expected facings", tone: "good", progressPct: 88 },
  stacking_compliance: { value: "75%", detail: "Compliant stacking checks", tone: "warn", progressPct: 75 },
  visible_unit_compliance: { value: "82%", detail: "Actual / expected visible units", tone: "brand", progressPct: 82 },
  qc_pass_rate: { value: "91%", detail: "QC pass rate", tone: "good", progressPct: 91 },
  expired_units: { value: "24", detail: "Units already expired", tone: "bad" },
  near_expiry_units: { value: "156", detail: "Units within near-expiry threshold", tone: "warn" },
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
  return { id, label, ...preset, available: true, source: "Illustrative demo (Phase 1E)" };
}

function primaryModel(model: ControlTowerModelFilter): OperatingModel {
  if (model === "all") return "local_store";
  return model;
}

function buildOperationalTrend(model: ControlTowerModelFilter): {
  points: OperationalTrendPoint[];
  metrics: { key: string; label: string; color: string }[];
} {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const base = (seed: number) => days.map((date, i) => ({ date, v: seed + i * 2 + (i % 2) }));

  switch (model) {
    case "dark_store":
      return {
        metrics: [
          { key: "inventoryAccuracy", label: "Inventory Accuracy", color: "hsl(var(--brand))" },
          { key: "variance", label: "Variance", color: "hsl(var(--warning))" },
          { key: "expiryRisk", label: "Expiry Risk", color: "hsl(var(--destructive))" },
        ],
        points: days.map((date, i) => ({
          date,
          inventoryAccuracy: 94 + (i % 3),
          variance: 3.2 - i * 0.1,
          expiryRisk: 280 + i * 5,
        })),
      };
    case "supermarket":
      return {
        metrics: [
          { key: "planogram", label: "Planogram", color: "hsl(var(--brand))" },
          { key: "oos", label: "OOS %", color: "hsl(var(--destructive))" },
          { key: "shelfExecution", label: "Shelf Execution", color: "hsl(var(--accent-green))" },
        ],
        points: days.map((date, i) => ({
          date,
          planogram: 72 + i,
          oos: 5.5 - i * 0.2,
          shelfExecution: 78 + (i % 4),
        })),
      };
    case "warehouse":
      return {
        metrics: [
          { key: "inventory", label: "Inventory", color: "hsl(var(--brand))" },
          { key: "receiving", label: "Receiving", color: "hsl(var(--accent-green))" },
          { key: "putaway", label: "Putaway", color: "hsl(var(--warning))" },
        ],
        points: days.map((date, i) => ({
          date,
          inventory: 95 + (i % 2),
          receiving: 94 + i * 0.3,
          putaway: 96 + (i % 3) * 0.2,
        })),
      };
    case "fmcg_distributor":
      return {
        metrics: [
          { key: "outletCoverage", label: "Outlet Coverage", color: "hsl(var(--brand))" },
          { key: "availability", label: "Availability", color: "hsl(var(--accent-green))" },
          { key: "execution", label: "Execution", color: "hsl(var(--warning))" },
        ],
        points: days.map((date, i) => ({
          date,
          outletCoverage: 62 + i * 1.2,
          availability: 88 + (i % 3),
          execution: 70 + i,
        })),
      };
    case "local_store":
      return {
        metrics: [
          { key: "inventory", label: "Inventory", color: "hsl(var(--brand))" },
          { key: "expiry", label: "Expiry Risk", color: "hsl(var(--destructive))" },
          { key: "shelf", label: "Shelf", color: "hsl(var(--accent-green))" },
        ],
        points: days.map((date, i) => ({
          date,
          inventory: 93 + (i % 2),
          expiry: 45 + i * 3,
          shelf: 80 + i,
        })),
      };
    default:
      return {
        metrics: [
          { key: "completed", label: "Audits Completed", color: "hsl(var(--brand))" },
          { key: "findings", label: "Findings", color: "hsl(var(--destructive))" },
        ],
        points: days.map((date, i) => ({
          date,
          completed: 18 + i * 2,
          findings: 6 + (i % 4),
        })),
      };
  }
}

function buildFullRiskLocations(loc: string, count: number) {
  const metrics = ["Critical findings", "Value variance", "OOS rate", "SLA breaches", "Expiry risk"];
  return Array.from({ length: count }, (_, i) => ({
    id: `loc-${i + 1}`,
    name: `${loc} ${["Delhi Central 01", "Gurugram DLF 03", "Noida Sector 18", "Saket 02", "Connaught 04", "Dwarka 05", "Vasant Kunj 06", "Rohini 07", "Janakpuri 08", "Lajpat 09"][i] ?? `Site ${i + 1}`}`,
    metric: metrics[i % metrics.length]!,
    score: Math.max(45, 95 - i * 4),
    trend: (["up", "down", "flat"] as const)[i % 3],
  }));
}

function buildFullRiskSkus(loc: string, count: number) {
  const skus = [
    ["MAGGI-70G", "Maggi Noodles 70g"],
    ["COLGATE-200G", "Colgate 200g"],
    ["LAYS-52G", "Lays Classic 52g"],
    ["AMUL-500ML", "Amul Milk 500ml"],
    ["BRU-50G", "Bru Instant 50g"],
    ["PARLE-G", "Parle-G 800g"],
    ["HARPIC-1L", "Harpic 1L"],
    ["SURF-1KG", "Surf Excel 1kg"],
    ["TATA-TEA", "Tata Tea 250g"],
    ["KELLOGG", "Kellogg Cornflakes"],
  ];
  return Array.from({ length: count }, (_, i) => {
    const [sku, product] = skus[i % skus.length]!;
    return {
      id: `sku-${i + 1}`,
      sku,
      product,
      location: `${loc} ${i % 4 === 0 ? "Delhi Central 01" : "Gurugram DLF 03"}`,
      metric: i % 2 === 0 ? "Variance" : "Expiry risk",
      score: Math.max(50, 92 - i * 3),
    };
  });
}

function buildFullFindings(loc: string, count: number) {
  const issues = [
    "Expired stock — unit coverage incomplete",
    "Inventory variance without RCA",
    "Planogram violation",
    "Price mismatch on shelf",
    "Missing POSM display",
    "OOS on must-stock SKU",
    "Damaged goods not quarantined",
    "Promotion not executed",
  ];
  const severities = ["Critical", "Critical", "High", "High", "Medium"];
  return Array.from({ length: count }, (_, i) => ({
    id: `f-${i + 1}`,
    severity: severities[i % severities.length]!,
    location: `${loc} ${["Delhi Central 01", "Gurugram DLF 03", "Noida Sector 18", "Saket 02"][i % 4]}`,
    sku: ["MAGGI-70G", "COLGATE-200G", "LAYS-52G", "AMUL-500ML"][i % 4]!,
    issue: issues[i % issues.length]!,
    status: ["Open", "Action assigned", "Pending verification", "Open"][i % 4]!,
    detectedAt: new Date(Date.now() - i * 86400000).toISOString(),
  }));
}

function buildFullActions(loc: string, count: number) {
  const owners = ["R. Sharma", "P. Singh", "A. Khan", "S. Mehta", "K. Patel"];
  const statuses = ["Open", "In progress", "Pending verification", "Closed"];
  return Array.from({ length: count }, (_, i) => ({
    id: `a-${i + 1}`,
    severity: i < 3 ? "Critical" : i < 8 ? "High" : "Medium",
    location: `${loc} ${["Delhi Central 01", "Gurugram DLF 03", "Saket 02"][i % 3]}`,
    owner: owners[i % owners.length]!,
    due: i === 0 ? "2h overdue" : i === 1 ? "Today" : i === 2 ? "Tomorrow" : `${i + 1} days`,
    status: statuses[i % statuses.length]!,
  }));
}

function buildFullRecurring(count: number) {
  const issues = [
    "Same SKU repeatedly short — MAGGI-70G",
    "Repeated planogram failure — Beverages aisle",
    "Expiry misses on dairy category",
    "Price label mismatch recurring",
    "POSM not refreshed weekly",
    "OOS on top-20 SKUs",
    "Receiving QC failures — inbound dock",
    "Pick accuracy drop — evening shift",
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: `r-${i + 1}`,
    issue: issues[i % issues.length]!,
    frequency: Math.max(2, 6 - (i % 4)),
    locations: Math.max(1, 4 - (i % 3)),
    lastSeen: `${i + 1} days ago`,
    valueImpact: i % 3 === 0 ? `₹${(12 + i * 8)}K` : "—",
  }));
}

function buildFullAuditExecution(loc: string, model: string, count: number) {
  const statuses = ["Assigned", "In Progress", "Submitted", "Under Review", "Approved", "Overdue"];
  return Array.from({ length: count }, (_, i) => ({
    auditId: `AUD-2026-${String(140 + i).padStart(4, "0")}`,
    status: statuses[i % statuses.length]!,
    location: `${loc} ${["Delhi Central 01", "Gurugram DLF 03", "Noida Sector 18"][i % 3]}`,
    template: ["Expiry Audit", "Inventory Audit", "Planogram + Shelf", "Receiving QC"][i % 4]!,
    assignedTo: ["R. Sharma", "P. Singh", "A. Khan"][i % 3]!,
    dueDate: new Date(Date.now() + (i - 3) * 86400000).toISOString().slice(0, 10),
    operatingModel: model,
  }));
}

function buildFullEvidence(loc: string, count: number) {
  const types = ["Photo", "Signature", "Barcode scan", "GPS check-in"];
  return Array.from({ length: count }, (_, i) => ({
    unitId: `EV-${String(i + 1).padStart(4, "0")}`,
    auditId: `AUD-2026-${String(140 + (i % 20)).padStart(4, "0")}`,
    location: `${loc} ${["Delhi Central 01", "Gurugram DLF 03"][i % 2]}`,
    evidenceType: types[i % types.length]!,
    required: true,
    verified: i % 5 !== 0,
    status: i % 5 === 0 ? "Missing" : "Verified",
  }));
}

export function buildControlTowerDemo(model: ControlTowerModelFilter): ControlTowerDemoPayload {
  const catalog = resolveKpiCatalog(model);
  const engine = resolveKpiEngine(model);
  const terminology = getTerminology(primaryModel(model));
  const loc = terminology.location;
  const opTrend = buildOperationalTrend(model);

  const universalKpis = catalog.universal.map((d) => demoKpi(d.id, d.label, true));
  const contextualKpis = catalog.contextual.map((d) => demoKpi(d.id, d.label, true));
  const auditSpecificKpis = engine.auditSpecific.map((d) => demoKpi(d.id, d.name, true));

  const riskLocationsFull = buildFullRiskLocations(loc, 10);
  const riskSkusFull = buildFullRiskSkus(loc, 10);
  const criticalFindingsFull = buildFullFindings(loc, 15);
  const correctiveActionsFull = buildFullActions(loc, 12);
  const recurringIssuesFull = buildFullRecurring(8);
  const auditExecutionFull = buildFullAuditExecution(loc, model === "all" ? "all" : model, 20);
  const evidenceCoverageFull = buildFullEvidence(loc, 15);

  return {
    labeledDemo: true,
    operatingModel: model,
    terminology,
    templateCount: templateCountForModel(model),
    templateCategories: templateCategoriesForModel(model),
    universalKpis,
    contextualKpis,
    auditSpecificKpis,
    auditStatus: [
      { name: "Assigned", value: 12, color: "hsl(var(--muted-foreground))" },
      { name: "In Progress", value: 8, color: "hsl(var(--brand))" },
      { name: "Submitted", value: 6, color: "hsl(var(--warning))" },
      { name: "Approved", value: 142, color: "hsl(var(--accent-green))" },
      { name: "Overdue", value: 6, color: "hsl(var(--destructive))" },
    ],
    riskLocations: riskLocationsFull.slice(0, 4),
    riskSkus: riskSkusFull.slice(0, 4),
    criticalFindings: criticalFindingsFull.slice(0, 3),
    correctiveActions: correctiveActionsFull.slice(0, 3),
    correctiveActionHealth: {
      open: 28,
      dueToday: 4,
      overdue: 7,
      pendingVerification: 5,
      closed: 156,
    },
    sla: { compliancePct: 91, overdue: 7, dueToday: 4, breached: 3, avgResolutionHours: 18 },
    evidenceCoverage: { required: 1240, verified: 1166, pct: 94 },
    recurringIssues: recurringIssuesFull.slice(0, 2),
    auditTrend: [
      { date: "Mon", completed: 22, findings: 8 },
      { date: "Tue", completed: 28, findings: 11 },
      { date: "Wed", completed: 31, findings: 9 },
      { date: "Thu", completed: 26, findings: 14 },
      { date: "Fri", completed: 34, findings: 10 },
      { date: "Sat", completed: 18, findings: 6 },
      { date: "Sun", completed: 12, findings: 4 },
    ],
    operationalTrend: opTrend.points,
    operationalTrendMetrics: opTrend.metrics,
    auditExecutionFull,
    riskLocationsFull,
    riskSkusFull,
    criticalFindingsFull,
    correctiveActionsFull,
    recurringIssuesFull,
    evidenceCoverageFull,
  };
}
