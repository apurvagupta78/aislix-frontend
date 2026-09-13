/**
 * Territory / region hierarchy for multi-store roll-up analytics.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId } from "@/lib/db/context";

export type Territory = {
  id: string;
  name: string;
  parent_id: string | null;
  store_count: number;
  avg_compliance_percent: number | null;
  scan_count_30d: number;
};

export async function fetchTerritories(): Promise<Territory[]> {
  const orgId = await requireOrgId();
  const { data: rows, error } = await supabase
    .from("territories")
    .select("id, name, parent_id")
    .eq("org_id", orgId)
    .order("name");
  if (error) dbError(error, "Could not load territories.");

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();

  const { data: stores } = await supabase
    .from("stores")
    .select("id, territory_id")
    .eq("org_id", orgId);

  const storeIdsByTerritory = new Map<string, string[]>();
  for (const store of stores ?? []) {
    const tid = store.territory_id as string | null;
    if (!tid) continue;
    const list = storeIdsByTerritory.get(tid) ?? [];
    list.push(store.id as string);
    storeIdsByTerritory.set(tid, list);
  }

  const allStoreIds = (stores ?? []).map((s) => s.id as string);
  const { data: audits } = allStoreIds.length
    ? await supabase
        .from("shelf_scans")
        .select("store_id, planogram_compliance_percent")
        .eq("org_id", orgId)
        .eq("status", "completed")
        .gte("created_at", sinceIso)
        .in("store_id", allStoreIds)
    : { data: [] as { store_id: string; planogram_compliance_percent: number | null }[] };

  const statsByStore = new Map<string, { count: number; complianceSum: number; complianceN: number }>();
  for (const scan of audits ?? []) {
    const sid = scan.store_id as string;
    const entry = statsByStore.get(sid) ?? { count: 0, complianceSum: 0, complianceN: 0 };
    entry.count += 1;
    if (typeof scan.planogram_compliance_percent === "number") {
      entry.complianceSum += scan.planogram_compliance_percent;
      entry.complianceN += 1;
    }
    statsByStore.set(sid, entry);
  }

  return (rows ?? []).map((row) => {
    const storeIds = storeIdsByTerritory.get(row.id as string) ?? [];
    let scanCount = 0;
    let complianceSum = 0;
    let complianceN = 0;
    for (const sid of storeIds) {
      const stats = statsByStore.get(sid);
      if (!stats) continue;
      scanCount += stats.count;
      complianceSum += stats.complianceSum;
      complianceN += stats.complianceN;
    }
    return {
      id: row.id as string,
      name: row.name as string,
      parent_id: (row.parent_id as string | null) ?? null,
      store_count: storeIds.length,
      avg_compliance_percent: complianceN ? Math.round(complianceSum / complianceN) : null,
      scan_count_30d: scanCount,
    };
  });
}

export async function createTerritory(name: string, parentId?: string | null): Promise<string> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("territories")
    .insert({
      org_id: orgId,
      name: name.trim(),
      parent_id: parentId ?? null,
    })
    .select("id")
    .single();
  if (error) dbError(error, "Could not create territory.");
  return data!.id as string;
}

export async function assignStoreTerritory(storeId: string, territoryId: string | null): Promise<void> {
  const { error } = await supabase
    .from("stores")
    .update({ territory_id: territoryId })
    .eq("id", storeId);
  if (error) dbError(error, "Could not assign store to territory.");
}

/** Store ids linked to a territory (for dashboard roll-up filters). */
export async function fetchTerritoryStoreIds(territoryId: string): Promise<string[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("stores")
    .select("id")
    .eq("org_id", orgId)
    .eq("territory_id", territoryId);
  if (error) dbError(error, "Could not load territory stores.");
  return (data ?? []).map((row) => row.id as string);
}
