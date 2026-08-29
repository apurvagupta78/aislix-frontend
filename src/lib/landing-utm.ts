/**
 * Landing-page URL helpers: preserve UTM params + landing_session_id when
 * sending a visitor to /signup. Isolated to the conversion landing pages.
 */
import { captureUtmParams, persistUtmSession, readStoredUtm } from "@/lib/utm";

const SESSION_ID_KEY = "aislix_landing_session_id";

/** Persist utm_* from the current URL so later navigations keep attribution. */
export function persistLandingUtm(): void {
  persistUtmSession();
}

/** /signup URL carrying UTMs (current + stored) and the landing session id. */
export function signupUrl(extra?: Record<string, string>): string {
  if (typeof window === "undefined") return "/signup";
  const params = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries({ ...readStoredUtm(), ...captureUtmParams() })) {
    params.set(k, v);
  }
  try {
    const sid = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (sid) params.set("landing_session_id", sid);
  } catch {
    /* storage unavailable — non-fatal */
  }
  if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
  const qs = params.toString();
  return qs ? `/signup?${qs}` : "/signup";
}

/** Smooth-scroll to an in-page section id. */
export function scrollToSection(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
