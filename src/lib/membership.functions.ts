/** Server function wrappers for membership activation. */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Links every pending invite for the signed-in account (matched by user id or
 * invited email) and marks the memberships active.
 */
export const activateMyMemberships = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { activateMembershipsForUser } = await import("@/lib/membership.server");
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    return activateMembershipsForUser(context.userId, email);
  });
