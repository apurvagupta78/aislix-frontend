/**
 * Operational command-center aggregates for the dashboard — findings, actions, assignments, RCA.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId } from "@/lib/db/context";
import type { DashboardFilterState } from "@/lib/dashboard-filters";
import { RCA_OPTIONS } from "@/lib/digital-audit";
import {
  fetchFindings,
  findingTypeLabel,
  findingsKpis,
  rcaLabel,
  type Finding,
} from "@/lib/findings";
import {
  fetchLifecycleActions,
  lifecycleActionsKpis,
  slaRemainingLabel,
} from "@/lib/corrective-action-lifecycle";

export type AuditStatusCounts = {
  assigned: number;
  in_progress: number;
  submitted: number;
  approved: number;
  overdue: number;
};

export type VarianceRankRow = {
  id: string;
  label: string;
  value: number;
  count: number;
};

export type RecurringIssue = {
  key: string;
  issue: string;
  store: string;
  store_id: string | null;
  sku: string | null;
  frequency: number;
  first_seen: string;
  last_seen: string;
  total_impact: number;
  status: string;
};

export type GovernanceCommandCenter = {
  findingsKpis: ReturnType<typeof findingsKpis>;
  actionKpis: ReturnType<typeof lifecycleActionsKpis>;
  auditStatus: AuditStatusCounts;
  storeCount: number;
  completionPct: number | null;
  planogramCompliance: number | null;
  inventoryVarianceUnits: number;
  topVarianceStores: VarianceRankRow[];
  topVarianceSkus: VarianceRankRow[];
  rcaBreakdown: { code: string; label: string; count: number }[];
  recurringIssues: RecurringIssue[];
  criticalFindings: Finding[];
  slaCompliancePct: number | null;
};

function applyStoreFilter<T extends { eq: (c: string, v: string) => T }>(
  query: T,
  filters?: DashboardFilterState,
): T {
  if (filters?.storeId && filters.storeId !== "all") {
    return query.eq("store_id", filters.storeId);
  }
  return query;
}

export async function fetchGovernanceCommandCenter(
  filters: DashboardFilterState,
  planogramCompliance?: number | null,
): Promise<GovernanceCommandCenter> {
  const orgId = await requireOrgId();

  const [findings, actions, assignmentsRes, storesRes, varianceLinesRes] = await Promise.all([
    fetchFindings({ filters }),
    fetchLifecycleActions({
      storeId: filters.storeId !== "all" ? filters.storeId : undefined,
    }),
    (async () => {
      let q = supabase
        .from("scan_assignments")
        .select("id, status, due_at, approval_status")
        .eq("org_id", orgId);
      q = applyStoreFilter(q, filters);
      const { data, error } = await q.limit(500);
      if (error) return [];
      return data ?? [];
    })(),
    (async () => {
      let q = supabase.from("stores").select("id", { count: "exact", head: true }).eq("org_id", orgId);
      if (filters.storeId && filters.storeId !== "all") {
        q = q.eq("id", filters.storeId);
      }
      const { count } = await q;
      return count ?? 0;
    })(),
    (async () => {
      let q = supabase
        .from("digital_audit_lines")
        .select("variance_qty, variance_value_inr")
        .eq("org_id", orgId)
        .not("variance_qty", "is", null)
        .neq("variance_qty", 0);
      q = applyStoreFilter(q, filters);
      const { data, error } = await q.limit(2000);
      if (error) return [];
      return data ?? [];
    })(),
  ]);

  const now = Date.now();
  const auditStatus: AuditStatusCounts = {
    assigned: 0,
    in_progress: 0,
    submitted: 0,
    approved: 0,
    overdue: 0,
  };

  for (const row of assignmentsRes) {
    const status = String(row.status ?? "");
    const approval = String(row.approval_status ?? "");
    const dueAt = row.due_at as string | null;
    const isOverdue = dueAt && new Date(dueAt).getTime() < now && !["approved", "completed"].includes(status);

    if (isOverdue) auditStatus.overdue += 1;
    if (approval === "approved" || status === "completed") auditStatus.approved += 1;
    else if (status === "submitted" || approval === "pending_review") auditStatus.submitted += 1;
    else if (status === "in_progress") auditStatus.in_progress += 1;
    else auditStatus.assigned += 1;
  }

  const completed = auditStatus.approved;
  const total = assignmentsRes.length;
  const completionPct = total ? (completed / total) * 100 : null;

  const inventoryVarianceUnits = varianceLinesRes.reduce(
    (sum, row) => sum + Math.abs(Number(row.variance_qty) || 0),
    0,
  );

  const storeMap = new Map<string, { label: string; value: number; count: number }>();
  const skuMap = new Map<string, { label: string; value: number; count: number }>();

  for (const f of findings) {
    const storeKey = f.store_id ?? f.store_name;
    const storeCur = storeMap.get(storeKey) ?? { label: f.store_name, value: 0, count: 0 };
    storeCur.value += Math.abs(f.variance_value_inr ?? 0);
    storeCur.count += 1;
    storeMap.set(storeKey, storeCur);

    const skuKey = f.sku ?? f.product_name ?? f.id;
    const skuCur = skuMap.get(skuKey) ?? { label: f.product_name || f.sku || "SKU", value: 0, count: 0 };
    skuCur.value += Math.abs(f.variance_value_inr ?? 0);
    skuCur.count += 1;
    skuMap.set(skuKey, skuCur);
  }

  const topVarianceStores = [...storeMap.entries()]
    .map(([id, row]) => ({ id, label: row.label, value: row.value, count: row.count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const topVarianceSkus = [...skuMap.entries()]
    .map(([id, row]) => ({ id, label: row.label, value: row.value, count: row.count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const rcaCounts = new Map<string, number>();
  for (const f of findings) {
    if (!f.rca_code) continue;
    rcaCounts.set(f.rca_code, (rcaCounts.get(f.rca_code) ?? 0) + 1);
  }
  const rcaBreakdown = RCA_OPTIONS.map((opt) => ({
    code: opt.code,
    label: opt.label,
    count: rcaCounts.get(opt.code) ?? 0,
  })).filter((r) => r.count > 0);

  const recurringMap = findings.reduce<
    Record<string, RecurringIssue>
  >((acc, row) => {
    const key = `${row.store_id}|${row.sku}|${row.finding_type}`;
    const cur = acc[key] ?? {
      key,
      issue: findingTypeLabel(row.finding_type),
      store: row.store_name,
      store_id: row.store_id,
      sku: row.sku,
      frequency: 0,
      first_seen: row.created_at,
      last_seen: row.created_at,
      total_impact: 0,
      status: row.status,
    };
    cur.frequency += 1;
    cur.total_impact += Math.abs(row.variance_value_inr ?? 0);
    if (row.created_at < cur.first_seen) cur.first_seen = row.created_at;
    if (row.created_at > cur.last_seen) {
      cur.last_seen = row.created_at;
      cur.status = row.status;
    }
    acc[key] = cur;
    return acc;
  }, {});

  const recurringIssues = Object.values(recurringMap)
    .filter((r) => r.frequency >= 2)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 8);

  const criticalFindings = findings
    .filter((f) => f.severity === "critical" && !["closed", "resolved"].includes(f.status))
    .slice(0, 6);

  const closedSla = actions.filter((a) => a.closed_at && a.due_at);
  const onTime = closedSla.filter(
    (a) => new Date(a.closed_at!).getTime() <= new Date(a.due_at!).getTime(),
  );
  const slaCompliancePct = closedSla.length ? (onTime.length / closedSla.length) * 100 : null;

  return {
    findingsKpis: findingsKpis(findings),
    actionKpis: lifecycleActionsKpis(actions),
    auditStatus,
    storeCount: storesRes,
    completionPct,
    planogramCompliance: planogramCompliance ?? null,
    inventoryVarianceUnits,
    topVarianceStores,
    topVarianceSkus,
    rcaBreakdown,
    recurringIssues,
    criticalFindings,
    slaCompliancePct,
  };
}

export function storeHealthLabel(score: number | null | undefined): {
  label: string;
  className: string;
} {
  const s = score ?? 0;
  if (s >= 90) return { label: "Excellent", className: "text-accent-green" };
  if (s >= 80) return { label: "Good", className: "text-accent-green" };
  if (s >= 60) return { label: "Needs attention", className: "text-warning" };
  return { label: "Critical", className: "text-destructive" };
}
