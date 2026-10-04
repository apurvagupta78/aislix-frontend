import { normalizeExpiryDate, type ExpiryReading } from "@/lib/audit-engine/expiry-evidence";

const KINDS = new Set<ExpiryReading["kind"]>(["expiry", "best_before", "use_by", "derived_from_mfg", "unknown"]);

/** AI reply → reading; the date is only kept when it parses to a real calendar date. */
export function parseExpiryReadPayload(payload: unknown, readAt = new Date().toISOString()): ExpiryReading {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const rawText = typeof p.date_text === "string" ? p.date_text.trim().slice(0, 120) : "";
  const found = p.found !== false;
  const date = found
    ? normalizeExpiryDate(typeof p.expiry_date === "string" ? p.expiry_date : null) ?? normalizeExpiryDate(rawText.replace(/^[a-z .:]+/i, ""))
    : null;
  const kind = typeof p.date_kind === "string" && KINDS.has(p.date_kind as ExpiryReading["kind"]) ? (p.date_kind as ExpiryReading["kind"]) : "unknown";
  const confidence = typeof p.confidence === "number" && Number.isFinite(p.confidence) ? Math.max(0, Math.min(1, p.confidence)) : null;
  return { date, rawText, kind, confidence: date ? confidence : null, readAt };
}
