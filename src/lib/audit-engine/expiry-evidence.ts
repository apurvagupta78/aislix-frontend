import type { AuditResponseValue } from "@/lib/audit-builder/types";

/** Per-row keys saved in the repeating section when the policy requires Expiry dates. */
export const EXPIRY_SCAN_PHOTO_KEY = "expiry_scan_photo";
export const EXPIRY_SCAN_DATE_KEY = "expiry_scan_date";
export const EXPIRY_SCAN_READ_KEY = "expiry_scan_read";
export const EXPIRY_SCAN_STATUS_KEY = "expiry_scan_status";
export const EXPIRY_SCAN_ITEM_KEY = "expiry_scan_item";
export const EXPIRY_REMOVED_KEY = "expiry_removed";
export const EXPIRY_REMOVAL_PHOTO_KEY = "expiry_removal_photo";

export type ExpiryStatus = "expired" | "near_expiry" | "ok";

export const EXPIRY_STATUS_LABEL: Record<ExpiryStatus, string> = {
  expired: "Expired",
  near_expiry: "Near expiry",
  ok: "OK",
};

/** What the AI read from the photo, kept next to the confirmed date for provenance. */
export type ExpiryReading = {
  date: string | null;
  rawText: string;
  kind: "expiry" | "best_before" | "use_by" | "derived_from_mfg" | "unknown";
  confidence: number | null;
  readAt: string;
};

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

function isoOf(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > lastDay(y, m)) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Device-local calendar date (YYYY-MM-DD) — expiry is judged against the store's day, not UTC. */
export function localIsoDate(at: Date = new Date()): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/**
 * Printed retail dates → YYYY-MM-DD. Day-first (DD/MM/YYYY) as printed in India and most markets.
 * Month-only dates ("EXP 10/2026", "OCT 2026") mean the last day of that month.
 */
export function normalizeExpiryDate(raw: string | null | undefined): string | null {
  const text = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return null;
  const iso = ISO.exec(text);
  if (iso) return isoOf(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dmy = /^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{2}|\d{4})$/.exec(text);
  if (dmy) return isoOf(fullYear(Number(dmy[3])), Number(dmy[2]), Number(dmy[1]));

  const ym = /^(\d{4})[/.-](\d{1,2})$/.exec(text);
  if (ym) return isoOf(Number(ym[1]), Number(ym[2]), lastDay(Number(ym[1]), Number(ym[2])));

  const my = /^(\d{1,2})[/.\- ](\d{4}|\d{2})$/.exec(text);
  if (my) {
    const y = fullYear(Number(my[2]));
    const m = Number(my[1]);
    return m >= 1 && m <= 12 ? isoOf(y, m, lastDay(y, m)) : null;
  }

  const named = /^(?:(\d{1,2})[ \-/.]?)?([a-z]{3,9})[ \-/.,]*(\d{2}|\d{4})$/.exec(text);
  if (named) {
    const m = MONTHS[named[2]!.slice(0, named[2]!.startsWith("sept") ? 4 : 3)];
    if (!m) return null;
    const y = fullYear(Number(named[3]));
    return isoOf(y, m, named[1] ? Number(named[1]) : lastDay(y, m));
  }
  return null;
}

export function daysUntil(date: string, today: string): number {
  const a = Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  const b = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

/** A product is expired from the day after its printed date; "near expiry" within `nearDays` days. */
export function classifyExpiry(date: string, today: string, nearDays: number): ExpiryStatus {
  const left = daysUntil(date, today);
  if (left < 0) return "expired";
  if (left <= nearDays) return "near_expiry";
  return "ok";
}

export function describeExpiry(date: string, today: string): string {
  const left = daysUntil(date, today);
  if (left < 0) return `Expired ${-left} day${left === -1 ? "" : "s"} ago`;
  if (left === 0) return "Expires today";
  return `${left} day${left === 1 ? "" : "s"} left`;
}

export function parseExpiryReading(value: unknown): ExpiryReading | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ExpiryReading>;
    return {
      date: typeof parsed.date === "string" ? parsed.date : null,
      rawText: String(parsed.rawText ?? ""),
      kind: (parsed.kind ?? "unknown") as ExpiryReading["kind"],
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
      readAt: String(parsed.readAt ?? ""),
    };
  } catch {
    return null;
  }
}

const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String).filter(Boolean) : typeof value === "string" && value.trim() ? [value] : [];

export type RowExpiry = {
  photos: string[];
  date: string | null;
  reading: ExpiryReading | null;
  status: ExpiryStatus | null;
  removed: boolean;
  removalPhotos: string[];
  /** Photo of the date and a confirmed date are both required. */
  dateMissing: boolean;
  /** Expired: must be confirmed removed with a photo. */
  removalMissing: boolean;
};

export function rowExpiryState(
  values: Record<string, AuditResponseValue | undefined>,
  today: string,
  nearDays: number,
): RowExpiry {
  const photos = list(values[EXPIRY_SCAN_PHOTO_KEY]);
  const date = normalizeExpiryDate(typeof values[EXPIRY_SCAN_DATE_KEY] === "string" ? (values[EXPIRY_SCAN_DATE_KEY] as string) : null);
  const status = date ? classifyExpiry(date, today, nearDays) : null;
  const removed = values[EXPIRY_REMOVED_KEY] === true;
  const removalPhotos = list(values[EXPIRY_REMOVAL_PHOTO_KEY]);
  return {
    photos,
    date,
    reading: parseExpiryReading(values[EXPIRY_SCAN_READ_KEY]),
    status,
    removed,
    removalPhotos,
    dateMissing: photos.length === 0 || !date,
    removalMissing: status === "expired" && (!removed || removalPhotos.length === 0),
  };
}
