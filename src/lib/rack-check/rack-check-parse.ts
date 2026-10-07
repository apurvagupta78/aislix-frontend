/**
 * Normalises the rack quick check AI reply. Bin counts and the overall status are calculated
 * here, not by the AI, so the same rules apply to every rack photo.
 */

import { hideModelNames } from "@/lib/ai-display-text";

export const BIN_STATUSES = ["empty", "low", "stocked", "messy", "not_visible"] as const;
export type BinStatus = (typeof BIN_STATUSES)[number];

/** needs_refill = at least one empty bin · attention = low or messy bins · good = every visible bin stocked. */
export type RackCheckStatus = "good" | "attention" | "needs_refill" | "none_found" | "unclear";

export type RackBin = { code: string | null; status: BinStatus; note: string };
export type RackShelf = { shelf: string | null; bins: RackBin[] };

export type RackCounts = {
  total: number;
  empty: number;
  low: number;
  stocked: number;
  messy: number;
  notVisible: number;
};

export type RackCheckResult = {
  status: RackCheckStatus;
  rackCodeRead: string | null;
  shelves: RackShelf[];
  counts: RackCounts;
  imageQuality: "good" | "poor";
  summary: string;
};

const MAX_SHELVES = 12;
const MAX_BINS_PER_SHELF = 12;
/** Above this many problem bins, one rack-level fix is opened instead of one per bin. */
export const MAX_BIN_ISSUES = 12;

function str(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Bin and rack codes: letters, digits and dashes only; anything else is treated as unread. */
export function normalizeCode(value: unknown): string | null {
  const code = str(value, 40).toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(code)) return null;
  if (/^(NULL|NONE|UNKNOWN|N\/A|NA)$/.test(code)) return null;
  return code;
}

/** A rack read from the photo must include a number (D07, F02); a bare zone such as AMB is not a rack. */
function rackCodeFromPhoto(value: unknown): string | null {
  const code = normalizeCode(value);
  return code && /\d/.test(code) ? code : null;
}

function shelfLetter(value: unknown): string | null {
  const s = str(value, 4).toUpperCase();
  return /^[A-Z]$/.test(s) ? s : null;
}

function binStatus(value: unknown): BinStatus {
  const v = str(value, 20).toLowerCase().replace(/[\s-]+/g, "_");
  if ((BIN_STATUSES as readonly string[]).includes(v)) return v as BinStatus;
  if (v === "notvisible" || v === "hidden" || v === "unknown") return "not_visible";
  if (v === "full" || v === "ok") return "stocked";
  return "not_visible";
}

export function countBins(shelves: RackShelf[]): RackCounts {
  const counts: RackCounts = { total: 0, empty: 0, low: 0, stocked: 0, messy: 0, notVisible: 0 };
  for (const shelf of shelves) {
    for (const bin of shelf.bins) {
      counts.total += 1;
      if (bin.status === "not_visible") counts.notVisible += 1;
      else counts[bin.status] += 1;
    }
  }
  return counts;
}

export function decideRackStatus(counts: RackCounts, imageQuality: "good" | "poor"): RackCheckStatus {
  // A poor photo never gives a verdict or opens fixes; the auditor retakes it.
  if (imageQuality === "poor") return "unclear";
  if (!counts.total) return "none_found";
  if (counts.notVisible === counts.total) return "unclear";
  if (counts.empty) return "needs_refill";
  if (counts.low || counts.messy) return "attention";
  return "good";
}

export function parseRackCheckPayload(payload: unknown): RackCheckResult {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const rawShelves = Array.isArray(root.shelves) ? root.shelves : [];
  const shelves: RackShelf[] = rawShelves.slice(0, MAX_SHELVES).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const r = raw as Record<string, unknown>;
    const rawBins = Array.isArray(r.bins) ? r.bins : [];
    const bins: RackBin[] = rawBins.slice(0, MAX_BINS_PER_SHELF).flatMap((b) => {
      if (!b || typeof b !== "object") return [];
      const bin = b as Record<string, unknown>;
      return [{ code: normalizeCode(bin.code), status: binStatus(bin.status), note: hideModelNames(str(bin.note, 120)) }];
    });
    return bins.length ? [{ shelf: shelfLetter(r.shelf), bins }] : [];
  });
  const counts = countBins(shelves);
  const imageQuality = str(root.image_quality, 10).toLowerCase() === "poor" ? "poor" : "good";
  return {
    status: decideRackStatus(counts, imageQuality),
    rackCodeRead: rackCodeFromPhoto(root.rack_code),
    shelves,
    counts,
    imageQuality,
    summary: hideModelNames(str(root.summary, 500)),
  };
}

export const BIN_STATUS_LABEL: Record<BinStatus, string> = {
  empty: "Empty",
  low: "Low",
  stocked: "Stocked",
  messy: "Messy",
  not_visible: "Not visible",
};

export const RACK_STATUS_LABEL: Record<RackCheckStatus, string> = {
  good: "All stocked",
  attention: "Needs attention",
  needs_refill: "Refill needed",
  none_found: "No bins found",
  unclear: "Photo unclear — retake",
};

/** Where a bin is, in words: its printed code, or rack · shelf · bin position. */
export function binPlace(bin: RackBin, shelf: RackShelf, shelfIndex: number, binIndex: number, rack: string | null): string {
  if (bin.code) return bin.code;
  const parts = [
    rack ? `Rack ${rack}` : null,
    shelf.shelf ? `shelf ${shelf.shelf}` : `shelf ${shelfIndex + 1} from top`,
    `bin ${binIndex + 1}`,
  ].filter(Boolean);
  return parts.join(", ");
}

export type RackIssue = {
  title: string;
  description: string;
  severity: "high" | "medium";
  findingType: "out_of_stock" | "shelf_execution_issue";
  /** True when the bin can be told apart from bins on other racks, so repeat checks can skip it. */
  identifiable: boolean;
};

/** Fixes to raise: refill each empty bin and tidy each messy bin, or one rack-level fix when there are many. */
export function rackCheckIssues(result: RackCheckResult, rackCode: string | null): RackIssue[] {
  if (result.status === "unclear" || result.status === "none_found") return [];
  const rack = rackCode ?? result.rackCodeRead;
  const issues: RackIssue[] = [];
  result.shelves.forEach((shelf, si) => {
    shelf.bins.forEach((bin, bi) => {
      if (bin.status !== "empty" && bin.status !== "messy") return;
      const place = binPlace(bin, shelf, si, bi, rack);
      const identifiable = Boolean(bin.code || rack);
      issues.push(
        bin.status === "empty"
          ? {
              title: `Refill empty bin ${place}`,
              description: bin.note || "The bin is empty in the rack photo.",
              severity: "high",
              findingType: "out_of_stock",
              identifiable,
            }
          : {
              title: `Tidy messy bin ${place}`,
              description: bin.note || "Products are fallen, mixed or blocking the bin label.",
              severity: "medium",
              findingType: "shelf_execution_issue",
              identifiable,
            },
      );
    });
  });
  if (issues.length <= MAX_BIN_ISSUES) return issues;
  const where = rack ? `rack ${rack}` : "this rack";
  return [
    {
      title: `Refill and tidy ${where} — ${result.counts.empty} empty, ${result.counts.messy} messy bins`,
      description: result.summary || `Many bins on ${where} are empty or messy.`,
      severity: result.counts.empty ? "high" : "medium",
      findingType: result.counts.empty ? "out_of_stock" : "shelf_execution_issue",
      identifiable: Boolean(rack),
    },
  ];
}
