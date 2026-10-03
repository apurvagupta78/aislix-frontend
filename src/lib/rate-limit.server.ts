/**
 * Shared fixed-window rate limits backed by Postgres (`consume_rate_limit`), so
 * limits hold across edge isolates and redeploys. Fails open when the database
 * is unreachable; the backend keeps its own ceilings as a second layer.
 */

export async function consumeRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("consume_rate_limit" as never, {
      p_bucket: bucket.slice(0, 200),
      p_limit: limit,
      p_window_seconds: windowSeconds,
    } as never);
    if (error) {
      console.error("Rate limit check failed:", error.message);
      return true;
    }
    return data !== false;
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return true;
  }
}

export function requestClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function hashForBucket(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** True when every limit allows the request. Each limit is [bucket, max, windowSeconds]. */
export async function withinRateLimits(
  limits: Array<[string, number, number]>,
): Promise<boolean> {
  for (const [bucket, max, windowSeconds] of limits) {
    if (!(await consumeRateLimit(bucket, max, windowSeconds))) return false;
  }
  return true;
}

export function tooManyRequests(message = "Too many requests. Please try again later."): Response {
  return Response.json({ detail: message }, { status: 429, headers: { "Retry-After": "3600" } });
}
