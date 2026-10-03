import { getRequest } from "@tanstack/react-start/server";

/**
 * Authorization for calls to the Aislix backend: forwards the signed-in user's
 * Supabase access token from the current request, plus the project's publishable
 * key so the backend can verify the token and read scans under row-level security.
 * Calls made outside a signed-in request (public share pages) carry no
 * credentials and are refused by protected routes.
 */
export function backendAuthHeaders(): Record<string, string> {
  let header = "";
  try {
    header = getRequest()?.headers.get("authorization") ?? "";
  } catch {
    return {};
  }
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token || token === header || token.split(".").length !== 3) return {};
  const apiKey = (process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "").trim();
  return {
    authorization: `Bearer ${token}`,
    ...(apiKey ? { "x-supabase-apikey": apiKey } : {}),
  };
}
