import { readStoredUtm, captureUtmParams } from "@/lib/utm";

export type LandingEvent =
  | "landing_page_view"
  | "demo_started"
  | "demo_completed"
  | "cta_click"
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

  const w = window as AnalyticsWindow;
  try {
    if (typeof w.gtag === "function") w.gtag("event", event, payload);
    else if (w.posthog?.capture) w.posthog.capture(event, payload);
  } catch {
    /* analytics must never break the page */
  }

  if (import.meta.env.DEV) console.debug("[landing]", event, payload);
}
