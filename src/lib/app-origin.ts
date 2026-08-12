/**
 * Canonical production origin helpers.
 *
 * Never hardcode preview or lovable.app hosts in user-facing links: derive the
 * origin from VITE_APP_URL, then the live browser origin, then aislix.com.
 */

const PRODUCTION_ORIGIN = "https://aislix.com";

const stripTrailingSlash = (value: string) => value.replace(/\/$/, "");

/** Origin for links built in browser/isomorphic code. */
export const APP_ORIGIN =
  stripTrailingSlash(import.meta.env['VITE_APP_URL'] ?? "") ||
  (typeof window !== "undefined" ? window.location.origin : PRODUCTION_ORIGIN);

/**
 * Origin for links built inside server handlers (emails, redirects).
 * Reads env at call time so Worker env injection is respected.
 */
export function serverAppOrigin(): string {
  const fromEnv =
    (typeof process !== "undefined" &&
      (process.env['APP_URL'] || process.env['VITE_APP_URL'])) ||
    "";
  return stripTrailingSlash(fromEnv) || PRODUCTION_ORIGIN;
}

export { PRODUCTION_ORIGIN };
