/**
 * Google Analytics 4 (gtag.js).
 *
 * Only runs on the production hosts (aislix.com / www.aislix.com) so local
 * development and Lovable preview traffic never pollutes the property.
 */

const ALLOWED_HOSTS = new Set(["aislix.com", "www.aislix.com"]);
const DEFAULT_MEASUREMENT_ID = "G-G6Q8XMGP61";

type GtagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

function measurementId(): string {
  const fromEnv = (import.meta.env['VITE_GA_MEASUREMENT_ID'] as string | undefined)?.trim();
  return fromEnv || DEFAULT_MEASUREMENT_ID;
}

/** True when GA should run in the current browser context. */
export function analyticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (!measurementId()) return false;
  return ALLOWED_HOSTS.has(window.location.hostname);
}

let initialized = false;
let lastTrackedPath = "";

/** Loads gtag.js once at app boot. Safe to call repeatedly. */
export function initAnalytics(): void {
  if (initialized || !analyticsEnabled()) return;
  initialized = true;

  const id = measurementId();
  const w = window as GtagWindow;

  // The base tag is injected in the document head (see __root.tsx). Only load
  // it here if that inline snippet did not run for some reason.
  if (!w.gtag) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.appendChild(script);

    w.dataLayer = w.dataLayer || [];
    w.gtag = function gtag(...args: unknown[]) {
      w.dataLayer!.push(args);
    };
    w.gtag("js", new Date());
    w.gtag("config", id, { send_page_view: true });
  }

  lastTrackedPath = window.location.pathname + window.location.search;
}


/** Reports a SPA page view. Dedupes consecutive identical paths. */
export function trackPageView(path: string): void {
  if (!analyticsEnabled()) return;
  if (path === lastTrackedPath) return;
  lastTrackedPath = path;

  const w = window as GtagWindow;
  try {
    w.gtag?.("event", "page_view", {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    });
  } catch {
    /* analytics must never break the page */
  }
}

/** Standard event names used across the app. */
export const AnalyticsEvents = {
  LandingScanStarted: "landing_scan_started",
  LandingScanCompleted: "landing_scan_completed",
  SignupCtaClick: "signup_cta_click",
  PricingPlanClick: "pricing_plan_click",
} as const;

/** Reports a custom GA4 event. */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!analyticsEnabled()) return;
  const w = window as GtagWindow;
  try {
    w.gtag?.("event", name, params ?? {});
  } catch {
    /* analytics must never break the page */
  }
}
