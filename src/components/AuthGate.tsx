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
  isEmailVerifiedServer,
  isAdminLoginPath,
  isAdminPath,
  isPublicPath,
  isVerifyPath,
} from "@/lib/auth-routing";

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
        if (isPublicPath(path) && !isVerifyPath(path)) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session) return;
        }

        const user = await fetchAuthUser();
        if (cancelled) return;

        if (!user) {
          // Signup leaves no session while confirmation is pending — the
          // verify page must stay open, so it is never bounced to /login.
          if (!isPublicPath(path) && !isVerifyPath(path)) {
            void navigate({
              to: isAdminPath(path) && !isAdminLoginPath(path) ? "/admin/login" : "/login",
              replace: true,
            });
          }
          return;
        }

        const verified = await isEmailVerifiedServer();
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



      } finally {
        busy.current = false;
      }
    };

    void enforce();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
      void enforce();
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [pathname, navigate]);

  return <>{children}</>;
}
