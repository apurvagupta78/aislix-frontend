/**
 * Fuzzy planogram ↔ detected inventory matching for homepage demo.
 * Mirrors backend compare_planogram intent without requiring a server round-trip.
 */

import type { PlanogramRow } from "@/lib/planogram";

export type InventoryFacing = {
  brand?: string | null;
  product?: string | null;
  product_name?: string | null;
  variant?: string | null;
  quantity?: number | null;
};

export type PlanogramMatchLine = {
  expected: PlanogramRow;
  detected_qty: number;
  expected_qty: number;
  present: boolean;
  qty_ok: boolean;
};

export type PlanogramMatchResult = {
  sku_match_percent: number;
  qty_compliance_percent: number;
  missing_count: number;
  qty_short_count: number;
  lines: PlanogramMatchLine[];
};

function norm(value?: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeBrand(value?: string | null): string {
  return norm(value).replace(/[^a-z0-9]/g, "");
}

function brandsMatch(a?: string | null, b?: string | null): boolean {
  const na = normalizeBrand(a);
  const nb = normalizeBrand(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function productBlob(item: InventoryFacing): string {
  return [item.brand, item.product ?? item.product_name, item.variant]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function planogramBlob(row: PlanogramRow): string {
  return [row.brand, row.product_name, row.variant].filter(Boolean).join(" ").toLowerCase();
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(norm(a).split(" ").filter((t) => t.length > 2));
  const tb = new Set(norm(b).split(" ").filter((t) => t.length > 2));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit += 1;
  return hit / Math.max(ta.size, tb.size);
}

/** Score how well a planogram row matches an inventory facing (0–1). */
export function scorePlanogramFacing(plan: PlanogramRow, item: InventoryFacing): number {
  if (!brandsMatch(plan.brand, item.brand)) return 0;

  const planText = planogramBlob(plan);
  const invText = productBlob(item);
  if (!planText || !invText) return 0.25;

  const planTokens = norm(plan.product_name).split(" ").filter((t) => t.length > 2);
  const productHit =
    planTokens.length === 0 || planTokens.some((t) => invText.includes(t)) ? 1 : 0;

  const variant = norm(plan.variant);
  const variantHit = !variant || invText.includes(variant) ? 1 : 0.5;

  const overlap = tokenOverlap(planText, invText);
  return productHit * 0.5 + variantHit * 0.25 + overlap * 0.25;
}

/** Sum detected facings for a planogram row using best fuzzy matches. */
export function detectedQtyForPlanogramRow(
  inventory: InventoryFacing[],
  plan: PlanogramRow,
): number {
  const scored = inventory
    .map((item) => ({ item, score: scorePlanogramFacing(plan, item) }))
    .filter((row) => row.score >= 0.45)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return 0;

  const best = scored[0]!.score;
  return scored
    .filter((row) => row.score >= best - 0.05)
    .reduce((sum, row) => sum + (row.item.quantity ?? 0), 0);
}

export function comparePlanogramToInventory(
  inventory: InventoryFacing[],
  rows: PlanogramRow[],
): PlanogramMatchResult {
  if (!rows.length) {
    return {
      sku_match_percent: 0,
      qty_compliance_percent: 0,
      missing_count: 0,
      qty_short_count: 0,
      lines: [],
    };
  }

  const lines: PlanogramMatchLine[] = [];
  let present = 0;
  let qtyScore = 0;
  let missing = 0;
  let qtyShort = 0;

  for (const expected of rows) {
    const detected_qty = detectedQtyForPlanogramRow(inventory, expected);
    const expected_qty = Math.max(1, expected.expected_qty ?? 1);
    const isPresent = detected_qty > 0;
    const qtyOk = detected_qty >= expected_qty;

    if (isPresent) present += 1;
    else missing += 1;
    if (isPresent && !qtyOk) qtyShort += 1;

    qtyScore += Math.min(detected_qty, expected_qty) / expected_qty;

    lines.push({
      expected,
      detected_qty,
      expected_qty,
      present: isPresent,
      qty_ok: qtyOk,
    });
  }

  return {
    sku_match_percent: Math.round((present / rows.length) * 100),
    qty_compliance_percent: Math.round((qtyScore / rows.length) * 100),
    missing_count: missing,
    qty_short_count: qtyShort,
    lines,
  };
}

export function buildMatchKey(brand: string, product: string, sku = ""): string {
  return [brand, product, sku].map((part) => norm(part)).filter(Boolean).join("|");
}
