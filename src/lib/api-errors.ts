/**
 * Shared sanitizer for every user-facing error message.
 *
 * Backends may return infra detail (status codes, vendor names, tracebacks).
 * Nothing from this module ever leaks that: callers pass raw text in and get a
 * plain-English message out.
 */

export const GENERIC_SCAN =
  "We couldn't analyze this shelf image right now. Please try again in a few minutes.";
export const GENERIC_UNAVAILABLE =
  "Our analysis service is temporarily unavailable. Please try again later.";
export const GENERIC_TIMEOUT = "Analysis took too long. Please try again with a clearer photo.";
export const GENERIC_NETWORK = "Could not connect. Check your internet and try again.";
export const GENERIC_EXPORT =
  "We couldn't generate export files right now. Please try again later.";

const INTERNAL_MARKERS =
  /openai|make\.com|webhook|scenario|railway|rate.?limit|\b429\b|\b4\d{2}\b|\b5\d{2}\b|quota|credits?|billing|api[_-]?key|traceback|numpy|faiss|yolo|httpx|requests\.|connection(?:error| refused)?|internal server error|vision backend|https?:\/\//i;

const SAFE_PREFIXES = [
  "we couldn't analyze",
  "our analysis service",
  "analysis took too long",
  "no products detected",
  "select a category",
  "select a sub-category",
  "daily demo scan limit",
  "image too large",
  "empty file upload",
  "scan job not found",
  "landing scans are temporarily disabled",
  "could not connect",
  "something went wrong",
];

function normalize(msg: string): string {
  return msg.replace(/\s+/g, " ").trim();
}

function isSafePublicMessage(msg: string): boolean {
  const lower = normalize(msg).toLowerCase();
  return SAFE_PREFIXES.some((p) => lower.startsWith(p));
}

/** Turns raw backend text into a message that is safe to show a customer. */
export function sanitizeUserMessage(raw: string, fallback = GENERIC_SCAN): string {
  let msg = normalize(raw ?? "");

  msg = msg.replace(/^analysis failed[:\s-]*/i, "");
  msg = msg.replace(/^(?:the )?ai vision backend returned\s+\d{3}[:\s-]*/i, "");
  msg = msg.replace(/^vision backend returned\s+\d{3}[:\s-]*/i, "");
  msg = msg.replace(
    /^the ai vision backend did not finish analys(?:ing|e)[^.]*\.?\s*/i,
    "",
  );

  if (msg.startsWith("{") && msg.includes("detail")) {
    try {
      const parsed = JSON.parse(msg) as { detail?: unknown };
      if (typeof parsed.detail === "string") msg = normalize(parsed.detail);
    } catch {
      /* keep msg */
    }
  }

  const lower = msg.toLowerCase();
  if (lower.startsWith("no products detected") || /did not detect any products/i.test(lower)) {
    return "No products detected in this shelf image. Try a clearer photo with products facing the camera.";
  }
  if (lower.includes("daily demo scan limit")) return msg;
  if (isSafePublicMessage(msg)) return msg;
  if (/timed?\s*out|timeout|took too long|did not finish analys/i.test(lower)) {
    return GENERIC_TIMEOUT;
  }
  if (/openai|credits?|billing|quota|rate.?limit|\b429\b/i.test(lower)) return GENERIC_UNAVAILABLE;
  if (INTERNAL_MARKERS.test(msg)) return fallback;
  if (!msg || msg.length > 280) return fallback;
  return msg;
}

/** Pulls a safe message out of a JSON error body (`detail` in any shape). */
export function parseApiDetail(body: unknown, fallback = GENERIC_SCAN): string {
  if (!body || typeof body !== "object") return fallback;
  const detail = (body as { detail?: unknown; message?: unknown; error?: unknown }).detail;
  if (typeof detail === "string" && detail.trim()) return sanitizeUserMessage(detail, fallback);
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    if (typeof first === "string") return sanitizeUserMessage(first, fallback);
    if (first && typeof first === "object" && "msg" in first) {
      return sanitizeUserMessage(String((first as { msg?: string }).msg ?? fallback), fallback);
    }
  }
  const alt =
    (body as { message?: unknown }).message ?? (body as { error?: unknown }).error;
  if (typeof alt === "string" && alt.trim()) return sanitizeUserMessage(alt, fallback);
  return fallback;
}

/** Sanitizes a thrown value, mapping transport failures to a connection hint. */
export function networkErrorMessage(err: unknown, fallback = GENERIC_SCAN): string {
  if (err instanceof TypeError) return GENERIC_NETWORK;
  if (err instanceof Error && /failed to fetch|networkerror|load failed/i.test(err.message)) {
    return GENERIC_NETWORK;
  }
  return sanitizeUserMessage(err instanceof Error ? err.message : String(err), fallback);
}
