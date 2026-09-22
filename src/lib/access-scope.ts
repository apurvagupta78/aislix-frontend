/**
 * Authoritative access scope — PUBLIC-SAAS locked model.
 *
 * ACCESS = role + organization + reporting hierarchy + direct stores + assignment scope.
 * Owner/admin = organization-wide. Managers are NOT org-wide; they get direct + descendant stores.
 * Effective store IDs come from SQL `effective_store_ids` (dynamic — never duplicated).
 */

import { supabase } from "@/integrations/supabase/client";
import { requireOrgId, requireUserId } from "@/lib/db/context";

export type AccessRole =
  | "owner"
  | "admin"
  | "manager"
  | "member"
  | "store_manager"
  | "viewer"
  | string;

export type EffectiveAccessScope = {
  orgId: string;
  userId: string;
  role: AccessRole;
  isOrgAdmin: boolean;
  /** owner/admin/manager/store_manager — can assign/review within scope */
  isManager: boolean;
  /** Direct store_ids on the membership (or all stores for owner/admin). */
  directStoreIds: string[];
  /** Inherited via reporting tree / assignment-touch (effective − direct). */
  inheritedStoreIds: string[];
  /** Authoritative union used for all data queries. */
  effectiveStoreIds: string[];
  /** Empty effective list → no store-scoped rows (never fall back to org-wide). */
  hasStoreScope: boolean;
};

const ORG_ADMIN_ROLES = new Set(["owner", "admin"]);
const MANAGER_ROLES = new Set(["owner", "admin", "manager", "store_manager"]);

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

async function rpcUuidArray(
  fn: "effective_store_ids" | "direct_store_ids" | "inherited_store_ids",
  orgId: string,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase.rpc(fn as never, {
    p_org_id: orgId,
    p_user_id: userId,
  } as never);
  if (error) {
    // Fallback when RPC is not yet migrated — compute in app (still not org-wide for managers).
    console.warn(`[access-scope] ${fn} RPC failed:`, error.message);
    return [];
  }
  if (Array.isArray(data)) return uniqueIds(data.map(String));
  return [];
}

/** Load membership role for the active user in an org. */
export async function fetchMembershipRole(
  orgId: string,
  userId: string,
): Promise<{ role: AccessRole; storeIds: string[]; reportsToUserId: string | null; status: string } | null> {
  const { data } = await supabase
    .from("organization_members")
    .select("role, status, store_ids, reports_to_user_id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    role: String(data.role ?? "member"),
    storeIds: ((data as { store_ids?: string[] }).store_ids ?? []).map(String),
    reportsToUserId: (data as { reports_to_user_id?: string | null }).reports_to_user_id ?? null,
    status: String(data.status ?? ""),
  };
}

/**
 * Authoritative effective access scope for the signed-in user (or a target user).
 * Prefer SQL RPCs; falls back to client-side recursive expansion if RPCs missing.
 */
export async function resolveEffectiveAccessScope(opts?: {
  orgId?: string;
  userId?: string;
}): Promise<EffectiveAccessScope> {
  const orgId = opts?.orgId ?? (await requireOrgId());
  const userId = opts?.userId ?? (await requireUserId());
  const membership = await fetchMembershipRole(orgId, userId);

  const role = (membership?.role ?? "member") as AccessRole;
  const isOrgAdmin = ORG_ADMIN_ROLES.has(role);
  const isManager = MANAGER_ROLES.has(role);

  let effectiveStoreIds = await rpcUuidArray("effective_store_ids", orgId, userId);
  let directStoreIds = await rpcUuidArray("direct_store_ids", orgId, userId);
  let inheritedStoreIds = await rpcUuidArray("inherited_store_ids", orgId, userId);

  // Client fallback if RPCs returned empty but membership exists (pre-migration / error).
  if (
    membership?.status === "active" &&
    effectiveStoreIds.length === 0 &&
    (isOrgAdmin || (membership.storeIds?.length ?? 0) > 0)
  ) {
    const computed = await computeEffectiveStoreIdsClient(orgId, userId, membership);
    effectiveStoreIds = computed.effective;
    directStoreIds = computed.direct;
    inheritedStoreIds = computed.inherited;
  }

  return {
    orgId,
    userId,
    role,
    isOrgAdmin,
    isManager,
    directStoreIds: uniqueIds(directStoreIds),
    inheritedStoreIds: uniqueIds(inheritedStoreIds),
    effectiveStoreIds: uniqueIds(effectiveStoreIds),
    hasStoreScope: uniqueIds(effectiveStoreIds).length > 0,
  };
}

async function computeEffectiveStoreIdsClient(
  orgId: string,
  userId: string,
  membership: { role: AccessRole; storeIds: string[] },
): Promise<{ effective: string[]; direct: string[]; inherited: string[] }> {
  const { data: stores } = await supabase
    .from("stores")
    .select("id")
    .eq("org_id", orgId)
    .eq("status", "active");
  const orgStoreIds = (stores ?? []).map((s) => s.id as string);

  if (ORG_ADMIN_ROLES.has(membership.role)) {
    return { effective: orgStoreIds, direct: orgStoreIds, inherited: [] };
  }

  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id, store_ids, reports_to_user_id, status")
    .eq("org_id", orgId)
    .eq("status", "active");

  const byManager = new Map<string, string[]>();
  for (const row of members ?? []) {
    const mgr = (row as { reports_to_user_id?: string | null }).reports_to_user_id;
    if (!mgr) continue;
    const list = byManager.get(mgr) ?? [];
    list.push(row.user_id as string);
    byManager.set(mgr, list);
  }

  const descendants = new Set<string>();
  const queue = [...(byManager.get(userId) ?? [])];
  while (queue.length) {
    const next = queue.shift()!;
    if (descendants.has(next)) continue;
    descendants.add(next);
    for (const child of byManager.get(next) ?? []) queue.push(child);
  }

  const storeByUser = new Map(
    (members ?? []).map((m) => [
      m.user_id as string,
      ((m.store_ids ?? []) as string[]),
    ]),
  );

  const direct = uniqueIds(membership.storeIds).filter((id) => orgStoreIds.includes(id));
  const inheritedFromTeam: string[] = [];
  for (const desc of descendants) {
    for (const sid of storeByUser.get(desc) ?? []) inheritedFromTeam.push(sid);
  }

  const { data: assignments } = await supabase
    .from("scan_assignments")
    .select("store_id")
    .eq("org_id", orgId)
    .or(`assignee_id.eq.${userId},assigner_id.eq.${userId}`)
    .limit(5000);
  const assignmentStores = (assignments ?? [])
    .map((a) => a.store_id as string | null)
    .filter(Boolean) as string[];

  const effective = uniqueIds([...direct, ...inheritedFromTeam, ...assignmentStores]).filter((id) =>
    orgStoreIds.includes(id),
  );
  const directSet = new Set(direct);
  const inherited = effective.filter((id) => !directSet.has(id));
  return { effective, direct, inherited };
}

/**
 * Apply store scope to a Supabase query builder that has a `store_id` column.
 * Returns null when scope is empty (caller should short-circuit to empty results).
 */
export function applyStoreScopeFilter<T extends { in: (column: string, values: string[]) => T }>(
  query: T,
  scope: EffectiveAccessScope,
  column = "store_id",
): T | null {
  if (scope.isOrgAdmin) return query;
  if (!scope.hasStoreScope) return null;
  return query.in(column, scope.effectiveStoreIds);
}

/** Sentinel when a filter requests a store outside scope. */
export const OUT_OF_SCOPE_STORE = "__none__";

export function clampStoreIdToScope(
  storeId: string | null | undefined,
  scope: EffectiveAccessScope,
): string | undefined {
  if (!storeId || storeId === "all") return storeId ?? undefined;
  if (scope.isOrgAdmin) return storeId;
  if (!scope.effectiveStoreIds.includes(storeId)) return OUT_OF_SCOPE_STORE;
  return storeId;
}
