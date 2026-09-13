/**
 * Execution opportunity aggregation — ranks revenue-at-risk from recent audits.
 * Never presents estimates as actual revenue; labels clearly when indicative.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId } from "@/lib/db/context";
import type { FinancialImpact } from "@/lib/scan-results";

export type ExecutionOpportunity = {
  id: string;
  store_name: string;
  store_id: string | null;
  scan_id: string;
  issue_type: string;
  title: string;
  detail: string;
  estimated_daily_impact_inr: number;
  confidence: "priced" | "indicative";
  created_at: string;
};

function impactFromMetrics(metrics: Record<string, unknown>): FinancialImpact | null {
  const fi = metrics["financial_impact"];
  if (!fi || typeof fi !== "object") return null;
  const row = fi as FinancialImpact;
  if (row.level === 1 && row.commercial_risk) return row;
  if (!row.estimated_daily_lost_sales_inr) return null;
  return row;
}

/** Top execution opportunities from recent audits with financial impact data. */
export async function fetchExecutionOpportunities(limit = 8): Promise<ExecutionOpportunity[]> {
  const orgId = await requireOrgId();

  const { data: audits, error } = await supabase
    .from("shelf_scans")
    .select("id, created_at, store_id, stores(name)")
    .eq("org_id", orgId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) dbError(error, "Could not load audits for opportunities.");

  const scanIds = (scans ?? []).map((s) => s.id as string);
  if (!scanIds.length) return [];

  const { data: results, error: resultsError } = await supabase
    .from("scan_results")
    .select("scan_id, metrics, executive_summary")
    .in("scan_id", scanIds);
  if (resultsError) dbError(resultsError, "Could not load audit metrics.");

  const metricsByScan = new Map(
    (results ?? []).map((r) => [r.scan_id as string, r.metrics as Record<string, unknown>]),
  );

  const opportunities: ExecutionOpportunity[] = [];

  for (const scan of audits ?? []) {
    const scanId = scan.id as string;
    const metrics = metricsByScan.get(scanId) ?? {};
    const fi = impactFromMetrics(metrics);
    if (!fi) continue;
    const hasFinancial = fi.estimated_daily_lost_sales_inr > 0;
    const hasRisk = fi.level === 1 && Boolean(fi.commercial_risk);
    if (!hasFinancial && !hasRisk) continue;

    const storeJoin = scan.stores as { name?: string } | null;
    const oos = fi.oos_sku_count ?? 0;
    const atRisk = fi.at_risk_sku_count ?? 0;
    const issueType = oos > 0 ? "oos" : atRisk > 0 ? "low_stock" : "execution";

    opportunities.push({
      id: `opp-${scanId}`,
      store_name: storeJoin?.name ?? "Unknown store",
      store_id: (scan.store_id as string | null) ?? null,
      scan_id: scanId,
      issue_type: issueType,
      title:
        oos > 0
          ? `${oos} OOS SKU(s) — estimated opportunity`
          : `${atRisk} at-risk SKU(s) — estimated opportunity`,
      detail: fi.methodology ?? "Indicative revenue at risk from latest audit.",
      estimated_daily_impact_inr: fi.estimated_daily_lost_sales_inr || 0,
      confidence: fi.confidence === "priced" ? "priced" : "indicative",
      created_at: scan.created_at as string,
    });
  }

  return opportunities
    .sort((a, b) => b.estimated_daily_impact_inr - a.estimated_daily_impact_inr)
    .slice(0, limit);
}

export type OpenActionsSummary = {
  open: number;
  in_progress: number;
  overdue_assignments: number;
};

export async function fetchOpenActionsSummary(): Promise<OpenActionsSummary> {
  const orgId = await requireOrgId();

  const [{ count: open }, { count: inProgress }, { data: assignments }] = await Promise.all([
    supabase
      .from("corrective_actions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "open"),
    supabase
      .from("corrective_actions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "in_progress"),
    supabase
      .from("scan_assignments")
      .select("id, due_at, status")
      .eq("org_id", orgId)
      .in("status", ["pending", "needs_correction"]),
  ]);

  const now = Date.now();
  const overdue =
    assignments?.filter((a) => {
      if (!a.due_at) return false;
      return new Date(a.due_at as string).getTime() < now;
    }).length ?? 0;

  return {
    open: open ?? 0,
    in_progress: inProgress ?? 0,
    overdue_assignments: overdue,
  };
}
