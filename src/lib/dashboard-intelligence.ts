/**
 * Workspace dashboard intelligence — aggregates real audit data for the operational home.
 * No fabricated metrics; empty states when data is insufficient.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError } from "@/lib/db/context";
import { FALLBACK_CATEGORIES, type ShelfCategory } from "@/lib/categories.data";
import {
  attentionAreasForRole,
  effectiveDashboardRole,
  KPI_DASHBOARD_LABELS,
  trendKpisForRole,
  type PriorityCategory,
  PRIORITY_OPPORTUNITY_CATEGORIES,
} from "@/lib/dashboard-config";
import {
  buildPerformanceOverTime,
  type PerformanceOverTimeData,
  type PerformancePeriodMetric,
} from "@/lib/dashboard-performance-trend";
import { getRoleProfile, type AuditKpiId } from "@/lib/role-kpi-config";
import {
  buildDashboardFilterSummary,
  resolveDashboardDateBounds,
  type DashboardFilterOptions,
  type DashboardFilterState,
  type DashboardFilterSummary,
  type DashboardStoreOption,
  type DashboardSubCategoryOption,
  type DashboardTeamMember,
} from "@/lib/dashboard-filters";
import { roleTabLabel } from "@/lib/role-audit-ui";
import { getUser, requireOrgId } from "@/lib/db/context";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import type { RetailIntelligencePayload } from "@/lib/retail-intelligence";
import { normalizePercent } from "@/lib/dashboard";
import {
  aggregateIssueResolution,
  aggregateShelfHealth,
  aggregateWeightedKpi,
  averageConfiguredTarget,
  formatWeightedDetail,
  kpiResultFromMetrics,
  type WeightedKpiRollup,
} from "@/lib/dashboard-kpi-aggregation";
export type DashboardFilters = DashboardFilterState;

export type DashboardWeightedKpi = {
  percent: number | null;
  numerator: number | null;
  denominator: number | null;
  detail: string | null;
  eligible_audits: number;
  trace_scan_id: string | null;
  available: boolean;
  unavailable_reason: string | null;
};

export type WorkspaceKpis = {
  audits_completed: number | null;
  stores_covered: number | null;
  osa: DashboardWeightedKpi;
  planogram: DashboardWeightedKpi;
  /** @deprecated use osa.percent — kept for downstream sections */
  avg_osa: number | null;
  /** @deprecated use planogram.percent */
  avg_planogram: number | null;
  open_issues: number | null;
  issue_resolution: {
    rate: number | null;
    display: string;
    resolved_count: number;
    outcome_count: number;
  };
  /** @deprecated use issue_resolution.rate */
  issues_resolved_rate: number | null;
  shelf_health: {
    score: number | null;
    display: string;
    available: boolean;
    audit_count: number;
  };
  /** @deprecated use shelf_health.available */
  shelf_health_available: boolean;
  audits_remaining: number | null;
  audits_unlimited: boolean;
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

/** @deprecated use PerformanceOverTimeData.chart_points */
export type PerformanceTrendPoint = {
  date: string;
  [kpi: string]: string | number | null;
};

export type { PerformanceOverTimeData, PerformancePeriodMetric };

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
  category: string | null;
  osa: number | null;
  planogram: number | null;
  issues: number;
  assigned_to: string | null;
  status: string;
};

export type AttentionCard = {
  key: string;
  area_label: string;
  score: number | null;
  score_display: string;
  explanation: string;
  issue_count: number;
  affected_audits: number;
  variance: string | null;
  target_percent: number | null;
  variance_pts: number | null;
  progress_percent: number | null;
  scan_id: string | null;
  action_label: string;
  kpi_id: AuditKpiId;
  no_data: boolean;
  no_data_reason: string | null;
  rank_score: number;
};

export type BrandCompetitionData = {
  segments: ShareOfShelfSegment[];
  insight: string | null;
  scan_id: string | null;
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
  attention_cards: AttentionCard[];
  performance_trend: PerformanceTrendPoint[];
  performance_over_time: PerformanceOverTimeData;
  performance_period: PerformancePeriodMetric[];
  improvement: ImprovementMetric[] | null;
  stores: StorePerformanceRow[];
  recent_audits: RecentAuditRow[];
  priority_opportunities: PriorityOpportunityRow[];
  role_visual: RoleVisualData | null;
  brand_competition: BrandCompetitionData | null;
  filter_options: DashboardFilterOptions;
  filter_summary: DashboardFilterSummary;
  effective_role: AuditRoleTab;
  has_completed_audits: boolean;
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
    if (error) dbError(error, "Could not load audit metrics.");
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

function mergeCategoryMaster(
  categoryMaster: ShelfCategory[],
  poolScans: ScanRow[],
  roleFilter: DashboardFilterState["role"],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
): { categories: string[]; subcategories: DashboardSubCategoryOption[] } {
  let scoped = poolScans;
  if (roleFilter !== "all") {
    scoped = scoped.filter((s) => scanRole(metricsMap.get(s.id) ?? null) === roleFilter);
  }
  const scanCategorySet = new Set(scoped.map((s) => s.category).filter(Boolean) as string[]);
  const masterNames = categoryMaster.map((c) => c.name);
  const categories = [
    ...new Set([
      ...masterNames,
      ...scanCategorySet,
    ]),
  ].sort();

  const subMap = new Map<string, DashboardSubCategoryOption>();
  for (const cat of categoryMaster) {
    for (const sub of cat.subcategories ?? []) {
      subMap.set(`${cat.name}::${sub.label}`, {
        category: cat.name,
        value: sub.label,
        label: sub.label,
      });
    }
  }
  for (const scan of scoped) {
    const cat = scan.category?.trim();
    const label = scanSubCategoryLabel(scan);
    if (!cat || !label) continue;
    subMap.set(`${cat}::${label}`, { category: cat, value: label, label });
  }
  return {
    categories,
    subcategories: [...subMap.values()].sort((a, b) => a.label.localeCompare(b.label)),
  };
}

function mapStoreRows(
  rows: Array<{ id: string; name: string; country?: string | null; city?: string | null }>,
): DashboardStoreOption[] {
  return rows.map((s) => ({
    id: s.id,
    name: s.name ?? "Store",
    country: s.country?.trim() || null,
    city: s.city?.trim() || null,
  }));
}

function locationLists(stores: DashboardStoreOption[]): { countries: string[]; cities: string[] } {
  const countries = [...new Set(stores.map((s) => s.country).filter(Boolean) as string[])].sort();
  const cities = [...new Set(stores.map((s) => s.city).filter(Boolean) as string[])].sort();
  return { countries, cities };
}

function buildKriOptions(role: AuditRoleTab): Array<{ value: AuditKpiId; label: string }> {
  return getRoleProfile(role).primary_kpis.map((k) => ({
    value: k.kpi_id,
    label: KPI_DASHBOARD_LABELS[k.kpi_id] ?? k.label,
  }));
}

function kpiIssueCategories(kpiId: AuditKpiId): PriorityCategory[] {
  switch (kpiId) {
    case "osa":
      return ["availability"];
    case "planogram_compliance":
    case "location_accuracy":
    case "facing_count":
    case "share_of_shelf":
      return ["placement"];
    case "assortment_compliance":
    case "msl_compliance":
      return ["assortment"];
    case "price_compliance":
      return ["pricing"];
    case "promotional_compliance":
      return ["promotion"];
    default:
      return [];
  }
}

function scanHasOpenIssueInCategories(
  metrics: RetailIntelligencePayload | null,
  categories: PriorityCategory[],
): boolean {
  if (!categories.length) return false;
  const catSet = new Set(categories);
  for (const row of metrics?.opportunity_ledger ?? []) {
    const status = (row.status ?? "open").toLowerCase();
    if (status === "resolved" || status === "verified" || status === "dismissed" || status === "closed") {
      continue;
    }
    if (catSet.has(categoryFromIssueType(row.issue ?? ""))) return true;
  }
  for (const action of metrics?.next_best_actions ?? []) {
    const status = (action.status ?? "open").toLowerCase();
    if (status === "resolved" || status === "verified" || status === "dismissed") continue;
    if (catSet.has(categoryFromIssueType(action.issue_type ?? action.title ?? ""))) return true;
  }
  return false;
}

function scanMatchesKri(
  scan: ScanRow,
  metrics: RetailIntelligencePayload | null,
  role: AuditRoleTab,
  kpiId: AuditKpiId,
): boolean {
  if (kpiValue(metrics, role, kpiId, scan) !== null) return true;
  return scanHasOpenIssueInCategories(metrics, kpiIssueCategories(kpiId));
}

function effectiveRoleForOptions(
  roleHint: DashboardFilterState["role"],
  poolScans: ScanRow[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
): AuditRoleTab {
  if (roleHint !== "all") return roleHint;
  const latest = poolScans.at(-1);
  return effectiveDashboardRole("all", latest ? scanRole(metricsMap.get(latest.id) ?? null) : null);
}

function buildFilterOptions(
  allStores: DashboardStoreOption[],
  poolScans: ScanRow[],
  teamMembers: DashboardTeamMember[],
  currentUserId: string | null,
  filterHints: Pick<DashboardFilterState, "role" | "country" | "city">,
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  categoryMaster: ShelfCategory[] = FALLBACK_CATEGORIES,
): DashboardFilterOptions {
  let scoped = poolScans;
  if (filterHints.role !== "all") {
    scoped = scoped.filter((s) => scanRole(metricsMap.get(s.id) ?? null) === filterHints.role);
  }
  const storeIds = new Set(scoped.map((s) => s.store_id).filter(Boolean));
  let stores = allStores.filter((s) => storeIds.has(s.id));
  if (!stores.length) stores = allStores;
  if (filterHints.country !== "all") {
    stores = stores.filter((s) => s.country === filterHints.country);
  }
  if (filterHints.city !== "all") {
    stores = stores.filter((s) => s.city === filterHints.city);
  }
  const { categories, subcategories } = mergeCategoryMaster(
    categoryMaster,
    poolScans,
    filterHints.role,
    metricsMap,
  );
  const activeMembers = teamMembers.filter((m) =>
    scoped.some((s) => s.created_by === m.user_id),
  );
  const membersForFilter = activeMembers.length ? activeMembers : teamMembers;
  const { countries, cities } = locationLists(allStores);
  const kriRole = effectiveRoleForOptions(filterHints.role, poolScans, metricsMap);
  return {
    stores,
    countries,
    cities,
    categories,
    subcategories,
    team_members: membersForFilter,
    kri_options: buildKriOptions(kriRole),
    only_self: teamMembers.length <= 1,
    current_user_id: currentUserId,
  };
}

function toDashboardWeightedKpi(
  rollup: WeightedKpiRollup,
  unit: "percent" | "count",
  labels?: { numerator: string; denominator: string },
  unavailableReason?: string | null,
): DashboardWeightedKpi {
  const hasData = rollup.eligible_audit_ids.length > 0 && rollup.percent !== null;
  return {
    percent: rollup.percent !== null ? Math.round(rollup.percent) : null,
    numerator: rollup.denominator > 0 ? rollup.numerator : null,
    denominator: rollup.denominator > 0 ? rollup.denominator : null,
    detail: formatWeightedDetail(rollup, unit, labels),
    eligible_audits: rollup.eligible_audit_ids.length,
    trace_scan_id: rollup.worst_scan_id,
    available: hasData,
    unavailable_reason: hasData ? null : unavailableReason ?? "Not enough data",
  };
}

const TERMINAL_ISSUE = new Set(["resolved", "verified", "closed", "fixed", "dismissed"]);

function isOpenIssueStatus(status: string): boolean {
  const s = status.toLowerCase();
  return !TERMINAL_ISSUE.has(s);
}

function countOpenIssuesForScan(
  metrics: RetailIntelligencePayload | null,
  categories?: PriorityCategory[],
): number {
  if (!metrics) return 0;
  const catSet = categories?.length ? new Set(categories) : null;
  let count = 0;
  for (const row of metrics.opportunity_ledger ?? []) {
    const status = (row.status ?? "open").toLowerCase();
    if (!isOpenIssueStatus(status)) continue;
    if (!catSet || catSet.has(categoryFromIssueType(row.issue ?? ""))) count += 1;
  }
  for (const action of metrics.next_best_actions ?? []) {
    const status = (action.status ?? "open").toLowerCase();
    if (!isOpenIssueStatus(status)) continue;
    if (!catSet || catSet.has(categoryFromIssueType(action.issue_type ?? action.title ?? ""))) {
      count += 1;
    }
  }
  return count;
}

function countHighSeverityIssues(
  audits: ScanRow[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  categories?: PriorityCategory[],
): number {
  const catSet = categories?.length ? new Set(categories) : null;
  let high = 0;
  for (const scan of audits) {
    const metrics = metricsMap.get(scan.id);
    for (const row of metrics?.opportunity_ledger ?? []) {
      const status = (row.status ?? "open").toLowerCase();
      if (TERMINAL_ISSUE.has(status)) continue;
      if (catSet && !catSet.has(categoryFromIssueType(row.issue ?? ""))) continue;
      if (priorityFromSeverity(row.severity ?? row.priority) === "high") high += 1;
    }
    for (const action of metrics?.next_best_actions ?? []) {
      const status = (action.status ?? "open").toLowerCase();
      if (TERMINAL_ISSUE.has(status)) continue;
      if (catSet && !catSet.has(categoryFromIssueType(action.issue_type ?? action.title ?? ""))) continue;
      if (priorityFromSeverity(action.severity ?? action.priority) === "high") high += 1;
    }
  }
  return high;
}

function attentionRankScore(input: {
  highIssues: number;
  variancePts: number | null;
  issueCount: number;
  affectedAudits: number;
  noData: boolean;
}): number {
  if (input.noData && input.issueCount === 0) return -1;
  let score = 0;
  score += input.highIssues * 1000;
  if (input.variancePts !== null && input.variancePts < 0) {
    score += Math.abs(input.variancePts) * 10;
  }
  score += input.issueCount * 5;
  score += input.affectedAudits;
  return score;
}

function buildAttentionCards(
  audits: ScanRow[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  effectiveRole: AuditRoleTab,
  categoryCounts: Record<PriorityCategory, number>,
  kriFilter: AuditKpiId | "all" = "all",
): AttentionCard[] {
  let areas = attentionAreasForRole(effectiveRole);
  if (kriFilter !== "all") {
    areas = areas.filter(
      (area) =>
        area.kpis.includes(kriFilter) ||
        (kriFilter === "share_of_shelf" && area.competitive),
    );
  }

  const cards: AttentionCard[] = areas.map((area) => {
    const kpiId = area.kpis[0]!;
    const requirePlanogram = kpiId === "planogram_compliance";
    const rollup = aggregateWeightedKpi(audits, metricsMap, effectiveRole, kpiId, {
      requirePlanogram,
    });

    let score = rollup.percent !== null ? Math.round(rollup.percent) : null;
    let scanId = rollup.worst_scan_id;
    let actionLabel = "View audits →";
    let explanation = "";
    let noDataReason: string | null = null;

    if (area.competitive) {
      actionLabel = "View Brand Analysis →";
      area = { ...area, label: "Brand & Competition" };
      if (rollup.eligible_audit_ids.length === 0 || score === null) {
        const latest = audits.at(-1);
        if (latest) {
          const metrics = metricsMap.get(latest.id);
          const insights = metrics?.competitive_insights ?? [];
          const primary = insights[0];
          if (primary?.share_note) {
            explanation = primary.share_note;
            const match = primary.share_note.match(/(\d+(?:\.\d+)?)\s*%/);
            if (match) score = Math.round(Number(match[1]));
            scanId = latest.id;
          }
        }
        if (score === null) {
          noDataReason = "Insufficient shelf-space measurement data in this view.";
        }
      }
    }

    const targetPercent = averageConfiguredTarget(audits, metricsMap, kpiId);
    let variancePts: number | null =
      score !== null && targetPercent !== null ? Math.round(score - targetPercent) : null;
    let variance: string | null = null;
    if (variancePts !== null && targetPercent !== null) {
      const sign = variancePts >= 0 ? "+" : "";
      variance = `Target ${Math.round(targetPercent)}% · ${sign}${variancePts} pts`;
    }

    const issueCategories =
      area.issueCategories?.length ? area.issueCategories : kpiIssueCategories(kpiId);
    const issueCount = issueCategories.length
      ? issueCategories.reduce((sum, cat) => sum + (categoryCounts[cat] ?? 0), 0)
      : 0;

    let affectedAudits = 0;
    for (const scan of audits) {
      const metrics = metricsMap.get(scan.id);
      const issues = countOpenIssuesForScan(metrics, issueCategories);
      const kpi = kpiResultFromMetrics(metrics ?? null, effectiveRole, kpiId);
      const hasKpi =
        rollup.eligible_audit_ids.includes(scan.id) ||
        (kpi && (kpi.status === "complete" || kpi.status === "partial"));
      if (issues > 0 || hasKpi) affectedAudits += 1;
    }

    const highIssues = countHighSeverityIssues(audits, metricsMap, issueCategories);

    const noData = score === null && rollup.eligible_audit_ids.length === 0;
    if (noData && !noDataReason) {
      if (kpiId === "planogram_compliance") {
        noDataReason = "No planogram-backed audits in this view.";
      } else if (kpiId === "assortment_compliance" || kpiId === "msl_compliance") {
        noDataReason = "No required-product audits in this view.";
      } else {
        noDataReason = "Not enough audit data in this view.";
      }
    }

    if (!explanation) {
      if (noData) {
        explanation = noDataReason ?? "Not enough data";
      } else if (issueCount > 0) {
        explanation = `${issueCount} open issue${issueCount === 1 ? "" : "s"} need attention`;
      } else if (affectedAudits > 0) {
        explanation = `${affectedAudits} affected audit${affectedAudits === 1 ? "" : "s"}`;
      } else {
        explanation = "No open issues in this area.";
      }
    }

    const isCountKpi = kpiId === "facing_count";
    const scoreDisplay = noData
      ? "Not enough data"
      : isCountKpi && rollup.denominator > 0
        ? `${rollup.numerator} / ${rollup.denominator}`
        : score !== null
          ? area.competitive
            ? `${score}% share of shelf`
            : `${score}%`
          : "Not enough data";

    const progressPercent =
      noData || score === null
        ? null
        : isCountKpi && rollup.denominator > 0
          ? Math.min(100, Math.round((rollup.numerator / rollup.denominator) * 100))
          : Math.min(100, Math.max(0, score));

    const rankScore = attentionRankScore({
      highIssues,
      variancePts,
      issueCount,
      affectedAudits,
      noData,
    });

    return {
      key: area.key,
      area_label: area.competitive ? "Brand & Competition" : area.label,
      score,
      score_display: scoreDisplay,
      explanation,
      issue_count: issueCount,
      affected_audits: affectedAudits,
      variance,
      target_percent: targetPercent,
      variance_pts: variancePts,
      progress_percent: progressPercent,
      scan_id: scanId,
      action_label: actionLabel,
      kpi_id: kpiId,
      no_data: noData,
      no_data_reason: noDataReason,
      rank_score: rankScore,
    };
  });

  return cards.sort((a, b) => b.rank_score - a.rank_score);
}

function buildBrandCompetition(
  audits: ScanRow[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  effectiveRole: AuditRoleTab,
): BrandCompetitionData | null {
  if (effectiveRole !== "fmcg" || !audits.length) return null;
  const latest = audits[audits.length - 1]!;
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
    if (segments.length) {
      return {
        segments,
        insight: insights[0]?.share_note ?? null,
        scan_id: latest.id,
      };
    }
  }
  const brandShare = metrics?.share_of_facings ?? metrics?.linear_shelf_share;
  const val =
    brandShare && typeof brandShare === "object" && "value" in brandShare
      ? (brandShare as { value?: number }).value
      : latest.share_of_shelf_percent;
  if (typeof val !== "number") return null;
  const primary = Math.round(normalizePercent(val) ?? val);
  return {
    segments: [
      { label: "Target brand", share: primary, is_primary: true },
      { label: "Competitor brands", share: Math.max(0, 100 - primary), is_primary: false },
    ],
    insight: null,
    scan_id: latest.id,
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
  audits: ScanRow[],
  filters: DashboardFilterState,
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  assignmentByScanId: Map<string, AssignmentRow>,
  currentUserId: string | null,
  storeById: Map<string, DashboardStoreOption>,
): ScanRow[] {
  return audits.filter((scan) => {
    if (filters.role !== "all" && scanRole(metricsMap.get(scan.id) ?? null) !== filters.role) {
      return false;
    }
    const store = scan.store_id ? storeById.get(scan.store_id) : undefined;
    if (filters.country !== "all" && store?.country !== filters.country) return false;
    if (filters.city !== "all" && store?.city !== filters.city) return false;
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

  const [storesRes, auditsRes, teamMembers] = await Promise.all([
    supabase.from("stores").select("id, name, country, city").eq("org_id", orgId).eq("status", "active").order("name"),
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

  const allStores = mapStoreRows(storesRes.data ?? []);
  const poolScans = (scansRes.data ?? []) as ScanRow[];
  const metricsMap = await fetchMetricsMap(poolScans.map((s) => s.id));
  return buildFilterOptions(
    allStores,
    poolScans,
    teamMembers,
    user?.id ?? null,
    { role: roleHint, country: "all", city: "all" },
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
    supabase.from("stores").select("id, name, country, city").eq("org_id", orgId).eq("status", "active").order("name"),
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

  let audits: ScanRow[] = [];
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
      audits = (data ?? []) as ScanRow[];
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
    audits = (data ?? []) as ScanRow[];
  }

  const { data: poolScansRes } = await supabase
    .from("shelf_scans")
    .select(SCAN_SELECT)
    .eq("org_id", orgId)
    .eq("status", "completed")
    .gte("created_at", optionSince.toISOString());

  if (storesRes.error) dbError(storesRes.error, "Could not load stores.");

  const allStores = mapStoreRows(storesRes.data ?? []);
  const storeById = new Map(allStores.map((s) => [s.id, s]));

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
    { role: filters.role, country: filters.country, city: filters.city },
    poolMetricsMap,
  );

  const scanIds = audits.map((s) => s.id);
  const metricsMap = await fetchMetricsMap(scanIds);
  const confidenceMap = await fetchConfidenceMap(scanIds);

  audits = applyScanFilters(audits, filters, metricsMap, assignmentByScanId, currentUserId, storeById);

  const effectiveRole =
    filters.role !== "all"
      ? filters.role
      : effectiveDashboardRole("all", scanRole(metricsMap.get(audits.at(-1)?.id ?? "") ?? null));

  if (filters.kri !== "all") {
    audits = audits.filter((scan) =>
      scanMatchesKri(scan, metricsMap.get(scan.id) ?? null, effectiveRole, filters.kri as AuditKpiId),
    );
  }

  const kriCategories =
    filters.kri !== "all" ? kpiIssueCategories(filters.kri as AuditKpiId) : null;

  // --- KPIs (weighted aggregation from filtered audits) ---
  const storeIds = new Set(audits.map((s) => s.store_id).filter(Boolean));

  const osaRollup = aggregateWeightedKpi(audits, metricsMap, effectiveRole, "osa");
  const planoRollup = aggregateWeightedKpi(audits, metricsMap, effectiveRole, "planogram_compliance", {
    requirePlanogram: true,
  });
  const issueResolution = aggregateIssueResolution(audits, metricsMap);
  const shelfHealthRollup = aggregateShelfHealth(audits, metricsMap);

  const sub = subscriptionRes.data as
    | { audits_used: number; subscription_plans: { scan_quota: number | null } | null }
    | null;
  const quota = sub?.subscription_plans?.scan_quota ?? null;
  const auditsUnlimited = quota === null;
  const auditsRemaining = auditsUnlimited ? null : Math.max(0, quota - (sub?.scans_used ?? 0));

  const confValues = [...confidenceMap.values()];
  const totalProducts = audits.reduce((sum, s) => sum + (s.total_products ?? 0), 0);
  const totalPhotos = audits.reduce((sum, s) => sum + (s.photo_count ?? 0), 0);

  const osaKpi = toDashboardWeightedKpi(osaRollup, "percent", {
    numerator: "available",
    denominator: "assessed",
  });
  const planoKpi = toDashboardWeightedKpi(
    planoRollup,
    "percent",
    { numerator: "passing", denominator: "positions" },
    "No planogram-backed audits in this view.",
  );

  const kpis: WorkspaceKpis = {
    audits_completed: audits.length || null,
    stores_covered: storeIds.size || null,
    osa: osaKpi,
    planogram: planoKpi,
    avg_osa: osaKpi.percent,
    avg_planogram: planoKpi.percent,
    open_issues: null,
    issue_resolution: issueResolution,
    issues_resolved_rate: issueResolution.rate,
    shelf_health: {
      score: shelfHealthRollup.score,
      display: shelfHealthRollup.display,
      available: shelfHealthRollup.available,
      audit_count: shelfHealthRollup.audit_count,
    },
    shelf_health_available: shelfHealthRollup.available,
    audits_remaining: auditsRemaining,
    audits_unlimited: auditsUnlimited,
    products_detected: audits.length ? totalProducts : null,
    average_confidence: confValues.length ? avg(confValues.map((v) => normalizePercent(v) ?? v)) : null,
    images_processed: audits.length ? totalPhotos : null,
  };

  const actions = actionsRes.data ?? [];
  const openActions = actions.filter((a) => a.status === "open" || a.status === "in_progress");

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

  for (const scan of [...audits].reverse().slice(0, 40)) {
    const metrics = metricsMap.get(scan.id);
    const storeName = scan.stores?.name ?? "Unknown store";
    const ledger = metrics?.opportunity_ledger ?? [];
    const actionsList = metrics?.next_best_actions ?? [];
    for (const row of ledger) {
      const status = (row.status ?? "open").toLowerCase();
      if (status === "resolved" || status === "verified" || status === "dismissed" || status === "closed") continue;
      const issueCat = categoryFromIssueType(row.issue ?? "");
      if (kriCategories && !kriCategories.includes(issueCat)) continue;
      const priority = priorityFromSeverity(row.severity ?? row.priority);
      if (priority === "high") high += 1;
      else if (priority === "low") low += 1;
      else medium += 1;
      categoryCounts[issueCat] += 1;
      if (issueRows.length < 8) {
        issueRows.push({
          id: `ledger-${scan.id}-${issueRows.length}`,
          store_name: storeName,
          issue: row.issue ?? row.recommended_action ?? "Shelf issue",
          priority,
          status: "Open",
          scan_id: scan.id,
          href: `/results?audit=${scan.id}`,
        });
      }
    }
    for (const action of actionsList) {
      const status = (action.status ?? "open").toLowerCase();
      if (status === "resolved" || status === "verified" || status === "dismissed") continue;
      const issueCat = categoryFromIssueType(action.issue_type ?? action.title ?? "");
      if (kriCategories && !kriCategories.includes(issueCat)) continue;
      const priority = priorityFromSeverity(action.severity ?? action.priority);
      if (priority === "high") high += 1;
      else if (priority === "low") low += 1;
      else medium += 1;
      categoryCounts[issueCat] += 1;
      if (issueRows.length < 8) {
        issueRows.push({
          id: `action-${scan.id}-${issueRows.length}`,
          store_name: storeName,
          issue: action.title,
          priority,
          status: status === "in_progress" ? "In progress" : "Open",
          scan_id: scan.id,
          href: `/results?audit=${scan.id}`,
        });
      }
    }
  }

  for (const action of openActions.slice(0, 8 - issueRows.length)) {
    const issueCat = categoryFromIssueType(action.issue_type);
    if (kriCategories && !kriCategories.includes(issueCat)) continue;
    const priority = priorityFromSeverity(action.issue_type);
    if (priority === "high") high += 1;
    else if (priority === "low") low += 1;
    else medium += 1;
    categoryCounts[issueCat] += 1;
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

  const trendKpis: AuditKpiId[] =
    filters.kri !== "all"
      ? [filters.kri as AuditKpiId]
      : trendKpisForRole(effectiveRole);
  const performance_over_time = buildPerformanceOverTime(audits, metricsMap, effectiveRole, trendKpis);
  const performance_trend: PerformanceTrendPoint[] = performance_over_time.chart_points.map((p) => {
    const legacy: PerformanceTrendPoint = { date: p.date_label };
    for (const kpiId of trendKpis) {
      legacy[kpiId] = p.values[kpiId] ?? null;
    }
    return legacy;
  });

  // --- Improvement (need >= 4 audits) ---
  let improvement: ImprovementMetric[] | null = null;
  if (audits.length >= 4) {
    const mid = Math.floor(audits.length / 2);
    const previous = audits.slice(0, mid);
    const current = audits.slice(mid);

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
  for (const scan of audits) {
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

  const memberNameById = new Map(teamMembers.map((m) => [m.user_id, m.name || m.email]));

  // --- Recent audits ---
  const recent_audits: RecentAuditRow[] = [...audits]
    .reverse()
    .slice(0, 10)
    .map((scan) => {
      const metrics = metricsMap.get(scan.id);
      const role = scanRole(metrics) ?? effectiveRole;
      const assignment = assignmentByScanId.get(scan.id);
      const issueCount =
        (metrics?.opportunity_ledger ?? []).filter((r) => {
          const st = (r.status ?? "open").toLowerCase();
          return st !== "resolved" && st !== "verified";
        }).length +
        (metrics?.next_best_actions ?? []).filter((a) => {
          const st = (a.status ?? "open").toLowerCase();
          return st !== "resolved" && st !== "verified";
        }).length;
      const assigneeId = assignment?.assignee_id ?? null;
      return {
        scan_id: scan.id,
        date: scan.created_at,
        store_name: scan.stores?.name ?? "—",
        role: roleTabLabel(role),
        category: scan.category,
        osa: typeof scan.osa_percent === "number" ? normalizePercent(scan.osa_percent) ?? scan.osa_percent : null,
        planogram:
          typeof scan.planogram_compliance_percent === "number"
            ? normalizePercent(scan.planogram_compliance_percent) ?? scan.planogram_compliance_percent
            : null,
        issues: issueCount,
        assigned_to: assigneeId ? memberNameById.get(assigneeId) ?? "Assigned" : null,
        status: assignment?.status
          ? assignment.status.replace(/_/g, " ")
          : "Completed",
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
  if (effectiveRole === "fmcg" && audits.length) {
    const latest = audits[audits.length - 1]!;
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
  } else if (effectiveRole === "darkstore" && audits.length) {
    const locMap = new Map<string, number[]>();
    for (const scan of audits) {
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

  const categoryCountInView = new Set(audits.map((s) => s.category).filter(Boolean)).size;
  const filter_summary = buildDashboardFilterSummary(
    audits.length,
    storeIds.size,
    categoryCountInView,
  );

  const attention_cards = buildAttentionCards(
    audits,
    metricsMap,
    effectiveRole,
    categoryCounts,
    filters.kri,
  );

  const performance_period = performance_over_time.period_metrics;
  const brand_competition =
    filters.kri === "all" || filters.kri === "share_of_shelf"
      ? buildBrandCompetition(audits, metricsMap, effectiveRole)
      : null;

  return {
    kpis,
    issues: { total: issuesTotal, high, medium, low },
    issue_rows: issueRows,
    attention_cards,
    performance_trend,
    performance_over_time,
    performance_period,
    improvement,
    stores,
    recent_audits,
    priority_opportunities,
    role_visual,
    brand_competition,
    filter_options,
    filter_summary,
    effective_role: effectiveRole,
    has_completed_audits: audits.length > 0,
  };
}
