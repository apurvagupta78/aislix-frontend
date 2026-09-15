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
  available: boolean;
  source?: string;
};

export type AuditStatusBucket = { name: string; value: number };

export type RiskLocation = {
  id: string;
  name: string;
  metric: string;
  score: number;
  trend: "up" | "down" | "flat";
};

export type FindingRow = {
  id: string;
  severity: string;
  location: string;
  sku: string;
  issue: string;
  status: string;
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
  criticalFindings: FindingRow[];
  correctiveActions: ActionRow[];
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
};
