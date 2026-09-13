/**
 * Workspace dashboard intelligence — aggregates real audit data for the operational home.
 * No fabricated metrics; empty states when data is insufficient.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError } from "@/lib/db/context";
import {
  effectiveDashboardRole,
  trendKpisForRole,
  type PriorityCategory,
  PRIORITY_OPPORTUNITY_CATEGORIES,
} from "@/lib/dashboard-config";
import {
  resolveDashboardDateBounds,
  type DashboardFilterOptions,
  type DashboardFilterState,
  type DashboardSubCategoryOption,
  type DashboardTeamMember,
} from "@/lib/dashboard-filters";
import { getUser, requireOrgId } from "@/lib/db/context";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import type { RetailIntelligencePayload } from "@/lib/retail-intelligence";
import { normalizePercent } from "@/lib/dashboard";

export type DashboardFilters = DashboardFilterState;

export type WorkspaceKpis = {
  audits_completed: number | null;
  stores_covered: number | null;
  avg_osa: number | null;
  avg_planogram: number | null;
  open_issues: number | null;
  issues_resolved_rate: number | null;
  shelf_health: number | null;
  shelf_health_available: boolean;
  audits_remaining: number | null;
  products_detected: number | null;
  average_confidence: number | null;
  images_processed: number | null;
};

export type IssuesSummary = {
  total: number;
  high: number;
  medium: number;
  low: number;
};

export type DashboardIssueRow = {
  id: string;
  store_name: string;
  issue: string;
  priority: "high" | "medium" | "low";
  status: string;
  scan_id?: string;
  href?: string;
};

export type PerformanceTrendPoint = {
  date: string;
  [kpi: string]: string | number | null;
};

export type ImprovementMetric = {
  key: string;
  label: string;
  current: string;
  previous: string;
  change: string;
  improved: boolean | null;
};

export type StorePerformanceRow = {
  store_id: string;
  store_name: string;
  audits: number;
  osa: number | null;
  planogram: number | null;
  open_issues: number;
  change: number | null;
};

export type RecentAuditRow = {
  scan_id: string;
  date: string;
  store_name: string;
  role: string;
  osa: number | null;
  planogram: number | null;
  issues: number;
};

export type PriorityOpportunityRow = {
  category: PriorityCategory;
  label: string;
  count: number;
};

export type ShareOfShelfSegment = {
  label: string;
  share: number;
  is_primary?: boolean;
};

export type RoleVisualData =
  | { kind: "share_of_shelf"; segments: ShareOfShelfSegment[]; trend?: PerformanceTrendPoint[] }
  | { kind: "outlet_execution"; outlets: Array<{ name: string; osa: number | null; msl: number | null; planogram: number | null }> }
  | { kind: "location_accuracy"; locations: Array<{ label: string; accuracy: number | null }> };

export type WorkspaceDashboardData = {
  kpis: WorkspaceKpis;
  issues: IssuesSummary;
  issue_rows: DashboardIssueRow[];
  performance_trend: PerformanceTrendPoint[];
  improvement: ImprovementMetric[] | null;
  stores: StorePerformanceRow[];
  recent_audits: RecentAuditRow[];
  priority_opportunities: PriorityOpportunityRow[];
  role_visual: RoleVisualData | null;
  filter_options: DashboardFilterOptions;
};

type AssignmentRow = {
  id: string;
  assignee_id: string;
  assigner_id: string;
  scan_id: string | null;
  status: string;
  due_at: string | null;
  created_at: string;
  stores: { name?: string } | null;
};

type ScanRow = {
  id: string;
  created_at: string;
  store_id: string | null;
  category: string | null;
  sub_category: string | null;
  sub_category_label: string | null;
  sub_category_custom: string | null;
  created_by: string | null;
  assignment_id: string | null;
  osa_percent: number | null;
  planogram_compliance_percent: number | null;
  shelf_health_score: number | null;
  share_of_shelf_percent: number | null;
  total_products: number | null;
  photo_count: number | null;
  stores: { name?: string } | null;
};

function scanSubCategoryLabel(scan: ScanRow): string {
  return (
    scan.sub_category_label?.trim() ||
    scan.sub_category_custom?.trim() ||
    scan.sub_category?.trim() ||
    ""
  );
}

function metricsPayload(raw: unknown): RetailIntelligencePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const ri = m.retail_intelligence ?? m;
  return (typeof ri === "object" && ri ? ri : null) as RetailIntelligencePayload;
}

function scanRole(metrics: RetailIntelligencePayload | null): AuditRoleTab | null {
  const role = metrics?.audit_kpi_dashboard?.role_id;
  if (typeof role === "string" && role.length) return role as AuditRoleTab;
  return null;
}

function kpiValue(
  metrics: RetailIntelligencePayload | null,
  role: AuditRoleTab,
  kpiId: AuditKpiId,
  scan: ScanRow,
): number | null {
  const dash =
    metrics?.audit_kpi_dashboards?.[role] ??
    (metrics?.audit_kpi_dashboard?.role_id === role ? metrics.audit_kpi_dashboard : null) ??
    metrics?.audit_kpi_dashboard;
  const kpi = dash?.primary_kpis?.find((k) => k.kpi_id === kpiId);
  if (kpi && (kpi.status === "complete" || kpi.status === "partial") && typeof kpi.value === "number") {
    return kpi.unit === "percent" ? normalizePercent(kpi.value) ?? kpi.value : kpi.value;
  }
  if (kpiId === "osa" && typeof scan.osa_percent === "number") return normalizePercent(scan.osa_percent) ?? scan.osa_percent;
  if (kpiId === "planogram_compliance" && typeof scan.planogram_compliance_percent === "number") {
    return normalizePercent(scan.planogram_compliance_percent) ?? scan.planogram_compliance_percent;
  }
  if (kpiId === "share_of_shelf" && typeof scan.share_of_shelf_percent === "number") {
    return normalizePercent(scan.share_of_shelf_percent) ?? scan.share_of_shelf_percent;
  }
  return null;
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function priorityFromSeverity(sev?: string): "high" | "medium" | "low" {
  const v = (sev ?? "").toLowerCase();
  if (v === "critical" || v === "high") return "high";
  if (v === "low") return "low";
  return "medium";
}

function categoryFromIssueType(issueType: string): PriorityCategory {
  const t = issueType.toLowerCase();
  if (t.includes("price") || t.includes("mrp")) return "pricing";
  if (t.includes("promo")) return "promotion";
  if (t.includes("assort") || t.includes("msl")) return "assortment";
  if (t.includes("planogram") || t.includes("placement") || t.includes("position")) return "placement";
  return "availability";
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

async function fetchMetricsMap(scanIds: string[]): Promise<Map<string, RetailIntelligencePayload | null>> {
  const map = new Map<string, RetailIntelligencePayload | null>();
  if (!scanIds.length) return map;
  const chunkSize = 80;
  for (let i = 0; i < scanIds.length; i += chunkSize) {
    const chunk = scanIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("scan_results")
      .select("scan_id, metrics, confidence_avg")
      .in("scan_id", chunk);
    if (error) dbError(error, "Could not load scan metrics.");
    for (const row of data ?? []) {
      map.set(row.scan_id as string, metricsPayload(row.metrics));
    }
  }
  return map;
}

async function fetchConfidenceMap(scanIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!scanIds.length) return map;
  const { data } = await supabase
    .from("scan_results")
    .select("scan_id, confidence_avg")
    .in("scan_id", scanIds.slice(0, 200));
  for (const row of data ?? []) {
    if (typeof row.confidence_avg === "number") map.set(row.scan_id as string, row.confidence_avg);
  }
  return map;
}

const SCAN_SELECT =
  "id, created_at, store_id, category, sub_category, sub_category_label, sub_category_custom, created_by, assignment_id, osa_percent, planogram_compliance_percent, shelf_health_score, share_of_shelf_percent, total_products, photo_count, stores(name)";

async function loadTeamMembers(orgId: string): Promise<DashboardTeamMember[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id, status, invited_email, profiles:user_id(full_name, email)")
    .eq("org_id", orgId)
    .eq("status", "active");
  if (error) dbError(error, "Could not load team members.");
  return (data ?? []).map((row) => {
    const profile = row.profiles as { full_name?: string | null; email?: string | null } | null;
    return {
      user_id: row.user_id as string,
      name: profile?.full_name?.trim() || profile?.email?.trim() || (row.invited_email as string) || "Member",
      email: profile?.email?.trim() || (row.invited_email as string) || "",
    };
  });
}

function buildFilterOptions(
  allStores: Array<{ id: string; name: string }>,
  poolScans: ScanRow[],
  teamMembers: DashboardTeamMember[],
  currentUserId: string | null,
  roleFilter: DashboardFilterState["role"],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
): DashboardFilterOptions {
  let scoped = poolScans;
  if (roleFilter !== "all") {
    scoped = scoped.filter((s) => scanRole(metricsMap.get(s.id) ?? null) === roleFilter);
  }
  const storeIds = new Set(scoped.map((s) => s.store_id).filter(Boolean));
  const stores = allStores.filter((s) => storeIds.has(s.id));
  const categories = [...new Set(scoped.map((s) => s.category).filter(Boolean) as string[])].sort();
  const subMap = new Map<string, DashboardSubCategoryOption>();
  for (const scan of scoped) {
    const cat = scan.category?.trim();
    const label = scanSubCategoryLabel(scan);
    if (!cat || !label) continue;
    subMap.set(`${cat}::${label}`, { category: cat, value: label, label });
  }
  const activeMembers = teamMembers.filter((m) => {
    return scoped.some(
      (s) => s.created_by === m.user_id,
    );
  });
  const membersForFilter = activeMembers.length ? activeMembers : teamMembers;
  return {
    stores: stores.length ? stores : allStores,
    categories,
    subcategories: [...subMap.values()].sort((a, b) => a.label.localeCompare(b.label)),
    team_members: membersForFilter,
    only_self: teamMembers.length <= 1,
    current_user_id: currentUserId,
  };
}

function passesAssignmentFilters(
  scan: ScanRow,
  assignment: AssignmentRow | undefined,
  filters: DashboardFilterState,
  currentUserId: string | null,
): boolean {
  const assignee = assignment?.assignee_id ?? null;
  const assigner = assignment?.assigner_id ?? null;

  if (filters.auditAssignment === "assigned_to_me") {
    if (!currentUserId) return false;
    return assignee === currentUserId || scan.created_by === currentUserId;
  }
  if (filters.auditAssignment === "assigned_by_me") {
    if (!currentUserId) return false;
    return assigner === currentUserId;
  }
  if (filters.auditAssignment === "unassigned") {
    return !scan.assignment_id && !assignment;
  }
  if (filters.teamMemberId !== "all") {
    return scan.created_by === filters.teamMemberId || assignee === filters.teamMemberId;
  }
  return true;
}

function applyScanFilters(
  scans: ScanRow[],
  filters: DashboardFilterState,
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  assignmentByScanId: Map<string, AssignmentRow>,
  currentUserId: string | null,
): ScanRow[] {
  return scans.filter((scan) => {
    if (filters.role !== "all" && scanRole(metricsMap.get(scan.id) ?? null) !== filters.role) {
      return false;
    }
    if (filters.storeId !== "all" && scan.store_id !== filters.storeId) return false;
    if (filters.category !== "all" && scan.category !== filters.category) return false;
    if (filters.subCategory !== "all" && scanSubCategoryLabel(scan) !== filters.subCategory) {
      return false;
    }
    const assignment = assignmentByScanId.get(scan.id);
    if (!passesAssignmentFilters(scan, assignment, filters, currentUserId)) return false;
    return true;
  });
}

/** Filter dropdown options — role-aware, from real workspace data. */
export async function fetchDashboardFilterOptions(
  roleHint: DashboardFilterState["role"] = "all",
  signal?: AbortSignal,
): Promise<DashboardFilterOptions> {
  void signal;
  const orgId = await requireOrgId();
  const user = await getUser();
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const [storesRes, scansRes, teamMembers] = await Promise.all([
    supabase.from("stores").select("id, name").eq("org_id", orgId).eq("status", "active").order("name"),
    supabase
      .from("shelf_scans")
      .select(SCAN_SELECT)
      .eq("org_id", orgId)
      .eq("status", "completed")
      .gte("created_at", since.toISOString()),
    loadTeamMembers(orgId),
  ]);
  if (storesRes.error) dbError(storesRes.error, "Could not load stores.");
  if (scansRes.error) dbError(scansRes.error, "Could not load audits.");

  const allStores = (storesRes.data ?? []).map((s) => ({
    id: s.id as string,
    name: (s.name as string) ?? "Store",
  }));
  const poolScans = (scansRes.data ?? []) as ScanRow[];
  const metricsMap = await fetchMetricsMap(poolScans.map((s) => s.id));
  return buildFilterOptions(
    allStores,
    poolScans,
    teamMembers,
    user?.id ?? null,
    roleHint,
    metricsMap,
  );
}

/** Aggregated workspace dashboard from completed audits in the org. */
export async function fetchWorkspaceDashboard(
  filters: DashboardFilters,
  signal?: AbortSignal,
): Promise<WorkspaceDashboardData> {
  void signal;
  const orgId = await requireOrgId();
  const user = await getUser();
  const currentUserId = user?.id ?? null;
  const bounds = resolveDashboardDateBounds(filters);

  const optionSince = new Date();
  optionSince.setDate(optionSince.getDate() - 90);

  const [storesRes, subscriptionRes, actionsRes, assignmentsRes, teamMembers] = await Promise.all([
    supabase.from("stores").select("id, name").eq("org_id", orgId).eq("status", "active").order("name"),
    supabase
      .from("subscriptions")
      .select("scans_used, subscription_plans(scan_quota)")
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("corrective_actions")
      .select("id, status, issue_type, suggestion, created_at, comparison_id")
      .eq("org_id", orgId),
    supabase
      .from("scan_assignments")
      .select("id, assignee_id, assigner_id, scan_id, status, due_at, created_at, stores(name)")
      .eq("org_id", orgId),
    loadTeamMembers(orgId),
  ]);

  let scans: ScanRow[] = [];
  let upcomingAssignments: AssignmentRow[] = [];

  if (bounds.upcoming) {
    const nowIso = new Date().toISOString();
    upcomingAssignments = ((assignmentsRes.data ?? []) as AssignmentRow[]).filter((a) => {
      const open = !["completed", "cancelled", "verified"].includes(a.status);
      if (!open) return false;
      if (a.due_at) return a.due_at >= nowIso.slice(0, 10);
      return ["pending", "in_progress", "needs_correction"].includes(a.status);
    });
    const linkedScanIds = upcomingAssignments.map((a) => a.scan_id).filter(Boolean) as string[];
    if (linkedScanIds.length) {
      const { data, error } = await supabase
        .from("shelf_scans")
        .select(SCAN_SELECT)
        .eq("org_id", orgId)
        .in("id", linkedScanIds);
      if (error) dbError(error, "Could not load upcoming audits.");
      scans = (data ?? []) as ScanRow[];
    }
  } else {
    let q = supabase
      .from("shelf_scans")
      .select(SCAN_SELECT)
      .eq("org_id", orgId)
      .eq("status", "completed")
      .order("created_at", { ascending: true });
    if (bounds.from) q = q.gte("created_at", bounds.from.toISOString());
    if (bounds.to) q = q.lt("created_at", bounds.to.toISOString());
    const { data, error } = await q;
    if (error) dbError(error, "Could not load audits.");
    scans = (data ?? []) as ScanRow[];
  }

  const { data: poolScansRes } = await supabase
    .from("shelf_scans")
    .select(SCAN_SELECT)
    .eq("org_id", orgId)
    .eq("status", "completed")
    .gte("created_at", optionSince.toISOString());

  if (storesRes.error) dbError(storesRes.error, "Could not load stores.");

  const allStores = (storesRes.data ?? []).map((s) => ({
    id: s.id as string,
    name: (s.name as string) ?? "Store",
  }));

  const assignmentByScanId = new Map<string, AssignmentRow>();
  for (const row of (assignmentsRes.data ?? []) as AssignmentRow[]) {
    if (row.scan_id) assignmentByScanId.set(row.scan_id, row);
  }

  const poolScans = (poolScansRes ?? []) as ScanRow[];
  const poolMetricsMap = await fetchMetricsMap(poolScans.map((s) => s.id));
  const filter_options = buildFilterOptions(
    allStores,
    poolScans,
    teamMembers,
    currentUserId,
    filters.role,
    poolMetricsMap,
  );

  const scanIds = scans.map((s) => s.id);
  const metricsMap = await fetchMetricsMap(scanIds);
  const confidenceMap = await fetchConfidenceMap(scanIds);

  scans = applyScanFilters(scans, filters, metricsMap, assignmentByScanId, currentUserId);

  const effectiveRole =
    filters.role !== "all"
      ? filters.role
      : effectiveDashboardRole("all", scanRole(metricsMap.get(scans.at(-1)?.id ?? "") ?? null));

  // --- KPIs ---
  const storeIds = new Set(scans.map((s) => s.store_id).filter(Boolean));
  const osaValues = scans.map((s) => s.osa_percent).filter((v): v is number => typeof v === "number");
  const planoValues = scans
    .map((s) => s.planogram_compliance_percent)
    .filter((v): v is number => typeof v === "number");
  const healthValues = scans
    .map((s) => s.shelf_health_score)
    .filter((v): v is number => typeof v === "number");

  const actions = actionsRes.data ?? [];
  const openActions = actions.filter((a) => a.status === "open" || a.status === "in_progress");
  const resolvedActions = actions.filter((a) => a.status === "resolved" || a.status === "closed");
  const totalActions = openActions.length + resolvedActions.length;
  const resolvedRate = totalActions ? (resolvedActions.length / totalActions) * 100 : null;

  const sub = subscriptionRes.data as
    | { scans_used: number; subscription_plans: { scan_quota: number | null } | null }
    | null;
  const quota = sub?.subscription_plans?.scan_quota ?? null;
  const scansRemaining = quota === null ? null : Math.max(0, quota - (sub?.scans_used ?? 0));

  const confValues = [...confidenceMap.values()];
  const totalProducts = scans.reduce((sum, s) => sum + (s.total_products ?? 0), 0);
  const totalPhotos = scans.reduce((sum, s) => sum + (s.photo_count ?? 0), 0);

  const kpis: WorkspaceKpis = {
    audits_completed: scans.length || null,
    stores_covered: storeIds.size || null,
    avg_osa: avg(osaValues.map((v) => normalizePercent(v) ?? v)),
    avg_planogram: avg(planoValues.map((v) => normalizePercent(v) ?? v)),
    open_issues: null,
    issues_resolved_rate: resolvedRate,
    shelf_health: avg(healthValues),
    shelf_health_available: healthValues.length >= 2,
    audits_remaining: scansRemaining,
    products_detected: scans.length ? totalProducts : null,
    average_confidence: confValues.length ? avg(confValues.map((v) => normalizePercent(v) ?? v)) : null,
    images_processed: scans.length ? totalPhotos : null,
  };

  // --- Issues from scan metrics + corrective actions ---
  const issueRows: DashboardIssueRow[] = [];
  let high = 0;
  let medium = 0;
  let low = 0;
  const categoryCounts: Record<PriorityCategory, number> = {
    availability: 0,
    placement: 0,
    pricing: 0,
    promotion: 0,
    assortment: 0,
  };

  for (const scan of [...scans].reverse().slice(0, 40)) {
    const metrics = metricsMap.get(scan.id);
    const storeName = scan.stores?.name ?? "Unknown store";
    const ledger = metrics?.opportunity_ledger ?? [];
    const actionsList = metrics?.next_best_actions ?? [];
    for (const row of ledger) {
      const status = (row.status ?? "open").toLowerCase();
      if (status === "resolved" || status === "verified" || status === "dismissed" || status === "closed") continue;
      const priority = priorityFromSeverity(row.severity ?? row.priority);
      if (priority === "high") high += 1;
      else if (priority === "low") low += 1;
      else medium += 1;
      categoryCounts[categoryFromIssueType(row.issue ?? "")] += 1;
      if (issueRows.length < 8) {
        issueRows.push({
          id: `ledger-${scan.id}-${issueRows.length}`,
          store_name: storeName,
          issue: row.issue ?? row.recommended_action ?? "Shelf issue",
          priority,
          status: "Open",
          scan_id: scan.id,
          href: `/results?scan=${scan.id}`,
        });
      }
    }
    for (const action of actionsList) {
      const status = (action.status ?? "open").toLowerCase();
      if (status === "resolved" || status === "verified" || status === "dismissed") continue;
      const priority = priorityFromSeverity(action.severity ?? action.priority);
      if (priority === "high") high += 1;
      else if (priority === "low") low += 1;
      else medium += 1;
      categoryCounts[categoryFromIssueType(action.issue_type)] += 1;
      if (issueRows.length < 8) {
        issueRows.push({
          id: `action-${scan.id}-${issueRows.length}`,
          store_name: storeName,
          issue: action.title,
          priority,
          status: status === "in_progress" ? "In progress" : "Open",
          scan_id: scan.id,
          href: `/results?scan=${scan.id}`,
        });
      }
    }
  }

  for (const action of openActions.slice(0, 8 - issueRows.length)) {
    const priority = priorityFromSeverity(action.issue_type);
    if (priority === "high") high += 1;
    else if (priority === "low") low += 1;
    else medium += 1;
    categoryCounts[categoryFromIssueType(action.issue_type)] += 1;
    issueRows.push({
      id: action.id as string,
      store_name: "Workspace",
      issue: action.suggestion,
      priority,
      status: action.status === "in_progress" ? "In progress" : "Open",
    });
  }

  const issuesTotal = high + medium + low;
  kpis.open_issues = issuesTotal || null;

  // --- Performance trend ---
  const trendKpis: AuditKpiId[] = trendKpisForRole(effectiveRole);
  const byDay = new Map<string, Record<string, number[]>>();
  for (const scan of scans) {
    const key = dayKey(scan.created_at);
    const bucket = byDay.get(key) ?? {};
    const metrics = metricsMap.get(scan.id) ?? null;
    for (const kpiId of trendKpis) {
      const val = kpiValue(metrics, effectiveRole, kpiId, scan);
      if (val === null) continue;
      bucket[kpiId] = [...(bucket[kpiId] ?? []), val];
    }
    byDay.set(key, bucket);
  }
  const performance_trend: PerformanceTrendPoint[] = [...byDay.keys()]
    .sort()
    .map((date) => {
      const bucket = byDay.get(date)!;
      const point: PerformanceTrendPoint = { date: formatDayLabel(date) };
      for (const kpiId of trendKpis) {
        const vals = bucket[kpiId];
        point[kpiId] = vals?.length ? Math.round(avg(vals)!) : null;
      }
      return point;
    });

  // --- Improvement (need >= 4 audits) ---
  let improvement: ImprovementMetric[] | null = null;
  if (scans.length >= 4) {
    const mid = Math.floor(scans.length / 2);
    const previous = scans.slice(0, mid);
    const current = scans.slice(mid);

    function periodAvg(list: ScanRow[], pick: (s: ScanRow) => number | null): number | null {
      const vals = list.map(pick).filter((v): v is number => typeof v === "number");
      return avg(vals.map((v) => normalizePercent(v) ?? v));
    }

    const prevOsa = periodAvg(previous, (s) => s.osa_percent);
    const currOsa = periodAvg(current, (s) => s.osa_percent);
    const prevPlano = periodAvg(previous, (s) => s.planogram_compliance_percent);
    const currPlano = periodAvg(current, (s) => s.planogram_compliance_percent);

    improvement = [];
    if (prevOsa !== null && currOsa !== null) {
      const delta = Math.round(currOsa - prevOsa);
      improvement.push({
        key: "osa",
        label: "OSA",
        previous: `${Math.round(prevOsa)}%`,
        current: `${Math.round(currOsa)}%`,
        change: delta >= 0 ? `+${delta} pts` : `${delta} pts`,
        improved: delta > 0 ? true : delta < 0 ? false : null,
      });
    }
    if (prevPlano !== null && currPlano !== null) {
      const delta = Math.round(currPlano - prevPlano);
      improvement.push({
        key: "planogram",
        label: "Planogram",
        previous: `${Math.round(prevPlano)}%`,
        current: `${Math.round(currPlano)}%`,
        change: delta >= 0 ? `+${delta} pts` : `${delta} pts`,
        improved: delta > 0 ? true : delta < 0 ? false : null,
      });
    }
    if (issuesTotal > 0) {
      improvement.push({
        key: "open_issues",
        label: "Open Issues",
        previous: "—",
        current: String(issuesTotal),
        change: "Current count",
        improved: null,
      });
    }
    if (!improvement.length) improvement = null;
  }

  // --- Store performance ---
  const byStore = new Map<
    string,
    { name: string; audits: number; osa: number[]; plano: number[]; issues: number; firstOsa: number | null; lastOsa: number | null }
  >();
  for (const scan of scans) {
    const sid = scan.store_id ?? "unknown";
    const entry = byStore.get(sid) ?? {
      name: scan.stores?.name ?? "Unknown store",
      audits: 0,
      osa: [],
      plano: [],
      issues: 0,
      firstOsa: null,
      lastOsa: null,
    };
    entry.audits += 1;
    if (typeof scan.osa_percent === "number") {
      const v = normalizePercent(scan.osa_percent) ?? scan.osa_percent;
      entry.osa.push(v);
      if (entry.firstOsa === null) entry.firstOsa = v;
      entry.lastOsa = v;
    }
    if (typeof scan.planogram_compliance_percent === "number") {
      entry.plano.push(normalizePercent(scan.planogram_compliance_percent) ?? scan.planogram_compliance_percent);
    }
    const metrics = metricsMap.get(scan.id);
    entry.issues +=
      (metrics?.opportunity_ledger ?? []).filter((r) => {
        const st = (r.status ?? "open").toLowerCase();
        return st !== "resolved" && st !== "verified" && st !== "dismissed";
      }).length +
      (metrics?.next_best_actions ?? []).filter((a) => {
        const st = (a.status ?? "open").toLowerCase();
        return st !== "resolved" && st !== "verified" && st !== "dismissed";
      }).length;
    byStore.set(sid, entry);
  }

  const stores: StorePerformanceRow[] = [...byStore.entries()]
    .map(([store_id, s]) => ({
      store_id,
      store_name: s.name,
      audits: s.audits,
      osa: avg(s.osa),
      planogram: avg(s.plano),
      open_issues: s.issues,
      change:
        s.firstOsa !== null && s.lastOsa !== null && s.audits > 1
          ? Math.round(s.lastOsa - s.firstOsa)
          : null,
    }))
    .sort((a, b) => (b.open_issues - a.open_issues) || (b.audits - a.audits));

  // --- Recent audits ---
  const recent_audits: RecentAuditRow[] = [...scans]
    .reverse()
    .slice(0, 8)
    .map((scan) => {
      const metrics = metricsMap.get(scan.id);
      const role = scanRole(metrics) ?? effectiveRole;
      const issueCount =
        (metrics?.opportunity_ledger ?? []).filter((r) => {
          const st = (r.status ?? "open").toLowerCase();
          return st !== "resolved" && st !== "verified";
        }).length +
        (metrics?.next_best_actions ?? []).filter((a) => {
          const st = (a.status ?? "open").toLowerCase();
          return st !== "resolved" && st !== "verified";
        }).length;
      return {
        scan_id: scan.id,
        date: scan.created_at,
        store_name: scan.stores?.name ?? "—",
        role,
        osa: typeof scan.osa_percent === "number" ? normalizePercent(scan.osa_percent) ?? scan.osa_percent : null,
        planogram:
          typeof scan.planogram_compliance_percent === "number"
            ? normalizePercent(scan.planogram_compliance_percent) ?? scan.planogram_compliance_percent
            : null,
        issues: issueCount,
      };
    });

  // --- Priority opportunities ---
  const priority_opportunities: PriorityOpportunityRow[] = PRIORITY_OPPORTUNITY_CATEGORIES.map((c) => ({
    category: c.key,
    label: c.label,
    count: categoryCounts[c.key],
  })).filter((r) => r.count > 0);

  // --- Role-specific visual ---
  let role_visual: RoleVisualData | null = null;
  if (effectiveRole === "fmcg" && scans.length) {
    const latest = scans[scans.length - 1]!;
    const metrics = metricsMap.get(latest.id);
    const insights = metrics?.competitive_insights ?? [];
    if (insights.length) {
      const segments: ShareOfShelfSegment[] = [];
      for (const [i, row] of insights.entries()) {
        const match = row.share_note?.match(/(\d+(?:\.\d+)?)\s*%/);
        const share = match ? Number(match[1]) : null;
        if (share === null) continue;
        segments.push({
          label: row.brand ?? `Brand ${i + 1}`,
          share,
          is_primary: i === 0,
        });
      }
      if (segments.length) role_visual = { kind: "share_of_shelf", segments };
    } else {
      const brandShare = metrics?.share_of_facings ?? metrics?.linear_shelf_share;
      const val =
        brandShare && typeof brandShare === "object" && "value" in brandShare
          ? (brandShare as { value?: number }).value
          : latest.share_of_shelf_percent;
      if (typeof val === "number") {
        const primary = Math.round(normalizePercent(val) ?? val);
        role_visual = {
          kind: "share_of_shelf",
          segments: [{ label: "Target brand", share: primary, is_primary: true }],
        };
      }
    }
  } else if (effectiveRole === "distributor" && stores.length) {
    role_visual = {
      kind: "outlet_execution",
      outlets: stores.slice(0, 8).map((s) => ({
        name: s.store_name,
        osa: s.osa,
        msl: null,
        planogram: s.planogram,
      })),
    };
  } else if (effectiveRole === "darkstore" && scans.length) {
    const locMap = new Map<string, number[]>();
    for (const scan of scans) {
      const metrics = metricsMap.get(scan.id);
      const loc = kpiValue(metrics, effectiveRole, "location_accuracy", scan);
      const label = scan.stores?.name ?? scan.category ?? "Location";
      if (loc !== null) locMap.set(label, [...(locMap.get(label) ?? []), loc]);
    }
    const locations = [...locMap.entries()].map(([label, vals]) => ({
      label,
      accuracy: avg(vals),
    }));
    if (locations.length) role_visual = { kind: "location_accuracy", locations };
  }

  return {
    kpis,
    issues: { total: issuesTotal, high, medium, low },
    issue_rows: issueRows,
    performance_trend,
    improvement,
    stores,
    recent_audits,
    priority_opportunities,
    role_visual,
    filter_options,
  };
}
