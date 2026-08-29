const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const STORAGE_KEY = "aislix_utm";

export function captureUtmParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const v = params.get(key);
    if (v) out[key] = v;
  }
  return out;
}

export function readStoredUtm(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function persistUtmSession(): void {
  if (typeof window === "undefined") return;
  const utm = captureUtmParams();
  if (Object.keys(utm).length === 0) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(utm));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/** Builds a same-origin path with the campaign's UTM params preserved. */
export function signupWithUtm(path = "/signup"): string {
  if (typeof window === "undefined") return path;
  const utm = { ...readStoredUtm(), ...captureUtmParams() };
  const url = new URL(path, window.location.origin);
  for (const [k, v] of Object.entries(utm)) url.searchParams.set(k, v);
  return url.pathname + url.search;
}
