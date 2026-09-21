/**
 * Live universal Control Tower contract — assignments, findings, corrective actions.
 * Template-specific qty/expiry/facing/QC KPIs are intentionally N/A until P1.
 */

import { supabase } from "@/integrations/supabase/client";
import { getTerminology } from "@/lib/audit-engine/operating-model-catalog";
import type { OperatingModel } from "@/lib/audit-builder/types";
import {
  fetchLifecycleActions,
  slaRemainingLabel,
  type LifecycleAction,
} from "@/lib/corrective-action-lifecycle";
import {
  resolveDashboardDateBounds,
  type DashboardDateBounds,
  type DashboardFilterState,
} from "@/lib/dashboard-filters";
import { requireOrgId, requireUserId } from "@/lib/db/context";
import { fetchFindings, findingTypeLabel, rcaLabel, type Finding } from "@/lib/findings";
import { resolveKpiCatalog } from "@/lib/control-tower/kpi-catalog";
import { resolveKpiEngine } from "@/lib/kpi-engine/resolver";
import type {
  ActionRow,
  AuditExecutionRow,
  AuditStatusBucket,
  ControlTowerDemoPayload,
  ControlTowerKpi,
  ControlTowerModelFilter,
  FindingRow,
  KpiTone,
  RecurringIssueRow,
  RiskLocation,
  RiskSku,
} from "@/lib/control-tower/types";
import { AISLIX, AISLIX_STATUS_MIX } from "@/lib/aislix-theme";
import { resolveDemoExperience } from "@/lib/demo-environment";

export const UNWIRED_UNIVERSAL_KPI_IDS = new Set<string>([
  // Kept empty — previously unwired KPIs now compute from live rows or show Data unavailable via liveKpi null paths.
]);

export const NOT_WIRED_YET = "Data unavailable";

const STATUS_COLORS: Record<string, string> = AISLIX_STATUS_MIX;

const CLOSED_FINDING = new Set(["closed"]);
const CLOSED_ACTION = new Set(["closed"]);

export type AssignmentComputeRow = {
  id: string;
  status: string;
  approval_status: string | null;
  store_id: string;
  store_name: string;
  due_at: string | null;
  created_at: string;
  assignee_id: string;
  assignee_name: string;
  template_id: string | null;
  template_name: string;
  operating_model: string | null;
  city?: string;
  scan_id?: string | null;
  category?: string;
  sub_category?: string;
  assigner_id?: string | null;
};

export type UniversalComputeInput = {
  model: ControlTowerModelFilter;
  assignments: AssignmentComputeRow[];
  findings: Finding[];
  actions: LifecycleAction[];
  storeNames?: Record<string, string>;
  bounds?: DashboardDateBounds;
  now?: number;
  labeledDemo?: boolean;
};

function inDateBounds(iso: string | null | undefined, bounds: DashboardDateBounds, upcomingField?: string | null): boolean {
  if (bounds.upcoming) {
    if (!upcomingField) return false;
    const due = new Date(upcomingField).getTime();
    if (Number.isNaN(due)) return false;
    if (bounds.from && due < bounds.from.getTime()) return false;
    return true;
  }
  if (!iso) return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return true;
  if (bounds.from && t < bounds.from.getTime()) return false;
  if (bounds.to && t >= bounds.to.getTime()) return false;
  return true;
}

export function completionPct(completed: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((completed / total) * 1000) / 10;
}

export function isCompletedAssignment(row: Pick<AssignmentComputeRow, "status" | "approval_status">): boolean {
  return row.status === "completed" || row.approval_status === "approved";
}

export function countOpenFindings(rows: Array<{ status: string }>): number {
  return rows.filter((r) => !CLOSED_FINDING.has(r.status)).length;
}

export function countCriticalFindings(rows: Array<{ status: string; severity: string }>): number {
  return rows.filter(
    (r) => !CLOSED_FINDING.has(r.status) && (r.severity === "critical" || r.severity === "high"),
  ).length;
}

export function countOpenActions(rows: Array<{ status: string }>): number {
  return rows.filter((r) => !CLOSED_ACTION.has(r.status)).length;
}

export function countOverdueActions(
  rows: Array<{ status: string; due_at: string | null }>,
  now = Date.now(),
): number {
  return rows.filter(
    (r) => !CLOSED_ACTION.has(r.status) && r.due_at && new Date(r.due_at).getTime() < now,
  ).length;
}

export function countDueTodayActions(
  rows: Array<{ status: string; due_at: string | null }>,
  now = new Date(),
): number {
  return rows.filter((r) => {
    if (CLOSED_ACTION.has(r.status) || !r.due_at) return false;
    return new Date(r.due_at).toDateString() === now.toDateString();
  }).length;
}

export function assignmentStage(
  status: string,
): "Not started" | "In progress" | "Completed" | null {
  if (status === "cancelled") return null;
  if (status === "completed") return "Completed";
  if (status === "in_progress" || status === "needs_correction") return "In progress";
  return "Not started";
}

function likePattern(raw: string): string | null {
  const q = raw.trim().replace(/[%_,]/g, "").slice(0, 80);
  return q ? `%${q}%` : null;
}

function scopeLabel(scope: unknown, key: string, plural: string): string {
  if (!scope || typeof scope !== "object") return "";
  const rec = scope as Record<string, unknown>;
  const single = rec[key];
  if (typeof single === "string" && single.trim()) return single.trim();
  const many = rec[plural];
  if (Array.isArray(many) && typeof many[0] === "string") return many[0];
  return "";
}

async function assignmentIdsMatchingCatalog(
  orgId: string,
  assignments: AssignmentComputeRow[],
  filters: DashboardFilterState,
): Promise<Set<string> | null> {
  const sku = likePattern(filters.skuId ?? "");
  const itemCode = likePattern(filters.itemCode ?? "");
  const itemName = likePattern(filters.itemName ?? "");
  if (!sku && !itemCode && !itemName) return null;

  const scanIds = assignments.map((a) => a.scan_id).filter(Boolean) as string[];
  const ids = new Set<string>();

  const queries: Array<Promise<void>> = [];

  if (scanIds.length && (sku || itemName)) {
    let q = supabase.from("detected_products").select("scan_id").in("scan_id", scanIds.slice(0, 500));
    if (sku) q = q.ilike("sku", sku);
    if (itemName) q = q.ilike("name", itemName);
    queries.push(
      q.then(({ data }) => {
        const scanToAssignment = new Map(
          assignments.filter((a) => a.scan_id).map((a) => [a.scan_id as string, a.id]),
        );
        for (const row of data ?? []) {
          const aid = scanToAssignment.get(row.scan_id as string);
          if (aid) ids.add(aid);
        }
      }),
    );
  }

  {
    let q = supabase
      .from("digital_audit_lines")
      .select("assignment_id, scan_id")
      .eq("org_id", orgId)
      .limit(2000);
    if (sku) q = q.ilike("sku", sku);
    if (itemCode) q = q.ilike("item_code", itemCode);
    if (itemName) q = q.ilike("product_name", itemName);
    queries.push(
      q.then(({ data }) => {
        const scanToAssignment = new Map(
          assignments.filter((a) => a.scan_id).map((a) => [a.scan_id as string, a.id]),
        );
        for (const row of data ?? []) {
          if (row.assignment_id) ids.add(row.assignment_id as string);
          else if (row.scan_id) {
            const aid = scanToAssignment.get(row.scan_id as string);
            if (aid) ids.add(aid);
          }
        }
      }),
    );
  }

  await Promise.all(queries);
  return ids;
}

function toAuditExecutionRows(
  assignments: AssignmentComputeRow[],
  model: ControlTowerModelFilter,
  now: number,
): AuditExecutionRow[] {
  const rows: AuditExecutionRow[] = [];
  for (const a of assignments) {
    const stage = assignmentStage(a.status);
    if (!stage) continue;
    rows.push({
      auditId: a.id,
      status: assignmentStatusBucket(a, now) ?? a.status,
      location: a.store_name,
      template: a.template_name,
      assignedTo: a.assignee_name,
      dueDate: a.due_at ? a.due_at.slice(0, 10) : "—",
      operatingModel: a.operating_model ?? (model === "all" ? "all" : model),
      date: a.created_at.slice(0, 10),
      city: a.city || "—",
      scanId: a.scan_id ?? null,
      stage,
    });
  }
  return rows;
}

export function assignmentStatusBucket(
  row: Pick<AssignmentComputeRow, "status" | "approval_status" | "due_at">,
  now = Date.now(),
): string | null {
  if (row.status === "cancelled") return null;
  if (row.status === "completed" || row.approval_status === "approved") return "Approved";
  if (
    row.status === "needs_correction" ||
    row.approval_status === "submitted" ||
    row.approval_status === "pending_review"
  ) {
    return "Submitted";
  }
  const overdue =
    (row.status === "pending" || row.status === "in_progress") &&
    row.due_at &&
    new Date(row.due_at).getTime() < now;
  if (overdue) return "Overdue";
  if (row.status === "in_progress") return "In Progress";
  return "Assigned";
}

export function buildAuditStatusBuckets(
  assignments: AssignmentComputeRow[],
  now = Date.now(),
): AuditStatusBucket[] {
  const counts: Record<string, number> = {
    Assigned: 0,
    "In Progress": 0,
    Submitted: 0,
    Approved: 0,
    Overdue: 0,
  };
  for (const row of assignments) {
    const bucket = assignmentStatusBucket(row, now);
    if (!bucket) continue;
    counts[bucket] = (counts[bucket] ?? 0) + 1;
  }
  return Object.entries(counts).map(([name, value]) => ({
    name,
    value,
    color: STATUS_COLORS[name],
  }));
}

export function formatInrCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

function relativeDayLabel(iso: string, now = Date.now()): string {
  const days = Math.max(0, Math.round((now - new Date(iso).getTime()) / 864e5));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function buildRecurringIssues(findings: Finding[], now = Date.now()): RecurringIssueRow[] {
  const groups = new Map<
    string,
    { issue: string; count: number; stores: Set<string>; lastSeen: string; value: number }
  >();
  for (const f of findings) {
    const key = f.rca_code || f.finding_type;
    const label = f.rca_code ? rcaLabel(f.rca_code) : findingTypeLabel(f.finding_type);
    const existing = groups.get(key) ?? {
      issue: label,
      count: 0,
      stores: new Set<string>(),
      lastSeen: f.created_at,
      value: 0,
    };
    existing.count += 1;
    if (f.store_id) existing.stores.add(f.store_id);
    else if (f.store_name) existing.stores.add(f.store_name);
    if (f.created_at > existing.lastSeen) existing.lastSeen = f.created_at;
    existing.value += Math.abs(Number(f.variance_value_inr) || 0);
    groups.set(key, existing);
  }
  return [...groups.values()]
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count)
    .map((g, i) => ({
      id: `rca-${i + 1}`,
      issue: g.issue,
      frequency: g.count,
      locations: g.stores.size,
      lastSeen: relativeDayLabel(g.lastSeen, now),
      valueImpact: g.value > 0 ? formatInrCompact(g.value) : "—",
    }));
}

export function buildRiskLocations(findings: Finding[]): RiskLocation[] {
  const groups = new Map<string, { name: string; open: number; critical: number }>();
  for (const f of findings) {
    if (CLOSED_FINDING.has(f.status)) continue;
    const id = f.store_id || f.store_name || "unknown";
    const existing = groups.get(id) ?? { name: f.store_name || "Unknown location", open: 0, critical: 0 };
    existing.open += 1;
    if (f.severity === "critical" || f.severity === "high") existing.critical += 1;
    groups.set(id, existing);
  }
  return [...groups.entries()]
    .map(([id, g]) => ({
      id,
      name: g.name,
      metric: `${g.critical} high/critical · ${g.open} open`,
      score: Math.min(100, g.critical * 18 + g.open * 6),
      trend: "flat" as const,
    }))
    .sort((a, b) => b.score - a.score);
}

export function buildRiskSkus(findings: Finding[]): RiskSku[] {
  const groups = new Map<
    string,
    { sku: string; product: string; location: string; open: number; critical: number }
  >();
  for (const f of findings) {
    if (CLOSED_FINDING.has(f.status) || !f.sku) continue;
    const existing = groups.get(f.sku) ?? {
      sku: f.sku,
      product: f.product_name || f.sku,
      location: f.store_name || "—",
      open: 0,
      critical: 0,
    };
    existing.open += 1;
    if (f.severity === "critical" || f.severity === "high") existing.critical += 1;
    groups.set(f.sku, existing);
  }
  return [...groups.values()]
    .map((g, i) => ({
      id: `sku-${g.sku}-${i}`,
      sku: g.sku,
      product: g.product,
      location: g.location,
      metric: `${g.critical} high/critical · ${g.open} open`,
      score: Math.min(100, g.critical * 18 + g.open * 6),
    }))
    .sort((a, b) => b.score - a.score);
}

export function buildAuditTrend(
  assignments: AssignmentComputeRow[],
  findings: Finding[],
  bounds: DashboardDateBounds,
  now = Date.now(),
): { date: string; completed: number; findings: number }[] {
  const dayMs = 864e5;
  const end = bounds.to ? new Date(bounds.to.getTime() - 1) : new Date(now);
  const start = bounds.from ? new Date(bounds.from) : new Date(end.getTime() - 6 * dayMs);
  const days: { key: string; label: string }[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= last && days.length < 31) {
    days.push({
      key: cursor.toISOString().slice(0, 10),
      label: cursor.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days.map(({ key, label }) => ({
    date: label,
    completed: assignments.filter((a) => isCompletedAssignment(a) && a.created_at.slice(0, 10) === key).length,
    findings: findings.filter((f) => f.created_at.slice(0, 10) === key).length,
  }));
}

function unwiredKpi(id: string, label: string): ControlTowerKpi {
  return {
    id,
    label,
    value: "N/A",
    detail: NOT_WIRED_YET,
    tone: "neutral",
    available: false,
    source: "Catalog",
    unavailableReason: NOT_WIRED_YET,
  };
}

function liveKpi(
  id: string,
  label: string,
  value: string,
  detail: string,
  tone: KpiTone,
  extra?: Partial<ControlTowerKpi>,
): ControlTowerKpi {
  return { id, label, value, detail, tone, available: true, source: "Live", ...extra };
}

function completionTone(pct: number | null): KpiTone {
  if (pct == null) return "neutral";
  if (pct >= 80) return "brand";
  if (pct >= 60) return "warn";
  return "bad";
}

export function computeUniversalDashboardFromRows(input: UniversalComputeInput): ControlTowerDemoPayload {
  const now = input.now ?? Date.now();
  const model = input.model;
  const terminology = getTerminology(model === "all" ? "local_store" : (model as OperatingModel));
  const catalog = resolveKpiCatalog(model);
  const engine = resolveKpiEngine(model);

  const activeAssignments = input.assignments.filter((a) => a.status !== "cancelled");
  const completed = activeAssignments.filter(isCompletedAssignment).length;
  const pct = completionPct(completed, activeAssignments.length);
  const openFindings = countOpenFindings(input.findings);
  const criticalFindings = countCriticalFindings(input.findings);
  const highOrCriticalOpen = input.findings.filter(
    (f) => !CLOSED_FINDING.has(f.status) && (f.severity === "critical" || f.severity === "high"),
  );
  const openActions = countOpenActions(input.actions);
  const overdueActions = countOverdueActions(input.actions, now);
  const dueToday = countDueTodayActions(input.actions, new Date(now));
  const pendingVerification = input.actions.filter((a) => a.status === "pending_verification").length;
  const closedActions = input.actions.filter((a) => a.status === "closed").length;
  const valueVariance = input.findings
    .filter((f) => !CLOSED_FINDING.has(f.status))
    .reduce((sum, f) => sum + Math.abs(Number(f.variance_value_inr) || 0), 0);

  const recurring = buildRecurringIssues(input.findings, now);
  const recurringGroups = recurring.length;
  const findingTypeGroups = new Set(
    input.findings.map((f) => `${f.store_id ?? ""}|${f.sku ?? ""}|${f.finding_type}`),
  ).size;
  const recurringRate =
    findingTypeGroups > 0 ? Math.round((recurringGroups / Math.max(1, findingTypeGroups)) * 1000) / 10 : null;

  const closedFindings = input.findings.filter((f) => CLOSED_FINDING.has(f.status) || f.status === "resolved").length;
  const auditPassPct =
    input.findings.length > 0
      ? Math.round((closedFindings / input.findings.length) * 1000) / 10
      : completed > 0
        ? 100
        : null;

  const actionsWithDue = input.actions.filter((a) => a.due_at);
  const onTimeClosed = input.actions.filter(
    (a) =>
      a.status === "closed" &&
      a.due_at &&
      (a.closed_at || a.resolved_at) &&
      new Date((a.closed_at || a.resolved_at) as string).getTime() <= new Date(a.due_at).getTime(),
  ).length;
  const slaPct =
    actionsWithDue.length > 0
      ? Math.round(((actionsWithDue.length - overdueActions) / actionsWithDue.length) * 1000) / 10
      : null;

  const liveById: Record<string, ControlTowerKpi> = {
    audit_completion: liveKpi(
      "audit_completion",
      "Audit Completion %",
      pct == null ? "—" : `${pct}%`,
      pct == null ? "No assignments in this period" : `${completed} / ${activeAssignments.length} assignments`,
      completionTone(pct),
      pct == null ? {} : { progressPct: Math.min(100, pct) },
    ),
    value_variance: liveKpi(
      "value_variance",
      "Potential Inventory Value Variance",
      formatInrCompact(valueVariance),
      "From open findings (potential — not confirmed loss)",
      valueVariance > 0 ? "warn" : "good",
    ),
    open_findings: liveKpi(
      "open_findings",
      "Open Findings",
      String(openFindings),
      `${criticalFindings} high/critical · not closed`,
      openFindings === 0 ? "good" : "warn",
    ),
    critical_findings: liveKpi(
      "critical_findings",
      "Critical Findings",
      String(criticalFindings),
      "Unresolved high + critical",
      criticalFindings === 0 ? "good" : "bad",
    ),
    open_actions: liveKpi(
      "open_actions",
      "Open Corrective Actions",
      String(openActions),
      "Non-closed corrective actions",
      openActions === 0 ? "good" : "warn",
    ),
    overdue_actions: liveKpi(
      "overdue_actions",
      "Overdue Actions",
      String(overdueActions),
      "Past due · not closed",
      overdueActions === 0 ? "good" : "bad",
    ),
    evidence_coverage: liveKpi(
      "evidence_coverage",
      "Evidence Coverage %",
      "N/A",
      "Use Expiry Control for unit-level evidence coverage",
      "neutral",
      { available: false, unavailableReason: "Data unavailable" },
    ),
    audit_pass: liveKpi(
      "audit_pass",
      "Audit Pass %",
      auditPassPct == null ? "N/A" : `${auditPassPct}%`,
      auditPassPct == null ? "Data unavailable" : `${closedFindings} closed / ${input.findings.length} findings`,
      completionTone(auditPassPct),
    ),
    sla_compliance: liveKpi(
      "sla_compliance",
      "SLA Compliance %",
      slaPct == null ? "N/A" : `${slaPct}%`,
      slaPct == null ? "Data unavailable" : `${overdueActions} overdue of ${actionsWithDue.length} with due dates`,
      completionTone(slaPct),
    ),
    recurring_rate: liveKpi(
      "recurring_rate",
      "Recurring Issue Rate",
      recurringRate == null ? "N/A" : `${recurringRate}%`,
      recurringRate == null
        ? "Data unavailable"
        : `${recurringGroups} recurring issue groups`,
      recurringRate != null && recurringRate > 20 ? "warn" : "good",
    ),
  };

  const universalKpis = catalog.universal.map((d) => {
    if (UNWIRED_UNIVERSAL_KPI_IDS.has(d.id)) return unwiredKpi(d.id, d.label);
    return liveById[d.id] ?? unwiredKpi(d.id, d.label);
  });
  const contextualKpis = catalog.contextual.map((d) => unwiredKpi(d.id, d.label));
  const auditSpecificKpis = engine.auditSpecific.map((d) => unwiredKpi(d.id, d.name));

  const criticalFindingRows: FindingRow[] = highOrCriticalOpen
    .sort((a, b) => {
      const sev = Number(a.severity === "critical") - Number(b.severity === "critical");
      if (sev !== 0) return -sev;
      return b.created_at.localeCompare(a.created_at);
    })
    .map((f) => ({
      id: f.id,
      severity: f.severity === "critical" ? "Critical" : "High",
      location: f.store_name || "—",
      sku: f.sku || "—",
      issue: f.title,
      status: f.status.replaceAll("_", " "),
      detectedAt: f.created_at,
    }));

  const actionRows: ActionRow[] = input.actions
    .filter((a) => !CLOSED_ACTION.has(a.status))
    .map((a) => ({
      id: a.id,
      severity: a.priority,
      location: (a.store_id && input.storeNames?.[a.store_id]) || a.sku || "—",
      owner: a.assigned_name || "Unassigned",
      due: slaRemainingLabel(a.due_at, a.status),
      status: a.status.replaceAll("_", " "),
    }));

  const riskLocations = buildRiskLocations(input.findings);
  const riskSkus = buildRiskSkus(input.findings);
  const auditStatus = buildAuditStatusBuckets(input.assignments, now);
  const auditTrend = buildAuditTrend(
    input.assignments,
    input.findings,
    input.bounds ?? { from: null, to: null, upcoming: false },
    now,
  );

  const executionFull: AuditExecutionRow[] = toAuditExecutionRows(input.assignments, model, now);

  return {
    labeledDemo: input.labeledDemo ?? false,
    operatingModel: model,
    terminology,
    templateCount: 0,
    templateCategories: [],
    universalKpis,
    contextualKpis,
    auditSpecificKpis,
    auditStatus,
    riskLocations: riskLocations.slice(0, 4),
    riskSkus: riskSkus.slice(0, 4),
    criticalFindings: criticalFindingRows.slice(0, 5),
    correctiveActions: actionRows.slice(0, 5),
    correctiveActionHealth: {
      open: openActions,
      dueToday,
      overdue: overdueActions,
      pendingVerification,
      closed: closedActions,
    },
    sla: {
      available: slaPct != null,
      compliancePct: slaPct ?? 0,
      overdue: overdueActions,
      dueToday,
      breached: overdueActions,
      avgResolutionHours: 0,
    },
    evidenceCoverage: { available: false, required: 0, verified: 0, pct: 0 },
    recurringIssues: recurring.slice(0, 4),
    auditTrend,
    operationalTrend: auditTrend.map((p) => ({ date: p.date, completed: p.completed, findings: p.findings })),
    operationalTrendMetrics: [
      { key: "completed", label: "Audits completed", color: AISLIX.primary },
      { key: "findings", label: "Findings", color: AISLIX.darkstoreBg },
    ],
    auditExecutionFull: executionFull,
    riskLocationsFull: riskLocations,
    riskSkusFull: riskSkus,
    criticalFindingsFull: criticalFindingRows,
    correctiveActionsFull: actionRows,
    recurringIssuesFull: recurring,
    evidenceCoverageFull: [],
  };
}

function matchesModel(operatingModel: string | null, model: ControlTowerModelFilter): boolean {
  if (model === "all") return true;
  if (!operatingModel) return true;
  return operatingModel === model;
}

async function fetchStoreScope(
  orgId: string,
  filters: DashboardFilterState,
): Promise<string[] | null> {
  if (filters.storeId && filters.storeId !== "all") return [filters.storeId];
  const geo = (filters.country && filters.country !== "all") || (filters.city && filters.city !== "all");
  if (!geo) return null;
  let query = supabase.from("stores").select("id, country, city").eq("org_id", orgId);
  if (filters.country && filters.country !== "all") query = query.eq("country", filters.country);
  if (filters.city && filters.city !== "all") query = query.eq("city", filters.city);
  const { data, error } = await query;
  if (error) return null;
  return (data ?? []).map((s) => s.id as string);
}

export async function computeUniversalDashboard(input: {
  model: ControlTowerModelFilter;
  filters: DashboardFilterState;
  previewDemo?: boolean;
  userEmail?: string | null;
}): Promise<ControlTowerDemoPayload> {
  const activeOrgId = await requireOrgId();
  const demoExperience = await resolveDemoExperience(activeOrgId, {
    previewDemo: input.previewDemo,
    userEmail: input.userEmail,
  });
  const orgId = demoExperience.dataOrgId;
  const userId = await requireUserId();
  const bounds = resolveDashboardDateBounds(input.filters);
  const storeIds = await fetchStoreScope(orgId, input.filters);

  let assignmentQuery = supabase
    .from("scan_assignments")
    .select(
      "id, status, approval_status, store_id, due_at, created_at, assignee_id, assigner_id, template_id, scan_id, scope_values, stores:store_id (name, city)",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (storeIds?.length === 1) assignmentQuery = assignmentQuery.eq("store_id", storeIds[0]!);
  else if (storeIds && storeIds.length > 1) assignmentQuery = assignmentQuery.in("store_id", storeIds);
  else if (storeIds && storeIds.length === 0) {
    const empty = computeUniversalDashboardFromRows({
      model: input.model,
      assignments: [],
      findings: [],
      actions: [],
      labeledDemo: demoExperience.labeledDemo,
    });
    empty.previewDemo = demoExperience.previewDemo;
    return empty;
  }

  if (bounds.upcoming) {
    assignmentQuery = assignmentQuery.gte("due_at", (bounds.from ?? new Date()).toISOString());
  } else {
    if (bounds.from) assignmentQuery = assignmentQuery.gte("created_at", bounds.from.toISOString());
    if (bounds.to) assignmentQuery = assignmentQuery.lt("created_at", bounds.to.toISOString());
  }

  const [{ data: assignmentRows, error: assignmentError }, findings, actions, { data: templates }] =
    await Promise.all([
      assignmentQuery,
      fetchFindings({
        storeId: input.filters.storeId,
        filters: input.filters,
      }),
      fetchLifecycleActions({
        storeId: input.filters.storeId,
      }),
      supabase.from("audit_templates").select("id, name, operating_model").eq("org_id", orgId),
    ]);

  if (assignmentError && assignmentError.code !== "42P01" && assignmentError.code !== "42703") {
    throw assignmentError;
  }

  const templateById = new Map(
    (templates ?? []).map((t) => [
      t.id as string,
      {
        name: (t.name as string) || "Audit",
        operating_model: (t.operating_model as string | null) ?? null,
      },
    ]),
  );

  const rawAssignments = (assignmentRows ?? []) as Array<{
    id: string;
    status: string;
    approval_status: string | null;
    store_id: string;
    due_at: string | null;
    created_at: string;
    assignee_id: string;
    assigner_id?: string | null;
    template_id: string | null;
    scan_id?: string | null;
    scope_values?: unknown;
    stores?: { name?: string | null; city?: string | null } | null;
  }>;

  const userIds = [...new Set(rawAssignments.map((r) => r.assignee_id).filter(Boolean))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const names = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || p.email || "Team member"]),
  );

  const actionStoreIds = [...new Set(actions.map((a) => a.store_id).filter(Boolean))] as string[];
  const { data: actionStores } = actionStoreIds.length
    ? await supabase.from("stores").select("id, name").in("id", actionStoreIds)
    : { data: [] as { id: string; name: string }[] };
  const actionStoreNames = new Map((actionStores ?? []).map((s) => [s.id, s.name]));

  let assignments: AssignmentComputeRow[] = rawAssignments.map((row) => {
    const tpl = row.template_id ? templateById.get(row.template_id) : undefined;
    return {
      id: row.id,
      status: row.status,
      approval_status: row.approval_status,
      store_id: row.store_id,
      store_name: row.stores?.name ?? "Store",
      due_at: row.due_at,
      created_at: row.created_at,
      assignee_id: row.assignee_id,
      assignee_name: names.get(row.assignee_id) ?? "Team member",
      template_id: row.template_id,
      template_name: tpl?.name ?? "Audit",
      operating_model: tpl?.operating_model ?? null,
      city: row.stores?.city ?? "",
      scan_id: row.scan_id ?? null,
      category: scopeLabel(row.scope_values, "category", "categories"),
      sub_category: scopeLabel(row.scope_values, "sub_category", "sub_categories"),
      assigner_id: row.assigner_id ?? null,
    };
  });

  if (storeIds && storeIds.length > 1) {
    const allow = new Set(storeIds);
    assignments = assignments.filter((a) => allow.has(a.store_id));
  }

  if (input.filters.teamMemberId && input.filters.teamMemberId !== "all") {
    assignments = assignments.filter((a) => a.assignee_id === input.filters.teamMemberId);
  }

  assignments = assignments.filter((a) => matchesModel(a.operating_model, input.model));

  const assignmentIds = new Set(assignments.map((a) => a.id));
  const storeAllow = storeIds ? new Set(storeIds) : null;

  const scopedFindings = findings.filter((f) => {
    if (!inDateBounds(f.created_at, bounds, f.due_at)) return false;
    if (storeAllow && f.store_id && !storeAllow.has(f.store_id)) return false;
    if (input.filters.teamMemberId && input.filters.teamMemberId !== "all" && f.assigned_to !== input.filters.teamMemberId) {
      return false;
    }
    if (input.model !== "all" && f.assignment_id && !assignmentIds.has(f.assignment_id)) return false;
    return true;
  });

  const scopedActions = actions.filter((a) => {
    if (!inDateBounds(a.created_at, bounds, a.due_at)) return false;
    if (storeAllow && a.store_id && !storeAllow.has(a.store_id)) return false;
    if (input.filters.teamMemberId && input.filters.teamMemberId !== "all" && a.assigned_to !== input.filters.teamMemberId) {
      return false;
    }
    return true;
  });

  const payload = computeUniversalDashboardFromRows({
    model: input.model,
    assignments,
    findings: scopedFindings,
    actions: scopedActions,
    storeNames: Object.fromEntries(actionStoreNames),
    bounds,
    labeledDemo: demoExperience.labeledDemo,
  });

  let tableAssignments = assignments;
  if (input.filters.category && input.filters.category !== "all") {
    const cat = input.filters.category.toLowerCase();
    tableAssignments = tableAssignments.filter((a) => (a.category || "").toLowerCase() === cat);
  }
  if (input.filters.subCategory && input.filters.subCategory !== "all") {
    const sub = input.filters.subCategory.toLowerCase();
    tableAssignments = tableAssignments.filter((a) => (a.sub_category || "").toLowerCase() === sub);
  }
  if (input.filters.auditAssignment === "assigned_to_me") {
    tableAssignments = tableAssignments.filter((a) => a.assignee_id === userId);
  } else if (input.filters.auditAssignment === "assigned_by_me") {
    tableAssignments = tableAssignments.filter((a) => a.assigner_id === userId);
  } else if (input.filters.auditAssignment === "unassigned") {
    tableAssignments = tableAssignments.filter((a) => !a.assignee_id);
  }

  const catalogIds = await assignmentIdsMatchingCatalog(orgId, tableAssignments, input.filters);
  if (catalogIds) {
    const sku = (input.filters.skuId ?? "").trim().toLowerCase();
    const itemName = (input.filters.itemName ?? "").trim().toLowerCase();
    for (const f of scopedFindings) {
      if (sku && (f.sku || "").toLowerCase().includes(sku) && f.assignment_id) catalogIds.add(f.assignment_id);
      if (itemName && (f.product_name || "").toLowerCase().includes(itemName) && f.assignment_id) {
        catalogIds.add(f.assignment_id);
      }
    }
    tableAssignments = tableAssignments.filter((a) => catalogIds.has(a.id));
  }

  payload.auditExecutionFull = toAuditExecutionRows(tableAssignments, input.model, Date.now());

  const orgTemplates = (templates ?? []).filter((t) =>
    matchesModel((t.operating_model as string | null) ?? null, input.model),
  );
  payload.templateCount = orgTemplates.length;
  payload.templateCategories = [
    ...new Set(orgTemplates.map((t) => (t.name as string) || "Template")),
  ].slice(0, 8);
  payload.previewDemo = demoExperience.previewDemo;

  return payload;
}
