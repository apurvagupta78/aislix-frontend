/**
 * Store & team performance rankings — groups filtered audits by dimension
 * and scores using existing weighted KPI aggregation (no new formulas).
 */

import { attentionAreasForRole } from "@/lib/dashboard-config";
import {
  aggregateWeightedKpi,
  averageConfiguredTarget,
  type WeightedKpiRollup,
} from "@/lib/dashboard-kpi-aggregation";
import type { DashboardStoreOption } from "@/lib/dashboard-filters";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import type { RetailIntelligencePayload } from "@/lib/retail-intelligence";
import { KPI_DASHBOARD_LABELS } from "@/lib/dashboard-config";

export type PerformanceRankDimension =
  | "store"
  | "city"
  | "country"
  | "category"
  | "sub_category"
  | "team_member";

export type PerformanceTargetStatus = "above" | "at" | "below";

export type PerformanceRankRow = {
  id: string;
  name: string;
  performance_score: number | null;
  previous_score: number | null;
  change: number | null;
  audit_count: number;
  store_count: number;
  open_issues: number;
  target_status: PerformanceTargetStatus | null;
  kpis: Partial<Record<AuditKpiId, number | null>>;
  filter: {
    store_id?: string;
    city?: string;
    country?: string;
    category?: string;
    sub_category?: string;
    team_member_id?: string;
  };
};

export type PerformanceRankingsData = {
  by_dimension: Record<PerformanceRankDimension, PerformanceRankRow[]>;
  role_kpi_ids: AuditKpiId[];
  score_weights: Array<{ kpi_id: AuditKpiId; label: string; weight_percent: number }>;
};

type ScanRef = {
  id: string;
  created_at: string;
  store_id: string | null;
  category: string | null;
  sub_category: string | null;
  sub_category_label: string | null;
  sub_category_custom: string | null;
  created_by: string | null;
  assignment_id: string | null;
  stores?: { name?: string; city?: string | null } | null;
};

type AssignmentRef = { assignee_id: string; scan_id: string | null };

const TERMINAL_ISSUE = new Set(["resolved", "verified", "closed", "fixed", "dismissed"]);

function scanSubCategoryLabel(scan: ScanRef): string {
  return (
    scan.sub_category_label?.trim() ||
    scan.sub_category_custom?.trim() ||
    scan.sub_category?.trim() ||
    ""
  );
}

function roleKpiIds(role: AuditRoleTab): AuditKpiId[] {
  return attentionAreasForRole(role).map((a) => a.kpis[0]!);
}

function rollupPercent(rollup: WeightedKpiRollup): number | null {
  return rollup.percent !== null ? Math.round(rollup.percent) : null;
}

function countOpenIssues(metrics: RetailIntelligencePayload | null): number {
  let count = 0;
  for (const row of metrics?.opportunity_ledger ?? []) {
    const st = (row.status ?? "open").toLowerCase();
    if (!TERMINAL_ISSUE.has(st)) count += 1;
  }
  for (const action of metrics?.next_best_actions ?? []) {
    const st = (action.status ?? "open").toLowerCase();
    if (!TERMINAL_ISSUE.has(st)) count += 1;
  }
  return count;
}

function computeScoresForScans(
  scans: ScanRef[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  role: AuditRoleTab,
  kpiIds: AuditKpiId[],
): {
  score: number | null;
  kpis: Partial<Record<AuditKpiId, number | null>>;
  target_status: PerformanceTargetStatus | null;
} {
  const kpis: Partial<Record<AuditKpiId, number | null>> = {};
  const eligible: number[] = [];
  const targets: number[] = [];

  for (const kpiId of kpiIds) {
    const rollup = aggregateWeightedKpi(scans, metricsMap, role, kpiId, {
      requirePlanogram: kpiId === "planogram_compliance",
    });
    const val = rollupPercent(rollup);
    kpis[kpiId] = val;
    if (val !== null) eligible.push(val);
    const target = averageConfiguredTarget(scans, metricsMap, kpiId);
    if (target !== null) targets.push(Math.round(target));
  }

  const score =
    eligible.length > 0
      ? Math.round(eligible.reduce((sum, v) => sum + v, 0) / eligible.length)
      : null;

  let target_status: PerformanceTargetStatus | null = null;
  if (score !== null && targets.length) {
    const avgTarget = Math.round(targets.reduce((a, b) => a + b, 0) / targets.length);
    if (score > avgTarget + 2) target_status = "above";
    else if (score < avgTarget - 2) target_status = "below";
    else target_status = "at";
  }

  return { score, kpis, target_status };
}

function entityMetrics(
  scans: ScanRef[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  role: AuditRoleTab,
  kpiIds: AuditKpiId[],
): Omit<PerformanceRankRow, "id" | "name" | "filter"> {
  const sorted = [...scans].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const current = computeScoresForScans(sorted, metricsMap, role, kpiIds);

  let previous_score: number | null = null;
  let change: number | null = null;
  if (sorted.length >= 4) {
    const mid = Math.floor(sorted.length / 2);
    const prev = computeScoresForScans(sorted.slice(0, mid), metricsMap, role, kpiIds);
    previous_score = prev.score;
    if (current.score !== null && previous_score !== null) {
      change = current.score - previous_score;
    }
  }

  const storeIds = new Set(sorted.map((s) => s.store_id).filter(Boolean));
  let open_issues = 0;
  for (const scan of sorted) {
    open_issues += countOpenIssues(metricsMap.get(scan.id) ?? null);
  }

  return {
    performance_score: current.score,
    previous_score,
    change,
    audit_count: sorted.length,
    store_count: storeIds.size,
    open_issues,
    target_status: current.target_status,
    kpis: current.kpis,
  };
}

function pushGroup(
  map: Map<string, { id: string; name: string; scans: ScanRef[]; filter: PerformanceRankRow["filter"] }>,
  id: string,
  name: string,
  scan: ScanRef,
  filter: PerformanceRankRow["filter"],
) {
  const key = id || name;
  if (!key) return;
  const entry = map.get(key) ?? { id: key, name: name || key, scans: [], filter };
  entry.scans.push(scan);
  map.set(key, entry);
}

function buildDimensionRows(
  audits: ScanRef[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  role: AuditRoleTab,
  kpiIds: AuditKpiId[],
  dimension: PerformanceRankDimension,
  storeById: Map<string, DashboardStoreOption>,
  memberNameById: Map<string, string>,
  assignmentByScanId: Map<string, AssignmentRef>,
): PerformanceRankRow[] {
  const groups = new Map<
    string,
    { id: string; name: string; scans: ScanRef[]; filter: PerformanceRankRow["filter"] }
  >();

  for (const scan of audits) {
    switch (dimension) {
      case "store": {
        const sid = scan.store_id ?? "unknown";
        pushGroup(
          groups,
          sid,
          scan.stores?.name ?? storeById.get(sid)?.name ?? "Unknown store",
          scan,
          { store_id: sid },
        );
        break;
      }
      case "city": {
        const store = scan.store_id ? storeById.get(scan.store_id) : undefined;
        const city = store?.city ?? scan.stores?.city?.trim();
        if (!city) continue;
        pushGroup(groups, city, city, scan, { city });
        break;
      }
      case "country": {
        const store = scan.store_id ? storeById.get(scan.store_id) : undefined;
        const country = store?.country;
        if (!country) continue;
        pushGroup(groups, country, country, scan, { country });
        break;
      }
      case "category": {
        const cat = scan.category?.trim();
        if (!cat) continue;
        pushGroup(groups, cat, cat, scan, { category: cat });
        break;
      }
      case "sub_category": {
        const sub = scanSubCategoryLabel(scan);
        if (!sub) continue;
        pushGroup(groups, sub, sub, scan, { sub_category: sub, category: scan.category ?? undefined });
        break;
      }
      case "team_member": {
        const assignment = assignmentByScanId.get(scan.id);
        const memberId = assignment?.assignee_id ?? scan.created_by;
        if (!memberId) continue;
        const name = memberNameById.get(memberId) ?? "Team member";
        pushGroup(groups, memberId, name, scan, { team_member_id: memberId });
        break;
      }
    }
  }

  return [...groups.values()]
    .map((g) => ({
      id: g.id,
      name: g.name,
      filter: g.filter,
      ...entityMetrics(g.scans, metricsMap, role, kpiIds),
    }))
    .filter((r) => r.audit_count > 0);
}

export function buildPerformanceRankingsData(
  audits: ScanRef[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  role: AuditRoleTab,
  storeById: Map<string, DashboardStoreOption>,
  memberNameById: Map<string, string>,
  assignmentByScanId: Map<string, AssignmentRef>,
): PerformanceRankingsData {
  const kpiIds = roleKpiIds(role);
  const weight = kpiIds.length ? Math.round(100 / kpiIds.length) : 0;
  const score_weights = kpiIds.map((kpi_id) => ({
    kpi_id,
    label: KPI_DASHBOARD_LABELS[kpi_id],
    weight_percent: weight,
  }));

  const dimensions: PerformanceRankDimension[] = [
    "store",
    "city",
    "country",
    "category",
    "sub_category",
    "team_member",
  ];

  const by_dimension = {} as Record<PerformanceRankDimension, PerformanceRankRow[]>;
  for (const dim of dimensions) {
    by_dimension[dim] = buildDimensionRows(
      audits,
      metricsMap,
      role,
      kpiIds,
      dim,
      storeById,
      memberNameById,
      assignmentByScanId,
    );
  }

  return { by_dimension, role_kpi_ids: kpiIds, score_weights };
}

export function exportPerformanceRankingsCsv(
  rows: PerformanceRankRow[],
  dimension: PerformanceRankDimension,
  roleKpiIds: AuditKpiId[],
): void {
  const allKpis: AuditKpiId[] = [
    "osa",
    "planogram_compliance",
    "assortment_compliance",
    "location_accuracy",
    "facing_count",
    "share_of_shelf",
    "msl_compliance",
    "price_compliance",
    "promotional_compliance",
  ];

  const headers = [
    "Rank",
    "Dimension",
    "Dimension Name",
    "Performance Score",
    ...allKpis.map((k) => KPI_DASHBOARD_LABELS[k]),
    "Issue Count",
    "Previous Score",
    "Change",
    "Audit Count",
    "Store Count",
  ];

  const dimLabel =
    dimension === "sub_category"
      ? "Sub-category"
      : dimension === "team_member"
        ? "Team Member"
        : dimension.charAt(0).toUpperCase() + dimension.slice(1);

  const lines = rows.map((row, i) => {
    const cells: (string | number)[] = [
      i + 1,
      dimLabel,
      row.name,
      row.performance_score ?? "",
      ...allKpis.map((k) => {
        if (!roleKpiIds.includes(k)) return "";
        const v = row.kpis[k];
        return v !== null && v !== undefined ? `${Math.round(v)}%` : "";
      }),
      row.open_issues,
      row.previous_score ?? "",
      row.change ?? "",
      row.audit_count,
      row.store_count,
    ];
    return cells
      .map((c) => {
        const s = String(c);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(",");
  });

  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `aislix-performance-${dimension}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
