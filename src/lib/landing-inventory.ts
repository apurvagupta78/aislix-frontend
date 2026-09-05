/**
 * Display helpers for the anonymous landing-demo results table.
 * Variant is what distinguishes two rows of the same product type
 * (e.g. Lay's Potato Chips — Magic Masala vs Tomato Tango).
 */
import type { LandingInventoryRow, LandingScanResult } from "@/lib/landing-scan-api";

const KNOWN_VARIANTS: [RegExp, string][] = [
  [/magic\s*masala/i, "Magic Masala"],
  [/(spanish\s*)?tomato\s*tango/i, "Tomato Tango"],
  [/cream(\s*&|\s*and)?\s*onion/i, "Cream & Onion"],
];

export function displayVariant(row: Partial<LandingInventoryRow> & { name?: string }): string {
  const variant = (row.variant ?? "").trim();
  if (variant) return variant;
  const name = (row.product_name ?? row.name ?? "").trim();
  for (const [pattern, label] of KNOWN_VARIANTS) {
    if (pattern.test(name)) return label;
  }
  return "—";
}

/** Distinct SKUs counted by brand + product + variant, never product alone. */
export function countLandingUniqueSkus(rows: LandingInventoryRow[] | undefined): number {
  const keys = new Set<string>();
  for (const row of rows ?? []) {
    const key = [row.brand, row.product_name, displayVariant(row)]
      .map((v) => (v ?? "").trim().toLowerCase())
      .join("|");
    if (key.replace(/\|/g, "").trim()) keys.add(key);
  }
  return keys.size;
}

export function uniqueSkuCount(result: LandingScanResult): number | undefined {
  return (
    result.metrics?.unique_skus ??
    result.metrics?.total_skus ??
    (result.inventory?.length ? countLandingUniqueSkus(result.inventory) : undefined)
  );
}

/** Average AI confidence as a 0–100 percentage, or undefined when unknown. */
export function averageConfidencePercent(result: LandingScanResult): number | undefined {
  const metric = result.metrics?.average_confidence;
  if (typeof metric === "number" && Number.isFinite(metric)) {
    return Math.round(metric <= 1 ? metric * 100 : metric);
  }
  const values = (result.inventory ?? [])
    .map((r) => r.confidence)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .map((v) => (v <= 1 ? v * 100 : v));
  if (!values.length) return undefined;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}
