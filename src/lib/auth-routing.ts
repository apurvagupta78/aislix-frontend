/**
 * Post-authentication routing.
 *
 * Decision order once a session exists:
 *   1. email not confirmed  -> /verify-email  (blocks the rest of the app)
 *   2. first-time setup due -> /onboarding
 *   3. otherwise            -> /dashboard (managers) or /my-scans (members)
 */

import { supabase } from "@/integrations/supabase/client";

export type MinimalUser = { email?: string | null; email_confirmed_at?: string | null } | null;

/** True once Supabase has stamped the confirmation link click. */
export function isEmailVerified(user: MinimalUser): boolean {
  if (!user?.email) return false;
  return Boolean(user.email_confirmed_at);
}

/** Reads the live user from Supabase (revalidates with the auth server). */
export async function fetchAuthUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** Landing route for a verified, onboarded user. */
export async function resolvePostLoginRoute(): Promise<string> {
  try {
    const { fetchMyPendingCount, isOrgManager } = await import("@/lib/assignments");
    const [manager, pending] = await Promise.all([isOrgManager(), fetchMyPendingCount()]);
    if (!manager) return pending > 0 ? "/my-scans?tab=assigned" : "/my-scans";
  } catch {
    // fall through to the dashboard
  }
  return "/dashboard";
}

/** Full decision: verification -> onboarding -> normal landing. */
export async function resolvePostAuthRoute(user: MinimalUser): Promise<string> {
  if (!isEmailVerified(user)) return "/verify-email";

  try {
    const { fetchOnboardingStatus } = await import("@/lib/onboarding");
    const status = await fetchOnboardingStatus();
    if (!status.completed) return "/onboarding";
  } catch {
    // fall through to the normal landing logic
  }

  return resolvePostLoginRoute();
}
