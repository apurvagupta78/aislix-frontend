/**
 * Centralized API configuration.
 *
 * Every backend request in the app resolves its base URL, timeout and headers
 * from here — no module reads `import.meta.env` directly.
 *
 * Environments are selected with `VITE_APP_ENV` (`development` | `staging` |
 * `production`); the base URL comes from the matching variable so the same
 * build config works for Railway FastAPI in every environment:
 *
 *   VITE_API_BASE_URL          — used by all environments unless overridden
 *   VITE_API_BASE_URL_STAGING  — optional staging override
 *   VITE_API_BASE_URL_PROD     — optional production override
 *   VITE_SCAN_API_BASE         — legacy name, still honoured
 */

export type AppEnvironment = "development" | "staging" | "production";

function env(key: string): string {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function resolveEnvironment(): AppEnvironment {
  const explicit = env("VITE_APP_ENV").toLowerCase();
  if (explicit === "staging" || explicit === "production" || explicit === "development") {
    return explicit;
  }
  return import.meta.env.PROD ? "production" : "development";
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function resolveBaseUrl(environment: AppEnvironment): string {
  const candidates =
    environment === "production"
      ? ["VITE_API_BASE_URL_PROD", "VITE_API_BASE_URL", "VITE_SCAN_API_BASE"]
      : environment === "staging"
        ? ["VITE_API_BASE_URL_STAGING", "VITE_API_BASE_URL", "VITE_SCAN_API_BASE"]
        : ["VITE_API_BASE_URL_DEV", "VITE_API_BASE_URL", "VITE_SCAN_API_BASE"];
  for (const key of candidates) {
    const value = env(key);
    if (value) return stripTrailingSlash(value);
  }
  return "";
}

export type ApiConfig = {
  environment: AppEnvironment;
  /** Absolute base URL of the Aislix API, or "" when not connected yet. */
  baseUrl: string;
  /** True once a base URL is configured. */
  configured: boolean;
  /** Default request timeout in milliseconds. */
  timeoutMs: number;
  /** Default timeout for multipart uploads and AI processing calls. */
  uploadTimeoutMs: number;
  /** Whether to log request failures to the console. */
  debug: boolean;
};

const environment = resolveEnvironment();
const baseUrl = resolveBaseUrl(environment);

export const apiConfig: ApiConfig = {
  environment,
  baseUrl,
  configured: baseUrl.length > 0,
  timeoutMs: Number(env("VITE_API_TIMEOUT_MS")) || 20_000,
  uploadTimeoutMs: Number(env("VITE_API_UPLOAD_TIMEOUT_MS")) || 120_000,
  debug: environment !== "production",
};

/** Absolute URL for an API path (`/scans` → `https://api…/scans`). */
export function apiUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${apiConfig.baseUrl}${suffix}`;
}

/** Serializes query params, skipping empty values and the "all" sentinel. */
export function buildQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === "all") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
