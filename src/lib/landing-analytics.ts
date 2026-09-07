import { readStoredUtm, captureUtmParams } from "@/lib/utm";
import { trackEvent } from "@/lib/analytics";

export type LandingEvent =
  | "landing_page_view"
  | "demo_started"
  | "demo_completed"
  | "demo_click"
  | "demo_scan_started"
  | "demo_scan_completed"
  | "demo_scan_failed"
  | "landing_lead_captured"
  | "cta_click"
  | "hero_cta_click"
  | "feature_cta_click"
  | "final_cta_click"
  | "signup_started";


type Props = Record<string, string | number | boolean>;

type AnalyticsWindow = Window & {
  gtag?: (command: string, event: string, params?: Record<string, unknown>) => void;
  posthog?: { capture?: (event: string, props?: Record<string, unknown>) => void };
  lintrk?: (action: string, params?: Record<string, unknown>) => void;
};

/**
 * Thin wrapper over whatever analytics the site already loads.
 * Never injects new third-party scripts.
 */
export function trackLandingEvent(event: LandingEvent, props?: Props): void {
  if (typeof window === "undefined") return;
  const payload: Record<string, unknown> = {
    ...readStoredUtm(),
    ...captureUtmParams(),
    ...props,
    page: window.location.pathname,
  };

  // Google Analytics 4 (production hosts only).
  trackEvent(event, payload);

  const w = window as AnalyticsWindow;
  try {
    if (typeof w.gtag === "function") w.gtag("event", event, payload);
    else if (w.posthog?.capture) w.posthog.capture(event, payload);
  } catch {
    /* analytics must never break the page */
  }

  // LinkedIn Insight Tag conversion signal (tag itself is loaded globally).
  if (
    event === "landing_page_view" ||
    event === "demo_scan_completed" ||
    event === "landing_lead_captured"
  ) {
    try {
      w.lintrk?.("track", { conversion_id: event });
    } catch {
      /* never break the page */
    }
  }

  if (import.meta.env.DEV) console.debug("[landing]", event, payload);
}

