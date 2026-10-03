import {
  hashForBucket,
  requestClientIp,
  tooManyRequests,
  withinRateLimits,
} from "@/lib/rate-limit.server";

const MAX_PLANOGRAM_BODY_BYTES = 2 * 1024 * 1024;

/**
 * Same-origin proxy to a Railway planogram endpoint. The browser cannot call
 * Railway from every Aislix origin, so this forwards the body plus the visitor
 * IP (the backend limits per IP) and relays the backend's real error message.
 */
export async function proxyPlanogramRequest(request: Request, path: string): Promise<Response> {
  const backendUrl = process.env["AISLIX_AI_API_URL"];
  if (!backendUrl) {
    return Response.json(
      { detail: "Planogram API URL is not configured. Contact support." },
      { status: 503 },
    );
  }

  const tooLarge = Response.json(
    { detail: "Planogram file is too large. Keep it under 2MB." },
    { status: 413 },
  );
  if (Number(request.headers.get("content-length") ?? 0) > MAX_PLANOGRAM_BODY_BYTES) return tooLarge;

  const clientIp = requestClientIp(request);
  const ipHash = await hashForBucket(clientIp);
  const allowed = await withinRateLimits([
    [`planogram:ip:${ipHash}`, 120, 3600],
    ["planogram:global", 3000, 3600],
  ]);
  if (!allowed) return tooManyRequests();

  const body = await request.text();
  if (body.length > MAX_PLANOGRAM_BODY_BYTES) return tooLarge;

  let response: Response;
  try {
    response = await fetch(`${backendUrl.replace(/\/+$/, "")}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(clientIp !== "unknown" ? { "x-forwarded-for": clientIp } : {}),
      },
      body,
    });
  } catch {
    return Response.json(
      { detail: "Could not reach the Aislix planogram service. Please try again." },
      { status: 502 },
    );
  }

  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" },
  });
}
