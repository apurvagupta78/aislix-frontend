/**
 * Live backend context helpers.
 *
 * Every domain module resolves the signed-in user and their active organization
 * through this file, so RLS-scoped queries never have to guess an org id.
 */

import { supabase } from "@/integrations/supabase/client";
import { ApiError } from "@/lib/api/errors";

export type MemberRole = "owner" | "admin" | "store_manager" | "viewer";

export function dbError(error: { message: string; code?: string } | null, fallback: string): never {
  throw new ApiError({
    message: error?.message || fallback,
    kind: "server",
    status: 500,
    body: error,
  });
}

export function unauthorized(message = "You need to sign in to continue."): never {
  throw new ApiError({ message, kind: "unauthorized", status: 401 });
}

export function notFound(message = "Not found."): never {
  throw new ApiError({ message, kind: "not_found", status: 404 });
}

/** Current auth user, or null when signed out. */
export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** Current auth user id, throwing a 401-shaped error when signed out. */
export async function requireUserId(): Promise<string> {
  const user = await getUser();
  if (!user) unauthorized();
  return user.id;
}

export type Membership = {
  id: string;
  org_id: string;
  user_id: string;
  role: MemberRole;
  status: "active" | "invited" | "suspended";
  org_name?: string;
  /** Disambiguation hint when several workspaces share a name. */
  org_hint?: string;
  /** Open scan assignments for this user in that workspace. */
  pending_count?: number;
};

const ACTIVE_ORG_KEY = "aislix.activeOrg";
const ACTIVE_ORG_EXPLICIT_KEY = "aislix.activeOrg.explicit";

let membershipsCache: { userId: string; rows: Membership[] } | null = null;
let membershipCache: { userId: string; membership: Membership } | null = null;

function readStoredOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_ORG_KEY);
}

function writeStoredOrgId(orgId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_ORG_KEY, orgId);
}

function wasChosenByUser(orgId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ACTIVE_ORG_EXPLICIT_KEY) === orgId;
}

/** Open assignments for the signed-in user, grouped by workspace. */
export async function pendingAssignmentCountsByOrg(): Promise<Map<string, number>> {
  const userId = await requireUserId();
  const { data } = await supabase
    .from("scan_assignments")
    .select("org_id")
    .eq("assignee_id", userId)
    .in("status", ["pending", "in_progress"]);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const orgId = (row as { org_id: string }).org_id;
    counts.set(orgId, (counts.get(orgId) ?? 0) + 1);
  }
  return counts;
}

/** Every active membership of the signed-in user, oldest first. */
export async function listMemberships(): Promise<Membership[]> {
  const userId = await requireUserId();
  if (membershipsCache?.userId === userId) return membershipsCache.rows;

  const { data, error } = await supabase
    .from("organization_members")
    .select("id, org_id, user_id, role, status, organizations:org_id (name)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) dbError(error, "Could not load your workspaces.");

  let rows = (data ?? []).map((row) => ({
    ...(row as unknown as Membership),
    org_name:
      (row as { organizations?: { name?: string | null } | null }).organizations?.name ??
      "Workspace",
  })) as Membership[];

  if (rows.length > 1) {
    const orgIds = rows.map((row) => row.org_id);
    const [{ data: stores }, counts] = await Promise.all([
      supabase.from("stores").select("org_id, name").in("org_id", orgIds),
      pendingAssignmentCountsByOrg().catch(() => new Map<string, number>()),
    ]);
    const storeName = new Map<string, string>();
    for (const store of (stores ?? []) as Array<{ org_id: string; name: string }>) {
      if (!storeName.has(store.org_id)) storeName.set(store.org_id, store.name);
    }
    const nameCounts = new Map<string, number>();
    for (const row of rows) {
      nameCounts.set(row.org_name!, (nameCounts.get(row.org_name!) ?? 0) + 1);
    }
    rows = rows.map((row) => ({
      ...row,
      pending_count: counts.get(row.org_id) ?? 0,
      // Duplicate workspace names are common in testing — always show a hint.
      org_hint:
        storeName.get(row.org_id) ??
        ((nameCounts.get(row.org_name!) ?? 0) > 1 ? `#${row.org_id.slice(0, 8)}` : undefined),
    }));
  }

  membershipsCache = { userId, rows };
  return rows;
}

/** Workspace the user has the most recent scan assignment in, if any. */
async function orgWithLatestAssignment(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("scan_assignments")
    .select("org_id, created_at")
    .eq("assignee_id", userId)
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}

/** Switch the active workspace for every org-scoped query. */
export function setActiveOrgId(orgId: string, explicit = true): void {
  writeStoredOrgId(orgId);
  if (explicit && typeof window !== "undefined") {
    window.localStorage.setItem(ACTIVE_ORG_EXPLICIT_KEY, orgId);
  }
  membershipCache = null;
}

/**
 * Links and activates any pending invite for the signed-in account. Runs on the
 * server because members are not allowed to update membership rows themselves.
 */
async function activatePendingInvites(): Promise<boolean> {
  try {
    const { activateMyMemberships } = await import("@/lib/membership.functions");
    const result = await activateMyMemberships({ data: {} } as never);
    if (!result?.activated) return false;
    clearContextCache();
    return true;
  } catch {
    return false;
  }
}

/** Membership row of the signed-in user for their active organization. */
export async function getMembership(): Promise<Membership | null> {
  const userId = await requireUserId();
  if (membershipCache?.userId === userId) return membershipCache.membership;

  let rows = await listMemberships();
  if (!rows.length) {
    // Invited members have no active membership until the invite is linked;
    // never fail with "no workspace" before trying that.
    if (!(await activatePendingInvites())) return null;
    rows = await listMemberships();
    if (!rows.length) return null;
  }

  const stored = readStoredOrgId();
  let membership = stored ? rows.find((row) => row.org_id === stored) : undefined;

  if (rows.length > 1 && (!membership || !wasChosenByUser(membership.org_id))) {
    // Auto-land in the workspace that actually has work waiting, unless the
    // user explicitly picked one from the switcher.
    const preferred = await orgWithLatestAssignment(userId);
    membership = rows.find((row) => row.org_id === preferred) ?? membership;
  }
  membership = membership ?? rows[0]!;

  writeStoredOrgId(membership.org_id);
  membershipCache = { userId, membership };
  return membership;
}



export function clearContextCache(): void {
  membershipCache = null;
  membershipsCache = null;
}


/** Active organization id, throwing when the user has no workspace yet. */
export async function requireOrgId(): Promise<string> {
  const membership = await getMembership();
  if (!membership) {
    throw new ApiError({
      message: "No workspace found for your account yet.",
      kind: "not_found",
      status: 404,
    });
  }
  return membership.org_id;
}

export async function requireMembership(): Promise<Membership> {
  const membership = await getMembership();
  if (!membership) {
    throw new ApiError({
      message: "No workspace found for your account yet.",
      kind: "not_found",
      status: 404,
    });
  }
  return membership;
}

/**
 * Creates the organization for a brand-new account. The database trigger adds
 * the creator as owner and this seeds the Free subscription.
 */
export async function createOrganizationForUser(
  userId: string,
  name: string,
): Promise<string> {
  const slugBase = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const slug = `${slugBase || "workspace"}-${Math.random().toString(36).slice(2, 7)}`;

  const { data, error } = await supabase
    .from("organizations")
    .insert({ name, slug, owner_id: userId })
    .select("id")
    .single();
  if (error) dbError(error, "Could not create your workspace.");

  clearContextCache();
  const orgId = data!.id as string;

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("code", "free")
    .maybeSingle();
  if (plan?.id) {
    await supabase.from("subscriptions").insert({ org_id: orgId, plan_id: plan.id });
  }
  return orgId;
}

/**
 * Returns the user's existing active organization id, creating one when the
 * account has no membership yet.
 */
export async function ensureOrganizationForUser(
  userId: string,
  name: string,
): Promise<string> {
  // An invited member already belongs to a workspace — activate it on first
  // sign-in instead of creating a second organization for them.
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, org_id, status")
    .eq("user_id", userId)
    .in("status", ["active", "invited"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) dbError(error, "Could not load your workspace.");
  if (data?.org_id) {
    if (data.status === "invited") {
      await supabase.from("organization_members").update({ status: "active" }).eq("id", data.id);
      clearContextCache();
    }
    return data.org_id as string;
  }

  return createOrganizationForUser(userId, name);
}
