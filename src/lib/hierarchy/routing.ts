/**
 * FMCG hierarchy-based auto-routing — Region → Territory → … → Outlet → Store.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId } from "@/lib/db/context";
import type { AssignableMember } from "@/lib/assignments";
import type { DistributionEntry } from "@/lib/assignment-engine/types";

export type HierarchyOutletResolution = {
  storeId: string;
  nodeId: string;
  nodeName: string;
  levelKey: string;
  salesRepId: string | null;
};

export type HierarchyAssigneeResolution = {
  userId: string;
  nodeId: string;
  nodeName: string;
  levelKey: string;
};

export const FMCG_ASSIGNMENT_LEVELS = [
  { key: "region", label: "Region" },
  { key: "territory", label: "Territory" },
  { key: "area", label: "Area" },
  { key: "distributor", label: "Distributor" },
  { key: "sales_rep", label: "Sales Rep" },
  { key: "beat", label: "Beat" },
  { key: "outlet", label: "Outlet" },
] as const;

export type FmcgAssignmentLevel = (typeof FMCG_ASSIGNMENT_LEVELS)[number]["key"];

export async function resolveHierarchyOutlets(
  profileId: string,
  nodeId: string,
): Promise<HierarchyOutletResolution[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase.rpc("resolve_hierarchy_outlet_stores", {
    p_org_id: orgId,
    p_profile_id: profileId,
    p_node_id: nodeId,
  });

  if (error) {
    if (error.code === "42883") return [];
    dbError(error, "Could not resolve hierarchy outlets.");
  }

  return (data ?? [])
    .filter((row: Record<string, unknown>) => row.store_id)
    .map((row: Record<string, unknown>) => ({
      storeId: row.store_id as string,
      nodeId: row.node_id as string,
      nodeName: row.node_name as string,
      levelKey: row.level_key as string,
      salesRepId: (row.sales_rep_id as string) ?? null,
    }));
}

export async function resolveHierarchyAssignees(
  profileId: string,
  nodeId: string,
  levelKey?: string,
): Promise<HierarchyAssigneeResolution[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase.rpc("resolve_hierarchy_assignees", {
    p_org_id: orgId,
    p_profile_id: profileId,
    p_node_id: nodeId,
    p_level_key: levelKey ?? null,
  });

  if (error) {
    if (error.code === "42883") return [];
    dbError(error, "Could not resolve hierarchy assignees.");
  }

  return (data ?? [])
    .filter((row: Record<string, unknown>) => row.user_id)
    .map((row: Record<string, unknown>) => ({
      userId: row.user_id as string,
      nodeId: row.node_id as string,
      nodeName: row.node_name as string,
      levelKey: row.level_key as string,
    }));
}

/** Map outlets to sales reps using hierarchy metadata; round-robin fallback. */
export function buildHierarchyDistribution(input: {
  outlets: HierarchyOutletResolution[];
  assignees: AssignableMember[];
  storeNames?: Record<string, string>;
}): {
  distribution: DistributionEntry[];
  manualMapping: Record<string, string>;
  storeIds: string[];
} {
  const { outlets, assignees, storeNames } = input;
  const storeIds = [...new Set(outlets.map((o) => o.storeId))];
  const manualMapping: Record<string, string> = {};
  const byAssignee = new Map<string, string[]>();

  outlets.forEach((outlet, index) => {
    let assigneeId = outlet.salesRepId;
    if (!assigneeId || !assignees.some((a) => a.user_id === assigneeId)) {
      assigneeId = assignees[index % assignees.length]?.user_id;
    }
    if (!assigneeId) return;
    manualMapping[outlet.storeId] = assigneeId;
    const list = byAssignee.get(assigneeId) ?? [];
    if (!list.includes(outlet.storeId)) list.push(outlet.storeId);
    byAssignee.set(assigneeId, list);
  });

  const distribution: DistributionEntry[] = assignees
    .filter((a) => byAssignee.has(a.user_id))
    .map((a) => {
      const ids = byAssignee.get(a.user_id) ?? [];
      return {
        assigneeId: a.user_id,
        assigneeName: a.name,
        storeIds: ids,
        storeCount: ids.length,
      };
    });

  void storeNames;
  return { distribution, manualMapping, storeIds };
}
