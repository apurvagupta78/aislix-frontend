/**
 * AuthGate — the ONE redirect system for auth state.
 *
 * Runs on every navigation and every auth event:
 *  - signed out on a protected path -> /login
 *  - signed in but unverified       -> /verify-email (nothing else is reachable)
 *  - verified on /verify-email or an auth page -> resolved landing route
 *
 * No other component may redirect based on session / verification / onboarding.
 */

import { useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchAuthUser,
  fetchPendingInvite,
  goToAuthRoute,
  isEmailVerifiedServer,
  isAdminLoginPath,
  isAdminPath,
  isAppShellGuestPath,
  isPublicPath,
  isVerifyPath,
  resolvePostAuthRoute,
} from "@/lib/auth-routing";
import { markGuestMode } from "@/lib/guest-mode";

/** Auth entry pages where a verified session must leave for the landing route. */
function isAuthEntryPath(path: string): boolean {
  return (
    isVerifyPath(path) ||
    path === "/login" ||
    path === "/signup" ||
    path === "/register" ||
    path === "/forgot-password" ||
    path === "/admin/login"
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const busy = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const enforce = async () => {
      const path = pathname;

      // ONBOARDING LOCK: this is deliberately the first routing check. Once
      // the wizard is open, no global auth event or route check may navigate.
      if (path === "/onboarding" || path.startsWith("/onboarding/")) return;

      // Invite acceptance is mid-flow: never bounce it, verified or not.
      if (path.startsWith("/accept-invite")) return;

      if (busy.current) return;
      busy.current = true;
      try {

        // Public marketing pages do not need a network round-trip for anonymous
        // visitors. getSession() reads local storage; getUser() always hits Auth.
        // Auth entry pages always continue — OAuth may land with a hash session
        // that getSession() has not parsed yet on the first tick.
        if (isPublicPath(path) && !isVerifyPath(path) && !isAuthEntryPath(path)) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session) return;
        }

        // Guest mode: AppShell destinations stay mounted without a session.
        if (isAppShellGuestPath(path)) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session) {
            markGuestMode();
            return;
          }
        }

        const user = await fetchAuthUser();
        if (cancelled) return;

        if (!user) {
          // Signup leaves no session while confirmation is pending — the
          // verify page must stay open, so it is never bounced to /login.
          if (!isPublicPath(path) && !isVerifyPath(path) && !isAppShellGuestPath(path)) {
            void navigate({
              to: isAdminPath(path) && !isAdminLoginPath(path) ? "/admin/login" : "/login",
              replace: true,
            });
          }
          return;
        }

        // Fast path: JWT already has email_confirmed_at — do not wait on RPC.
        const verified =
          Boolean(user.email_confirmed_at) || (await isEmailVerifiedServer());
        if (cancelled) return;

        if (!verified) {
          if (isVerifyPath(path) || path === "/auth/callback" || path === "/logout") return;
          // Invited members get the tailored "join the team" verify screen.
          const pending = await fetchPendingInvite().catch(() => null);
          if (cancelled) return;
          void navigate(
            pending
              ? ({ to: "/verify-email", search: { invited: true, org: pending.org_id }, replace: true } as never)
              : { to: "/verify-email", replace: true },
          );
          return;
        }

        // Verified session on an auth entry page (incl. OAuth return to /login
        // or a stale /verify-email) must continue to the workspace landing.
        if (isAuthEntryPath(path) || path === "/auth/callback") {
          goToAuthRoute(navigate as never, await resolvePostAuthRoute());
        }

      } finally {
        busy.current = false;
      }
    };

    void enforce();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      // TOKEN_REFRESHED is noisy; INITIAL_SESSION must run so OAuth hash
      // recovery on /login can leave the auth entry page.
      if (event === "TOKEN_REFRESHED") return;
      void enforce();
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [pathname, navigate]);

  return <>{children}</>;
}
