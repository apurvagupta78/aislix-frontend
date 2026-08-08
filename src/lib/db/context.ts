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
};

let membershipCache: { userId: string; membership: Membership } | null = null;

/** Membership row of the signed-in user for their active organization. */
export async function getMembership(): Promise<Membership | null> {
  const userId = await requireUserId();
  if (membershipCache?.userId === userId) return membershipCache.membership;

  const { data, error } = await supabase
    .from("organization_members")
    .select("id, org_id, user_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) dbError(error, "Could not load your workspace.");
  if (!data) return null;

  const membership = data as Membership;
  membershipCache = { userId, membership };
  return membership;
}

export function clearContextCache(): void {
  membershipCache = null;
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
  const { data, error } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) dbError(error, "Could not load your workspace.");
  if (data?.org_id) return data.org_id as string;

  return createOrganizationForUser(userId, name);
}
