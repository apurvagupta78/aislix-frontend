import { getRequest } from "@tanstack/react-start/server";

/**
 * Authorization for calls to the Aislix backend: forwards the signed-in user's
 * Supabase access token from the current request. The backend verifies it and
 * checks organization membership, so calls made outside a signed-in request
 * (public share pages) carry no credentials and are refused by protected routes.
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
  return { authorization: `Bearer ${token}` };
}
