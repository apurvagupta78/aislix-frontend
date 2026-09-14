/**
 * SKU-level governance history — variance trend, findings, RCA, corrective actions.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId } from "@/lib/db/context";
import { rcaLabel } from "@/lib/findings";
import { fetchFindings } from "@/lib/findings";
import { fetchLifecycleActions } from "@/lib/corrective-action-lifecycle";

export type SkuTrendPoint = {
  date: string;
  expected: number;
  actual: number;
  variance: number;
  store_name: string;
  scan_id: string;
};

export type SkuHistorySnapshot = {
  trend: SkuTrendPoint[];
  findings: Awaited<ReturnType<typeof fetchFindings>>;
  actions: Awaited<ReturnType<typeof fetchLifecycleActions>>;
  rcaHistory: { code: string; label: string; count: number }[];
  totalVarianceValue: number;
};

export async function fetchSkuHistory(sku: string, storeId?: string): Promise<SkuHistorySnapshot> {
  const orgId = await requireOrgId();
  const since = new Date();
  since.setDate(since.getDate() - 180);

  let linesQuery = supabase
    .from("digital_audit_lines")
    .select(
      "expected_qty, actual_qty, variance_qty, variance_value_inr, updated_at, scan_id, rca_code, stores:store_id (name)",
    )
    .eq("org_id", orgId)
    .ilike("sku", sku)
    .gte("updated_at", since.toISOString())
    .order("updated_at", { ascending: true });

  if (storeId && storeId !== "all") {
    linesQuery = linesQuery.eq("store_id", storeId);
  }

  const { data: lines, error } = await linesQuery.limit(200);
  if (error) dbError(error, "Could not load SKU history.");

  const trend: SkuTrendPoint[] = (lines ?? []).map((row) => ({
    date: String(row.updated_at).slice(0, 10),
    expected: Number(row.expected_qty) || 0,
    actual: Number(row.actual_qty) || 0,
    variance: Number(row.variance_qty) || 0,
    store_name: ((row.stores as { name?: string })?.name) ?? "Store",
    scan_id: row.scan_id as string,
  }));

  const [findings, actions] = await Promise.all([
    fetchFindings({ sku, storeId }),
    fetchLifecycleActions({ storeId }),
  ]);

  const skuActions = actions.filter((a) => a.sku === sku || findings.some((f) => f.id === a.finding_id));

  const rcaCounts = new Map<string, number>();
  for (const row of lines ?? []) {
    const code = row.rca_code as string | null;
    if (!code) continue;
    rcaCounts.set(code, (rcaCounts.get(code) ?? 0) + 1);
  }
  for (const f of findings) {
    if (!f.rca_code) continue;
    rcaCounts.set(f.rca_code, (rcaCounts.get(f.rca_code) ?? 0) + 1);
  }

  const rcaHistory = [...rcaCounts.entries()]
    .map(([code, count]) => ({ code, label: rcaLabel(code), count }))
    .sort((a, b) => b.count - a.count);

  const totalVarianceValue = (lines ?? []).reduce(
    (s, row) => s + Math.abs(Number(row.variance_value_inr) || 0),
    0,
  );

  return { trend, findings, actions: skuActions, rcaHistory, totalVarianceValue };
}
