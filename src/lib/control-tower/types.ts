import type { OperatingModel } from "@/lib/audit-builder/types";

export type ControlTowerModelFilter = OperatingModel | "all";

export type DrilldownLevel =
  | "overview"
  | "kpi"
  | "location"
  | "category"
  | "sku"
  | "audit"
  | "finding"
  | "action"
  | "evidence"
  | "verification";

export type ControlTowerSearch = {
  model?: ControlTowerModelFilter;
  drill?: DrilldownLevel;
  kpi?: string;
  location?: string;
  category?: string;
  sku?: string;
  audit?: string;
  finding?: string;
  action?: string;
};

export type KpiTone = "brand" | "good" | "warn" | "bad" | "neutral";

export type ControlTowerKpi = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: KpiTone;
  trend?: number[];
  trendLabel?: string;
  progressPct?: number;
  available: boolean;
  source?: string;
};

export type AuditStatusBucket = { name: string; value: number; color?: string };

export type RiskLocation = {
  id: string;
  name: string;
  metric: string;
  score: number;
  trend: "up" | "down" | "flat";
};

export type RiskSku = {
  id: string;
  sku: string;
  product: string;
  location: string;
  metric: string;
  score: number;
};

export type FindingRow = {
  id: string;
  severity: string;
  location: string;
  sku: string;
  issue: string;
  status: string;
  detectedAt?: string;
};

export type ActionRow = {
  id: string;
  severity: string;
  location: string;
  owner: string;
  due: string;
  status: string;
};

export type RecurringIssueRow = {
  id: string;
  issue: string;
  frequency: number;
  locations: number;
  lastSeen: string;
  valueImpact: string;
};

export type AuditExecutionRow = {
  auditId: string;
  status: string;
  location: string;
  template: string;
  assignedTo: string;
  dueDate: string;
  operatingModel: string;
};

export type EvidenceCoverageRow = {
  unitId: string;
  auditId: string;
  location: string;
  evidenceType: string;
  required: boolean;
  verified: boolean;
  status: string;
};

export type CorrectiveActionHealth = {
  open: number;
  dueToday: number;
  overdue: number;
  pendingVerification: number;
  closed: number;
};

export type OperationalTrendPoint = {
  date: string;
  [metric: string]: string | number;
};

export type ControlTowerDemoPayload = {
  labeledDemo: true;
  operatingModel: ControlTowerModelFilter;
  terminology: {
    location: string;
    locationPlural: string;
    subLocation: string;
    productScope: string;
  };
  templateCount: number;
  templateCategories: string[];
  universalKpis: ControlTowerKpi[];
  contextualKpis: ControlTowerKpi[];
  auditStatus: AuditStatusBucket[];
  riskLocations: RiskLocation[];
  riskSkus: RiskSku[];
  criticalFindings: FindingRow[];
  correctiveActions: ActionRow[];
  correctiveActionHealth: CorrectiveActionHealth;
  sla: {
    compliancePct: number;
    overdue: number;
    dueToday: number;
    breached: number;
    avgResolutionHours: number;
  };
  evidenceCoverage: {
    required: number;
    verified: number;
    pct: number;
  };
  recurringIssues: RecurringIssueRow[];
  auditTrend: { date: string; completed: number; findings: number }[];
  operationalTrend: OperationalTrendPoint[];
  operationalTrendMetrics: { key: string; label: string; color: string }[];
  /** Full datasets for CSV export and View All pages */
  auditExecutionFull: AuditExecutionRow[];
  riskLocationsFull: RiskLocation[];
  riskSkusFull: RiskSku[];
  criticalFindingsFull: FindingRow[];
  correctiveActionsFull: ActionRow[];
  recurringIssuesFull: RecurringIssueRow[];
  evidenceCoverageFull: EvidenceCoverageRow[];
};
