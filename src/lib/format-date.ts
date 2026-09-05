/**
 * Safe display formatting for dates.
 *
 * Never call `toLocaleDateString` directly on a raw API/DB field: missing or
 * zero values produce Unix-epoch output ("31 Dec 1969"), which looks broken.
 * Anything at or before 2 Jan 1970 is treated as "no date".
 */

const EPOCH_GUARD_MS = 86_400_000;

export function formatDisplayDate(
  value: string | number | Date | null | undefined,
  fallback = "—",
): string {
  if (value === null || value === undefined || value === "" || value === 0) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time) || time < EPOCH_GUARD_MS) return fallback;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDisplayDateTime(
  value: string | number | Date | null | undefined,
  fallback = "—",
): string {
  if (value === null || value === undefined || value === "" || value === 0) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time) || time < EPOCH_GUARD_MS) return fallback;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** True when a value would render as an epoch-zero placeholder. */
export function isUsableDate(value: string | number | Date | null | undefined): boolean {
  if (value === null || value === undefined || value === "" || value === 0) return false;
  const time = (value instanceof Date ? value : new Date(value)).getTime();
  return !Number.isNaN(time) && time >= EPOCH_GUARD_MS;
}
