/**
 * Store-level audit governance history — variance, findings, recurring issues.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId } from "@/lib/db/context";
import { fetchFindings, findingTypeLabel } from "@/lib/findings";
import { fetchLifecycleActions } from "@/lib/corrective-action-lifecycle";

export type StoreVariancePoint = {
  date: string;
  expected: number;
  actual: number;
  variance: number;
};

export type StoreAuditHistoryRow = {
  scan_id: string;
  date: string;
  status: string;
  health_score: number | null;
  variance_units: number;
  findings_count: number;
  open_actions: number;
  planogram_compliance: number | null;
};

export type StoreRecurringIssue = {
  sku: string;
  product_name: string;
  finding_type: string;
  frequency: number;
  last_seen: string;
  total_impact: number;
};

export type StoreGovernanceSnapshot = {
  varianceTrend: StoreVariancePoint[];
  auditHistory: StoreAuditHistoryRow[];
  recurringIssues: StoreRecurringIssue[];
  openFindings: number;
  criticalFindings: number;
  overdueActions: number;
  pendingVerification: number;
  totalValueVariance: number;
};

export async function fetchStoreGovernanceSnapshot(storeId: string): Promise<StoreGovernanceSnapshot> {
  const orgId = await requireOrgId();
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const [findings, actions, linesRes, scansRes] = await Promise.all([
    fetchFindings({ storeId }),
    fetchLifecycleActions({ storeId }),
    supabase
      .from("digital_audit_lines")
      .select("expected_qty, actual_qty, variance_qty, updated_at")
      .eq("org_id", orgId)
      .eq("store_id", storeId)
      .gte("updated_at", since.toISOString())
      .order("updated_at", { ascending: true }),
    supabase
      .from("shelf_scans")
      .select("id, created_at, status, shelf_health_score, planogram_compliance_percent")
      .eq("org_id", orgId)
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (linesRes.error) dbError(linesRes.error, "Could not load store variance.");
  if (scansRes.error) dbError(scansRes.error, "Could not load store audits.");

  const byDate = new Map<string, StoreVariancePoint>();
  for (const row of linesRes.data ?? []) {
    const date = String(row.updated_at).slice(0, 10);
    const cur = byDate.get(date) ?? { date, expected: 0, actual: 0, variance: 0 };
    cur.expected += Number(row.expected_qty) || 0;
    cur.actual += Number(row.actual_qty) || 0;
    cur.variance += Number(row.variance_qty) || 0;
    byDate.set(date, cur);
  }

  const findingsByScan = new Map<string, number>();
  for (const f of findings) {
    if (!f.scan_id) continue;
    findingsByScan.set(f.scan_id, (findingsByScan.get(f.scan_id) ?? 0) + 1);
  }

  const openActionsByScan = new Map<string, number>();
  for (const a of actions) {
    if (!a.scan_id || ["closed", "resolved"].includes(a.status)) continue;
    openActionsByScan.set(a.scan_id, (openActionsByScan.get(a.scan_id) ?? 0) + 1);
  }

  const auditHistory: StoreAuditHistoryRow[] = (scansRes.data ?? []).map((scan) => ({
    scan_id: scan.id as string,
    date: scan.created_at as string,
    status: String(scan.status ?? "completed"),
    health_score: scan.shelf_health_score != null ? Number(scan.shelf_health_score) : null,
    variance_units: 0,
    findings_count: findingsByScan.get(scan.id as string) ?? 0,
    open_actions: openActionsByScan.get(scan.id as string) ?? 0,
    planogram_compliance:
      scan.planogram_compliance_percent != null ? Number(scan.planogram_compliance_percent) : null,
  }));

  const recurringMap = new Map<string, StoreRecurringIssue>();
  for (const f of findings) {
    const key = `${f.sku}|${f.finding_type}`;
    const cur = recurringMap.get(key) ?? {
      sku: f.sku ?? "—",
      product_name: f.product_name ?? f.sku ?? "SKU",
      finding_type: findingTypeLabel(f.finding_type),
      frequency: 0,
      last_seen: f.created_at,
      total_impact: 0,
    };
    cur.frequency += 1;
    cur.total_impact += Math.abs(f.variance_value_inr ?? 0);
    if (f.created_at > cur.last_seen) cur.last_seen = f.created_at;
    recurringMap.set(key, cur);
  }

  const openFindings = findings.filter((f) => !["closed", "resolved"].includes(f.status)).length;
  const criticalFindings = findings.filter(
    (f) => f.severity === "critical" && !["closed", "resolved"].includes(f.status),
  ).length;

  return {
    varianceTrend: [...byDate.values()],
    auditHistory,
    recurringIssues: [...recurringMap.values()]
      .filter((r) => r.frequency >= 2)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 8),
    openFindings,
    criticalFindings,
    overdueActions: actions.filter((a) => a.status === "overdue").length,
    pendingVerification: actions.filter((a) => a.status === "pending_verification").length,
    totalValueVariance: findings.reduce((s, f) => s + Math.abs(f.variance_value_inr ?? 0), 0),
  };
}
