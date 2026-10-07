/**
 * Normalises the display check AI reply. The overall status is decided here, not by the AI,
 * so the same rules apply to every photo.
 */

import { hideModelNames } from "@/lib/ai-display-text";

export const DISPLAY_TYPES = [
  "shelf_strip",
  "shelf_talker",
  "wobbler",
  "dangler",
  "poster",
  "banner",
  "standee",
  "floor_display",
  "end_cap",
  "chiller",
  "rack",
  "gondola_header",
  "counter_display",
  "other",
] as const;
export type DisplayType = (typeof DISPLAY_TYPES)[number];

export const DISPLAY_PLACEMENTS = [
  "eye_level",
  "above_eye_level",
  "below_eye_level",
  "floor",
  "entrance",
  "checkout",
  "end_cap",
  "aisle",
  "unknown",
] as const;
export type DisplayPlacement = (typeof DISPLAY_PLACEMENTS)[number];

export type DisplayCondition = "good" | "damaged" | "missing";

/** good = all present and fine · needs_fix = damaged or empty display · missing = expected brand absent. */
export type DisplayCheckStatus = "good" | "needs_fix" | "missing" | "none_found" | "unclear";

export type DisplayItem = {
  type: DisplayType;
  brand: string | null;
  condition: DisplayCondition;
  placement: DisplayPlacement;
  visible: boolean;
  notes: string;
  confidence: number | null;
};

export type DisplayCheckResult = {
  status: DisplayCheckStatus;
  items: DisplayItem[];
  expectedBrandPresent: boolean | null;
  imageQuality: "good" | "poor";
  summary: string;
};

const MAX_ITEMS = 30;

function str(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const v = str(value, 40).toLowerCase().replace(/[\s-]+/g, "_");
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function unitInterval(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n));
}

function brandOrNull(value: unknown): string | null {
  const b = str(value, 80);
  if (!b || /^(unknown|n\/?a|none|null|generic|unbranded)$/i.test(b)) return null;
  return b;
}

export function normalizeBrand(brand: string): string {
  return brand
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");
}

function brandMatches(brand: string | null, expected: string): boolean {
  if (!brand) return false;
  const a = normalizeBrand(brand);
  const b = normalizeBrand(expected);
  return Boolean(a && b) && (a.includes(b) || b.includes(a));
}

export function decideDisplayStatus(input: {
  items: DisplayItem[];
  expectedBrand: string | null;
  expectedBrandPresent: boolean | null;
  imageQuality: "good" | "poor";
}): DisplayCheckStatus {
  const { items, expectedBrand } = input;
  // A poor photo never gives a verdict or opens fixes; the auditor retakes it.
  if (input.imageQuality === "poor") return "unclear";
  if (expectedBrand) {
    const seen = items.some((i) => brandMatches(i.brand, expectedBrand) && i.condition !== "missing");
    if (!seen && input.expectedBrandPresent !== true) {
      return input.expectedBrandPresent === null ? "unclear" : "missing";
    }
  }
  if (items.some((i) => i.condition !== "good")) return "needs_fix";
  if (!items.length) return "none_found";
  return "good";
}

export function parseDisplayCheckPayload(payload: unknown, expectedBrand: string | null): DisplayCheckResult {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const rawItems = Array.isArray(root.items) ? root.items : [];
  const items: DisplayItem[] = rawItems.slice(0, MAX_ITEMS).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const r = raw as Record<string, unknown>;
    return [
      {
        type: pick(r.type, DISPLAY_TYPES, "other"),
        brand: brandOrNull(r.brand),
        condition: pick<DisplayCondition>(r.condition, ["good", "damaged", "missing"], "good"),
        placement: pick(r.placement, DISPLAY_PLACEMENTS, "unknown"),
        visible: r.visible !== false,
        notes: hideModelNames(str(r.notes, 240)),
        confidence: unitInterval(r.confidence),
      },
    ];
  });
  const expectedBrandPresent =
    typeof root.expected_brand_present === "boolean" ? root.expected_brand_present : null;
  const imageQuality = str(root.image_quality, 10).toLowerCase() === "poor" ? "poor" : "good";
  return {
    status: decideDisplayStatus({ items, expectedBrand, expectedBrandPresent, imageQuality }),
    items,
    expectedBrandPresent: expectedBrand ? expectedBrandPresent : null,
    imageQuality,
    summary: hideModelNames(str(root.summary, 500)),
  };
}

export const DISPLAY_TYPE_LABEL: Record<DisplayType, string> = {
  shelf_strip: "Shelf strip",
  shelf_talker: "Shelf talker",
  wobbler: "Wobbler",
  dangler: "Dangler",
  poster: "Poster",
  banner: "Banner",
  standee: "Standee",
  floor_display: "Floor display",
  end_cap: "End-cap display",
  chiller: "Branded chiller",
  rack: "Branded rack",
  gondola_header: "Gondola header",
  counter_display: "Counter display",
  other: "Other display",
};

export const DISPLAY_PLACEMENT_LABEL: Record<DisplayPlacement, string> = {
  eye_level: "Eye level",
  above_eye_level: "Above eye level",
  below_eye_level: "Below eye level",
  floor: "Floor",
  entrance: "Entrance",
  checkout: "Checkout",
  end_cap: "End cap",
  aisle: "Aisle",
  unknown: "Placement unclear",
};

export const DISPLAY_STATUS_LABEL: Record<DisplayCheckStatus, string> = {
  good: "All good",
  needs_fix: "Needs a fix",
  missing: "Expected display missing",
  none_found: "No displays found",
  unclear: "Photo unclear — retake",
};

/** Fixes to raise for a check: one per damaged or empty display, plus one if the expected brand is absent. */
export function displayCheckIssues(
  result: DisplayCheckResult,
  expectedBrand: string | null,
): { title: string; description: string; severity: "high" | "medium" }[] {
  const issues: { title: string; description: string; severity: "high" | "medium" }[] = [];
  if (result.status === "missing" && expectedBrand) {
    issues.push({
      title: `Display missing — ${expectedBrand}`,
      description: result.summary || `No ${expectedBrand} display was found in the photo.`,
      severity: "high",
    });
  }
  if (result.status === "unclear") return issues;
  for (const item of result.items) {
    if (item.condition === "good") continue;
    const what = `${item.brand ? `${item.brand} ` : ""}${DISPLAY_TYPE_LABEL[item.type].toLowerCase()}`;
    issues.push({
      title: item.condition === "missing" ? `Empty display — ${what}` : `Damaged display — ${what}`,
      description: item.notes || (item.condition === "missing" ? "The holder is there but the display is gone." : "The display is damaged."),
      severity: "medium",
    });
  }
  return issues;
}
