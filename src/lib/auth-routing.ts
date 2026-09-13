/**
 * Post-authentication routing — SINGLE source of truth.
 *
 * Decision order once a session exists:
 *   1. email not confirmed  -> /verify-email  (blocks the rest of the app)
 *   2. first-time setup due -> /onboarding
 *   3. otherwise            -> /dashboard (managers) or /my-audits (members)
 *
 * Only `AuthGate` (and the pages that explicitly sign a user in) may call
 * `resolvePostAuthRoute`. No other file should navigate on auth state.
 */

import { supabase } from "@/integrations/supabase/client";

export type AuthRoute = { to: string; search?: Record<string, string> };

export type MinimalUser = { email?: string | null; email_confirmed_at?: string | null } | null;

/** Local check — never trust a session alone, prefer the server check below. */
export function isEmailVerifiedFromUser(user: MinimalUser): boolean {
  if (!user?.email) return false;
  return Boolean(user.email_confirmed_at);
}

/** Back-compat alias. */
export const isEmailVerified = isEmailVerifiedFromUser;

/** Reads the live user from Supabase (revalidates with the auth server). */
export async function fetchAuthUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** Server-side truth: reads auth.users through a security-definer RPC. */
export async function isEmailVerifiedServer(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_user_email_verified" as never, {} as never);
  if (error) {
    const user = await fetchAuthUser();
    return isEmailVerifiedFromUser(user);
  }
  return data === true;
}

export type PendingInvite = { org_id: string; role: string; org_name: string };

/**
 * Pending organization invite for the signed-in user. Team invites create the
 * auth user up-front, so the row is keyed on user_id with status "invited".
 */
export async function fetchPendingInvite(): Promise<PendingInvite | null> {
  const user = await fetchAuthUser();
  if (!user) return null;
  const { data } = await supabase
    .from("organization_members")
    .select("org_id, role, organizations:org_id(name)")
    .eq("user_id", user.id)
    .eq("status", "invited")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const orgName =
    (data as never as { organizations?: { name?: string } }).organizations?.name || "your team";
  return { org_id: data.org_id as string, role: String(data.role), org_name: orgName };
}

/** Landing route for a verified, onboarded user. */
export async function resolvePostLoginRoute(): Promise<AuthRoute> {
  try {
    const { fetchMyPendingCount, isOrgManager } = await import("@/lib/assignments");
    const [manager, pending] = await Promise.all([isOrgManager(), fetchMyPendingCount()]);
    if (!manager) {
      return pending > 0 ? { to: "/my-scans", search: { tab: "assigned" } } : { to: "/my-scans" };
    }
  } catch {
    // fall through to the dashboard
  }
  return { to: "/dashboard" };
}

/**
 * Full decision: verification -> pending invite -> onboarding -> landing.
 *
 * An invited member never sees the owner setup wizard: once their email is
 * confirmed the invite is accepted automatically and they land on /my-audits.
 */
export async function resolvePostAuthRoute(_user?: MinimalUser): Promise<AuthRoute> {
  if (!(await isEmailVerifiedServer())) {
    const pending = await fetchPendingInvite().catch(() => null);
    return pending
      ? { to: "/verify-email", search: { invited: "true", org: pending.org_id } }
      : { to: "/verify-email" };
  }

  const user = await fetchAuthUser();
  if (!user) return { to: "/login" };

  // Activation is attempted for every verified sign-in: an invite created
  // before the account existed is keyed on the email, not the user id, so
  // fetchPendingInvite() alone cannot see it.
  let activated = 0;
  try {
    const { acceptInvite } = await import("@/lib/team-invite.functions");
    const result = await acceptInvite({ data: {} } as never);
    activated = result?.accepted ?? 0;
    if (activated > 0) {
      const { clearContextCache } = await import("@/lib/db/context");
      clearContextCache();
      await supabase.rpc("complete_onboarding" as never, {} as never);
    }
  } catch {
    // membership activation is retried on the next authenticated read
  }
  if (activated > 0) return { to: "/my-scans" };


  const { data: profile, error } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !profile?.onboarding_completed_at) return { to: "/onboarding" };

  return resolvePostLoginRoute();
}


const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/admin/login",
  "/signup",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/pricing",
  "/about",
  "/contact",
  "/features",
  "/how-it-works",
  "/platform",
  "/compare",
  "/demo",
  "/retail-intelligence",
  "/retail-shelf-intelligence",
  "/security",

  "/terms",
  "/privacy",
  "/cookies",
  "/refunds",
  "/logout",
  "/auth/callback",
  "/accept-invite",
]);


export function isPublicPath(path: string): boolean {
  return (
    PUBLIC_PATHS.has(path) ||
    path.startsWith("/legal") ||
    path.startsWith("/api") ||
    path.startsWith("/share/")
  );
}

export function isAdminPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

export function isAdminLoginPath(path: string): boolean {
  return path === "/admin/login";
}

export function isVerifyPath(path: string): boolean {
  return path === "/verify-email";
}

/** Navigates to a resolved route with the loose typing these helpers return. */
export function goToAuthRoute(
  navigate: (opts: { to: string; search?: Record<string, string>; replace?: boolean }) => unknown,
  route: AuthRoute,
): void {
  navigate({ to: route.to, ...(route.search ? { search: route.search } : {}), replace: true });
}
