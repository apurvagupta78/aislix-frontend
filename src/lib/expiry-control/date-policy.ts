/** Store-local date parsing and policy classification. */

import type { DateType, ObservationClassification } from "./types";

export type ParsedDateResult =
  | { ok: true; date: string; ambiguous: false }
  | { ok: true; date: string; ambiguous: true; hint: string }
  | { ok: false; reason: string };

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_RE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/;

export function parseRetailDate(raw: string, _timezone = "Asia/Kolkata"): ParsedDateResult {
  const text = raw.trim();
  if (!text) return { ok: false, reason: "Empty date text." };

  const iso = ISO_RE.exec(text);
  if (iso) {
    return { ok: true, date: `${iso[1]}-${iso[2]}-${iso[3]}`, ambiguous: false };
  }

  const dmy = DMY_RE.exec(text);
  if (dmy) {
    const dd = dmy[1]!.padStart(2, "0");
    const mm = dmy[2]!.padStart(2, "0");
    let yyyy = dmy[3]!;
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    return {
      ok: true,
      date: `${yyyy}-${mm}-${dd}`,
      ambiguous: dd === "01" && mm === "01",
      hint: "Ambiguous day/month — confirm with auditor.",
    };
  }

  return { ok: false, reason: "Unrecognized date format — manual confirmation required." };
}

export function classifyByPolicy(input: {
  confirmedDate: string | null;
  dateType: DateType | null;
  unreadable: boolean;
  referenceDate?: string;
  nearExpiryDays?: number;
  hasShelfLifeRule?: boolean;
}): ObservationClassification {
  if (input.unreadable || !input.confirmedDate) return "unresolved";
  if (input.dateType === "manufacturing" && !input.hasShelfLifeRule) return "unresolved";

  const ref = input.referenceDate ?? new Date().toISOString().slice(0, 10);
  const nearDays = input.nearExpiryDays ?? 7;
  const confirmed = input.confirmedDate;
  if (confirmed < ref) return "expired";

  const refMs = new Date(`${ref}T00:00:00`).getTime();
  const expMs = new Date(`${confirmed}T23:59:59`).getTime();
  const daysLeft = Math.ceil((expMs - refMs) / 86400000);
  if (daysLeft <= nearDays) return "near_expiry";
  return "sellable";
}
