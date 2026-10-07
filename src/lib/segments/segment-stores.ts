/**
 * Which stores a customer segment reads. Shared by the dashboard (browser) and report emails (server),
 * so it takes the Supabase client as an argument.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AuditRoleTab as SegmentId } from "@/lib/role-audit-ui";

/** Store types each segment reads. null = every store (a brand audits all retailers). */
const SEGMENT_STORE_TYPES: Record<SegmentId, string[] | null> = {
  supermarket: ["supermarket", "hypermarket", "modern_trade"],
  darkstore: ["dark_store", "darkstore", "quick_commerce"],
  fmcg: null,
  distributor: ["outlet", "warehouse", "distributor", "fmcg_distributor", "wholesale"],
  local: ["local_store", "kirana", "general_store"],
};

export function normalizeStoreType(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Narrow to the selected segment's stores when the workspace has any of that type.
 * A single-format workspace (or one without store types) keeps every store in scope.
 */
export function segmentStoreIds(
  segment: SegmentId | null | undefined,
  stores: { id: string; store_type: string | null }[],
  scopeIds: string[] | null,
): string[] | null {
  const types = segment ? SEGMENT_STORE_TYPES[segment] : null;
  if (!types) return scopeIds;
  const allowed = new Set(scopeIds ?? stores.map((s) => s.id));
  const matching = stores
    .filter((s) => allowed.has(s.id) && types.includes(normalizeStoreType(s.store_type)))
    .map((s) => s.id);
  return matching.length ? matching : scopeIds;
}

/** Store ids for the segment in this org, or the given scope unchanged when nothing narrows it. */
export async function narrowToSegment(
  client: SupabaseClient,
  dataOrgId: string,
  segment: SegmentId | null | undefined,
  scopeIds: string[] | null,
): Promise<string[] | null> {
  if (!segment || !SEGMENT_STORE_TYPES[segment]) return scopeIds;
  const { data: stores } = await client.from("stores").select("id, store_type").eq("org_id", dataOrgId);
  return segmentStoreIds(segment, (stores ?? []) as { id: string; store_type: string | null }[], scopeIds);
}
