/**
 * Google Analytics 4 (gtag.js).
 *
 * Only runs on the production hosts (aislix.com / www.aislix.com) so local
 * development and Lovable preview traffic never pollutes the property.
 */

const ALLOWED_HOSTS = new Set(["aislix.com", "www.aislix.com"]);

type GtagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

function measurementId(): string {
  return (import.meta.env['VITE_GA_MEASUREMENT_ID'] as string | undefined)?.trim() ?? "";
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

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  script.onload = () => {
    // Backup page_view once the gtag script has actually loaded.
    w.gtag?.("event", "page_view", {
      page_path: location.pathname + location.search,
      page_location: location.href,
      page_title: document.title,
    });
  };
  document.head.appendChild(script);

  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag(...args: unknown[]) {
    w.dataLayer!.push(args);
  };
  w.gtag("js", new Date());
  // SPA: manual page_view tracking via trackPageView on every route change.
  w.gtag("config", id, { send_page_view: false });

  trackPageView(window.location.pathname + window.location.search);
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
