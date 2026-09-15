import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId } from "@/lib/db/context";
import type { OperatingModel } from "@/lib/audit-builder/types";

import { getDefaultLevels } from "./presets";
import type {
  HierarchyNode,
  HierarchyNodeInput,
  HierarchyProfile,
  HierarchySearchParams,
} from "./types";

export * from "./types";
export * from "./presets";

function mapProfile(row: Record<string, unknown>): HierarchyProfile {
  return {
    id: row.id as string,
    org_id: row.org_id as string,
    operating_model: row.operating_model as OperatingModel,
    name: row.name as string,
    description: (row.description as string) ?? null,
    levels: (row.levels as HierarchyProfile["levels"]) ?? [],
    is_default: Boolean(row.is_default),
    is_system: Boolean(row.is_system),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapNode(row: Record<string, unknown>): HierarchyNode {
  return {
    id: row.id as string,
    org_id: row.org_id as string,
    profile_id: row.profile_id as string,
    level_key: row.level_key as string,
    parent_id: (row.parent_id as string) ?? null,
    name: row.name as string,
    code: (row.code as string) ?? null,
    external_id: (row.external_id as string) ?? null,
    external_type: (row.external_type as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    active: row.active !== false,
    address: (row.address as string) ?? null,
    city: (row.city as string) ?? null,
    state: (row.state as string) ?? null,
    country: (row.country as string) ?? null,
    postal_code: (row.postal_code as string) ?? null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function fetchHierarchyProfiles(
  operatingModel?: OperatingModel,
): Promise<HierarchyProfile[]> {
  const orgId = await requireOrgId();
  let query = supabase
    .from("hierarchy_profiles")
    .select("*")
    .eq("org_id", orgId)
    .order("operating_model")
    .order("name");

  if (operatingModel) {
    query = query.eq("operating_model", operatingModel);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01") return [];
    dbError(error, "Could not load hierarchy profiles.");
  }
  return (data ?? []).map((row) => mapProfile(row as Record<string, unknown>));
}

export async function fetchHierarchyProfile(id: string): Promise<HierarchyProfile | null> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("hierarchy_profiles")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01") return null;
    dbError(error, "Could not load hierarchy profile.");
  }
  return data ? mapProfile(data as Record<string, unknown>) : null;
}

export async function seedHierarchyProfiles(): Promise<{ profilesCreated: number }> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase.rpc("seed_hierarchy_profiles", { p_org_id: orgId });
  if (error) {
    if (error.code === "42883") {
      throw new Error("Hierarchy engine migration not applied yet.");
    }
    dbError(error, "Could not seed hierarchy profiles.");
  }
  const result = (data ?? {}) as { profilesCreated?: number };
  return { profilesCreated: result.profilesCreated ?? 0 };
}

export async function syncStoresToHierarchy(profileId: string): Promise<number> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase.rpc("sync_stores_to_hierarchy", {
    p_org_id: orgId,
    p_profile_id: profileId,
  });
  if (error) dbError(error, "Could not sync stores to hierarchy.");
  return Number(data) || 0;
}

export async function searchHierarchyNodes(
  params: HierarchySearchParams,
): Promise<HierarchyNode[]> {
  const { data, error } = await supabase.rpc("search_hierarchy_nodes", {
    p_profile_id: params.profileId,
    p_level_key: params.levelKey ?? null,
    p_parent_id: params.parentId ?? null,
    p_query: params.query ?? null,
    p_active_only: params.activeOnly ?? true,
    p_limit: params.limit ?? 100,
  });
  if (error) {
    if (error.code === "42883" || error.code === "42P01") return [];
    dbError(error, "Could not search hierarchy nodes.");
  }
  return (data ?? []).map((row) => mapNode(row as Record<string, unknown>));
}

export async function createHierarchyNode(input: HierarchyNodeInput): Promise<HierarchyNode> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("hierarchy_nodes")
    .insert({
      org_id: orgId,
      profile_id: input.profile_id,
      level_key: input.level_key,
      parent_id: input.parent_id ?? null,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      external_id: input.external_id ?? null,
      external_type: input.external_type ?? null,
      metadata: input.metadata ?? {},
      active: input.active ?? true,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      country: input.country ?? null,
      postal_code: input.postal_code ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    })
    .select("*")
    .single();
  if (error) dbError(error, "Could not create hierarchy node.");
  return mapNode(data as Record<string, unknown>);
}

export async function importHierarchyNodesFromCsv(
  profileId: string,
  rows: Record<string, string>[],
): Promise<number> {
  let created = 0;
  for (const row of rows) {
    const levelKey = row.level_key?.trim() || row.level?.trim();
    const name = row.name?.trim();
    if (!levelKey || !name) continue;
    await createHierarchyNode({
      profile_id: profileId,
      level_key: levelKey,
      name,
      code: row.code?.trim() || null,
      parent_id: row.parent_id?.trim() || null,
      city: row.city?.trim() || null,
      state: row.state?.trim() || null,
      country: row.country?.trim() || null,
      active: row.active?.toLowerCase() !== "false",
      metadata: row,
    });
    created += 1;
  }
  return created;
}

export function resolveProfileLevels(
  profile: HierarchyProfile | null,
  operatingModel: OperatingModel,
) {
  if (profile?.levels?.length) return profile.levels;
  return getDefaultLevels(operatingModel);
}
