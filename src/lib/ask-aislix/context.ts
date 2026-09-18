import type { SupabaseClient } from "@supabase/supabase-js";

import type { DashboardFilterState } from "@/lib/dashboard-filters";
import type { Database } from "@/integrations/supabase/types";
import {
  ACCESS_DENIED_MESSAGE,
  type AskAislixAccessScope,
} from "@/lib/ask-aislix/ask-aislix.types";
import { AISLIX_DEMO_ORG_ID } from "@/lib/demo-environment";

const ORG_ADMIN_ROLES = new Set(["owner", "admin"]);
const MANAGER_ROLES = new Set(["owner", "admin", "manager", "store_manager"]);

type StoreRow = { id: string; city: string | null; country: string | null; name: string };

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeCity(value: string): string {
  return value.trim().toLowerCase();
}

/** Read-only showcase scope for the shared demo org (RLS: demo_showcase_read). */
export async function buildDemoShowcaseScope(
  supabase: SupabaseClient<Database>,
  userId: string,
  activeOrgId: string,
): Promise<AskAislixAccessScope> {
  const orgId = AISLIX_DEMO_ORG_ID;
  const { data: storeRows } = await supabase
    .from("stores")
    .select("id, city, country, name")
    .eq("org_id", orgId)
    .eq("status", "active");

  const orgStores = (storeRows ?? []) as StoreRow[];
  const orgStoreIds = orgStores.map((s) => s.id);

  const { data: assignmentRows } = await supabase
    .from("scan_assignments")
    .select("id, store_id, scan_id, assignee_id")
    .eq("org_id", orgId)
    .limit(5000);

  const accessibleAssignmentIds = (assignmentRows ?? []).map((r) => r.id as string);
  const accessibleScanIds = (assignmentRows ?? [])
    .map((r) => r.scan_id as string | null)
    .filter(Boolean) as string[];

  return {
    orgId,
    userId,
    role: "viewer",
    allowedStoreIds: orgStoreIds,
    allowedCities: uniqueStrings(orgStores.map((s) => s.city ?? "")),
    allowedCountries: uniqueStrings(orgStores.map((s) => s.country ?? "")),
    isOrgAdmin: true,
    isManager: true,
    accessibleAssignmentIds,
    accessibleScanIds,
    assignedToUserAssignmentIds: [],
    conductedScanIds: accessibleScanIds,
    conductedAssignmentIds: accessibleAssignmentIds,
    labeledDemo: true,
    activeOrgId,
  };
}

export async function buildAskAccessScope(
  supabase: SupabaseClient<Database>,
  userId: string,
  orgId: string,
): Promise<AskAislixAccessScope> {
  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("role, status, store_ids")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) throw new Error("Could not verify organization membership.");
  if (!membership || membership.status !== "active") {
    throw new Error(ACCESS_DENIED_MESSAGE);
  }

  const role = String(membership.role ?? "member").toLowerCase();
  const isOrgAdmin = ORG_ADMIN_ROLES.has(role);
  const isManager = MANAGER_ROLES.has(role);
  const memberStoreIds = ((membership.store_ids ?? []) as string[]).filter(Boolean);

  const { data: storeRows, error: storeError } = await supabase
    .from("stores")
    .select("id, city, country, name")
    .eq("org_id", orgId)
    .eq("status", "active");

  if (storeError) throw new Error("Could not load store scope.");

  const orgStores = (storeRows ?? []) as StoreRow[];
  const orgStoreIds = orgStores.map((s) => s.id);

  let allowedStoreIds: string[] = [];
  if (isOrgAdmin) {
    allowedStoreIds = orgStoreIds;
  } else if (memberStoreIds.length > 0) {
    allowedStoreIds = memberStoreIds.filter((id) => orgStoreIds.includes(id));
  }

  const { data: assignmentRows } = await supabase
    .from("scan_assignments")
    .select("id, store_id, scan_id, assignee_id")
    .eq("org_id", orgId)
    .or(`assignee_id.eq.${userId},assigner_id.eq.${userId}`)
    .limit(5000);

  const accessibleAssignmentIds: string[] = [];
  const assignedToUserAssignmentIds: string[] = [];
  const accessibleScanIds: string[] = [];
  const assignmentStoreIds: string[] = [];

  for (const row of assignmentRows ?? []) {
    accessibleAssignmentIds.push(row.id as string);
    if (row.assignee_id === userId) assignedToUserAssignmentIds.push(row.id as string);
    if (row.scan_id) accessibleScanIds.push(row.scan_id as string);
    if (row.store_id) assignmentStoreIds.push(row.store_id as string);
  }

  const { data: conductedScans } = await supabase
    .from("shelf_scans")
    .select("id, store_id, assignment_id")
    .eq("org_id", orgId)
    .or(`created_by.eq.${userId},finalized_by.eq.${userId}`)
    .limit(5000);

  let conductedScanIds: string[] = [];
  const conductedAssignmentIds: string[] = [];
  for (const row of conductedScans ?? []) {
    conductedScanIds.push(row.id as string);
    if (row.assignment_id) conductedAssignmentIds.push(row.assignment_id as string);
    if (row.store_id) assignmentStoreIds.push(row.store_id as string);
  }

  if (!isOrgAdmin) {
    allowedStoreIds = uniqueStrings([...allowedStoreIds, ...assignmentStoreIds]).filter((id) =>
      orgStoreIds.includes(id),
    );
    const allowedSet = new Set(allowedStoreIds);
    conductedScanIds = conductedScanIds.filter((scanId) => {
      const scan = (conductedScans ?? []).find((s) => s.id === scanId);
      return scan?.store_id ? allowedSet.has(scan.store_id as string) : false;
    });
  }

  const allowedStoreSet = new Set(allowedStoreIds);
  const scopedStores = orgStores.filter((s) => allowedStoreSet.has(s.id));

  return {
    orgId,
    userId,
    role,
    allowedStoreIds,
    allowedCities: uniqueStrings(scopedStores.map((s) => s.city ?? "")),
    allowedCountries: uniqueStrings(scopedStores.map((s) => s.country ?? "")),
    isOrgAdmin,
    isManager,
    accessibleAssignmentIds,
    accessibleScanIds: uniqueStrings([...accessibleScanIds, ...conductedScanIds]),
    assignedToUserAssignmentIds,
    conductedScanIds: uniqueStrings(conductedScanIds),
    conductedAssignmentIds: uniqueStrings(conductedAssignmentIds),
  };
}

/** Intersect dashboard filters with authorized store scope — NL cannot expand. */
export function clampFiltersToScope(
  filters: DashboardFilterState,
  scope: AskAislixAccessScope,
): DashboardFilterState {
  const allowed = new Set(scope.allowedStoreIds);
  if (allowed.size === 0) return { ...filters, storeId: "__none__" };

  let storeId = filters.storeId;
  if (storeId && storeId !== "all" && !allowed.has(storeId)) {
    storeId = "__none__";
  }

  let city = filters.city;
  if (city && city !== "all") {
    const cityAllowed = scope.allowedCities.some((c) => normalizeCity(c) === normalizeCity(city!));
    if (!cityAllowed) city = "__none__";
  }

  let country = filters.country;
  if (country && country !== "all") {
    const countryAllowed = scope.allowedCountries.some(
      (c) => normalizeCity(c) === normalizeCity(country!),
    );
    if (!countryAllowed) country = "__none__";
  }

  return { ...filters, storeId, city, country };
}

export function storeIdsForQuery(scope: AskAislixAccessScope, filters: DashboardFilterState): string[] {
  const allowed = new Set(scope.allowedStoreIds);
  if (allowed.size === 0) return [];

  if (filters.storeId && filters.storeId !== "all" && filters.storeId !== "__none__") {
    return allowed.has(filters.storeId) ? [filters.storeId] : [];
  }

  let ids = [...allowed];
  if (filters.city && filters.city !== "all" && filters.city !== "__none__") {
    const target = normalizeCity(filters.city);
    ids = ids.filter((id) => {
      // city match applied when resolving stores in dataset fetch
      return true;
    });
    void target;
  }

  return ids;
}

export function assertStoreAccess(scope: AskAislixAccessScope, storeId: string): boolean {
  return scope.allowedStoreIds.includes(storeId);
}

export function resolveStoreQuery(
  scope: AskAislixAccessScope,
  stores: StoreRow[],
  query: string,
): StoreRow | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  const candidates = stores.filter((s) => scope.allowedStoreIds.includes(s.id));
  const exact = candidates.find(
    (s) =>
      s.name.toLowerCase() === normalized ||
      `${s.name} ${s.city ?? ""}`.trim().toLowerCase() === normalized,
  );
  if (exact) return exact;

  return (
    candidates.find((s) => {
      const blob = `${s.name} ${s.city ?? ""} ${s.country ?? ""}`.toLowerCase();
      return blob.includes(normalized) || normalized.includes(s.name.toLowerCase());
    }) ?? null
  );
}

export function filterRowsByStore<T extends { store_id?: string | null }>(
  rows: T[],
  storeIds: string[],
): T[] {
  if (!storeIds.length) return [];
  const allow = new Set(storeIds);
  return rows.filter((r) => r.store_id && allow.has(r.store_id));
}

export function filterByAccessibleAssignments<T extends { id?: string; assignment_id?: string | null }>(
  rows: T[],
  scope: AskAislixAccessScope,
): T[] {
  if (scope.isOrgAdmin) return rows;
  const allow = new Set(scope.accessibleAssignmentIds);
  return rows.filter((r) => {
    const aid = r.assignment_id ?? r.id;
    return aid ? allow.has(aid) : false;
  });
}
