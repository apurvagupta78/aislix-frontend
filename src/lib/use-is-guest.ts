import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearGuestMode, hasGuestFlag, markGuestMode } from "@/lib/guest-mode";

/**
 * True when there is no auth session (anonymous guest browsing AppShell).
 * Marks guest flag so homepage-origin and direct /dashboard visits share state.
 */
export function useIsGuest(): boolean {
  const [guest, setGuest] = useState(() => hasGuestFlag());

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        clearGuestMode();
        setGuest(false);
        return;
      }
      markGuestMode();
      setGuest(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        clearGuestMode();
        setGuest(false);
      } else {
        markGuestMode();
        setGuest(true);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return guest;
}
