const AISLIX_WORKSPACE_SIGNUP_CONVERSION_ID = 30345537;

type LinkedInWindow = Window & {
  lintrk?: (action: string, params: { conversion_id: number }) => void;
};

/**
 * Fires LinkedIn's event-specific workspace signup conversion.
 * Safe when the Insight Tag is delayed, unavailable, or blocked.
 */
export function trackWorkspaceSignupConversion(): void {
  if (typeof window === "undefined") return;

  try {
    const lintrk = (window as LinkedInWindow).lintrk;
    if (typeof lintrk !== "function") return;
    lintrk("track", { conversion_id: AISLIX_WORKSPACE_SIGNUP_CONVERSION_ID });
  } catch {
    // Analytics must never interrupt signup.
  }
}
