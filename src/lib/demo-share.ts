/**
 * Public demo audit share links — unguessable session token, no login required.
 */

import { loadLandingSessionId } from "@/lib/landing-audit-api";

export function demoAuditShareUrl(sessionToken?: string | null): string | null {
  const token = sessionToken ?? loadLandingSessionId();
  if (!token || typeof window === "undefined") return null;
  return `${window.location.origin}/share/${token}`;
}
