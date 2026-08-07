/**
 * Shared configuration for the future FastAPI backend.
 *
 * Until `VITE_SCAN_API_BASE` is set, every data module must fail fast with a
 * clear message instead of fetching a relative path — a relative fetch would
 * hit this app's own routes and return HTML, producing opaque 500s.
 */
export const API_BASE = import.meta.env['VITE_SCAN_API_BASE'] ?? "";

export const apiConfigured = API_BASE.length > 0;

export class ApiNotConfiguredError extends Error {
  constructor() {
    super(
      "Backend not connected yet. Set VITE_SCAN_API_BASE to your Aislix API URL to load live data.",
    );
    this.name = "ApiNotConfiguredError";
  }
}

export function assertApiConfigured(): void {
  if (!apiConfigured) throw new ApiNotConfiguredError();
}
