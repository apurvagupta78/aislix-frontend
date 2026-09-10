/**
 * Strict planogram ↔ inventory matching for demo and client-side context.
 * Aligns with backend issue types: missing, wrong_product, qty_mismatch, correct.
 */

import type { PlanogramRow } from "@/lib/planogram";

export type PlanogramIssueType =
  | "correct"
  | "missing"
  | "wrong_product"
  | "qty_mismatch";

export type InventoryFacing = {
  brand?: string | null;
  product?: string | null;
  product_name?: string | null;
  variant?: string | null;
  quantity?: number | null;
  sku?: string | null;
};

export type PlanogramMatchLine = {
  expected: PlanogramRow;
  detected_qty: number;
  expected_qty: number;
  issue_type: PlanogramIssueType;
  present: boolean;
  qty_ok: boolean;
  match_score: number;
  matched_brand?: string;
  matched_product?: string;
  detail?: string;
};

export type PlanogramMatchResult = {
  sku_match_percent: number;
  qty_compliance_percent: number;
  missing_count: number;
  wrong_product_count: number;
  qty_short_count: number;
  correct_count: number;
  lines: PlanogramMatchLine[];
};

const ISSUE_CORRECT: PlanogramIssueType = "correct";
const ISSUE_MISSING: PlanogramIssueType = "missing";
const ISSUE_WRONG: PlanogramIssueType = "wrong_product";
const ISSUE_QTY: PlanogramIssueType = "qty_mismatch";

const MATCH_PRESENT = 0.72;
const MATCH_CORRECT = 0.85;

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
  return na === nb || na.includes(nb) || nb.includes(na);
}

function productBlob(item: InventoryFacing | PlanogramRow): string {
  const product = "product" in item ? item.product ?? item.product_name : item.product_name;
  return [item.brand, product, item.variant].filter(Boolean).join(" ").toLowerCase();
}

function productTokens(name?: string | null): string[] {
  return norm(name)
    .split(" ")
    .filter((t) => t.length > 2);
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(productTokens(a));
  const tb = new Set(productTokens(b));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit += 1;
  return hit / Math.max(ta.size, tb.size);
}

/** Score 0–1 how well an inventory row matches a planogram SKU. */
export function scorePlanogramFacing(plan: PlanogramRow, item: InventoryFacing): number {
  if (!brandsMatch(plan.brand, item.brand)) return 0;

  const planSku = norm(plan.sku);
  const itemSku = norm(item.sku);
  if (planSku && itemSku && planSku === itemSku) return 1;

  const planName = norm(plan.product_name);
  const invBlob = productBlob(item);
  const planBlob = productBlob(plan);

  const planTokens = productTokens(plan.product_name);
  const variant = norm(plan.variant);

  // Require product-name tokens when planogram specifies a distinct product (not generic category word)
  const genericWords = new Set(["toothpaste", "shampoo", "chips", "tea", "soap", "water", "soda"]);
  const specificTokens = planTokens.filter((t) => !genericWords.has(t));

  if (specificTokens.length > 0) {
    const tokenHits = specificTokens.filter((t) => invBlob.includes(t)).length;
    if (tokenHits === 0) {
      // Brand matches but product/variant tokens do not — wrong product
      return 0.35;
    }
  }

  if (variant && !invBlob.includes(variant)) {
    return 0.4;
  }

  const overlap = tokenOverlap(planBlob, invBlob);
  if (overlap >= 0.8) return 0.95;
  if (overlap >= 0.5) return 0.78;
  if (specificTokens.length && specificTokens.some((t) => invBlob.includes(t))) return 0.72;
  return 0.35;
}

function findBestMatch(
  plan: PlanogramRow,
  inventory: InventoryFacing[],
  used: Set<number>,
): { index: number | null; score: number; item: InventoryFacing | null } {
  let bestIdx: number | null = null;
  let bestScore = 0;
  let bestItem: InventoryFacing | null = null;

  for (let i = 0; i < inventory.length; i++) {
    if (used.has(i)) continue;
    const score = scorePlanogramFacing(plan, inventory[i]!);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
      bestItem = inventory[i]!;
    }
  }

  if (bestScore < MATCH_PRESENT) return { index: null, score: 0, item: null };
  return { index: bestIdx, score: bestScore, item: bestItem };
}

function classifyLine(
  plan: PlanogramRow,
  detected_qty: number,
  expected_qty: number,
  match_score: number,
  matched?: InventoryFacing | null,
): PlanogramMatchLine {
  let issue_type: PlanogramIssueType = ISSUE_MISSING;
  let detail: string | undefined;

  if (detected_qty <= 0 || match_score < MATCH_PRESENT) {
    issue_type = ISSUE_MISSING;
    detail = `Expected ${plan.brand} ${plan.product_name} — not detected on shelf.`;
  } else if (match_score < MATCH_CORRECT) {
    issue_type = ISSUE_WRONG;
    detail = matched
      ? `Wrong SKU detected (${matched.brand} ${matched.product ?? matched.product_name ?? ""}) instead of ${plan.brand} ${plan.product_name}.`
      : `Product match too weak for ${plan.brand} ${plan.product_name}.`;
  } else if (detected_qty < expected_qty) {
    issue_type = ISSUE_QTY;
    detail = `Short by ${expected_qty - detected_qty} facing(s).`;
  } else {
    issue_type = ISSUE_CORRECT;
  }

  return {
    expected: plan,
    detected_qty,
    expected_qty,
    issue_type,
    present: detected_qty > 0 && match_score >= MATCH_PRESENT,
    qty_ok: detected_qty >= expected_qty && match_score >= MATCH_CORRECT,
    match_score,
    matched_brand: matched?.brand ?? undefined,
    matched_product: matched?.product ?? matched?.product_name ?? undefined,
    detail,
  };
}

/** Best-match qty for a single planogram row — one inventory row only, no brand aggregation. */
export function detectedQtyForPlanogramRow(
  inventory: InventoryFacing[],
  plan: PlanogramRow,
  used?: Set<number>,
): { qty: number; score: number; item: InventoryFacing | null; index: number | null } {
  const usedSet = used ?? new Set<number>();
  const { index, score, item } = findBestMatch(plan, inventory, usedSet);
  if (index == null || !item) return { qty: 0, score: 0, item: null, index: null };
  return { qty: item.quantity ?? 0, score, item, index };
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
      wrong_product_count: 0,
      qty_short_count: 0,
      correct_count: 0,
      lines: [],
    };
  }

  const used = new Set<number>();
  const lines: PlanogramMatchLine[] = [];
  let correct = 0;
  let missing = 0;
  let wrong = 0;
  let qtyShort = 0;
  let qtyScoreSum = 0;

  for (const expected of rows) {
    const expected_qty = Math.max(1, expected.expected_qty ?? 1);
    const match = findBestMatch(expected, inventory, used);

    let detected_qty = 0;
    if (match.index != null && match.item) {
      if (match.score >= MATCH_CORRECT) {
        used.add(match.index);
        detected_qty = match.item.quantity ?? 0;
      } else if (match.score >= MATCH_PRESENT) {
        // Weak match counts as wrong product, not as detected expected SKU
        detected_qty = 0;
      }
    }

    const line = classifyLine(expected, detected_qty, expected_qty, match.score, match.item);
    lines.push(line);

    switch (line.issue_type) {
      case ISSUE_CORRECT:
        correct += 1;
        qtyScoreSum += 1;
        break;
      case ISSUE_MISSING:
        missing += 1;
        qtyScoreSum += 0;
        break;
      case ISSUE_WRONG:
        wrong += 1;
        qtyScoreSum += 0;
        break;
      case ISSUE_QTY:
        qtyShort += 1;
        qtyScoreSum += Math.min(detected_qty, expected_qty) / expected_qty;
        break;
    }
  }

  const presentCount = lines.filter((l) => l.issue_type === ISSUE_CORRECT || l.issue_type === ISSUE_QTY).length;
  const skuMatch = Math.round((presentCount / rows.length) * 100);
  const strictMatch = Math.round((correct / rows.length) * 100);

  return {
    sku_match_percent: strictMatch,
    qty_compliance_percent: Math.round((qtyScoreSum / rows.length) * 100),
    missing_count: missing,
    wrong_product_count: wrong,
    qty_short_count: qtyShort,
    correct_count: correct,
    lines,
  };
}

export function buildMatchKey(brand: string, product: string, sku = ""): string {
  return [brand, product, sku].map((part) => norm(part)).filter(Boolean).join("|");
}

export type FinancialGapLine = {
  brand: string;
  product: string;
  issue_type: PlanogramIssueType;
  gap_units: number;
  daily_loss_inr: number;
};

/** Compute per-SKU financial gap from planogram match lines. */
export function computePlanogramFinancialGaps(
  match: PlanogramMatchResult,
  threshold = 2,
): FinancialGapLine[] {
  const gaps: FinancialGapLine[] = [];

  for (const line of match.lines) {
    const plan = line.expected;
    const asp =
      plan.mrp_inr != null && Number.isFinite(plan.mrp_inr) && plan.mrp_inr > 0 ? plan.mrp_inr : 75;
    const velocity =
      plan.avg_daily_sales != null && Number.isFinite(plan.avg_daily_sales) && plan.avg_daily_sales > 0
        ? plan.avg_daily_sales
        : 4;

    if (line.issue_type === ISSUE_MISSING || line.issue_type === ISSUE_WRONG) {
      gaps.push({
        brand: plan.brand,
        product: plan.product_name,
        issue_type: line.issue_type,
        gap_units: line.expected_qty,
        daily_loss_inr: Math.round(velocity * asp * line.expected_qty),
      });
    } else if (line.issue_type === ISSUE_QTY) {
      const gap = line.expected_qty - line.detected_qty;
      gaps.push({
        brand: plan.brand,
        product: plan.product_name,
        issue_type: line.issue_type,
        gap_units: gap,
        daily_loss_inr: Math.round(gap * velocity * asp * 0.35),
      });
    } else if (line.detected_qty > 0 && line.detected_qty < threshold) {
      gaps.push({
        brand: plan.brand,
        product: plan.product_name,
        issue_type: ISSUE_QTY,
        gap_units: threshold - line.detected_qty,
        daily_loss_inr: Math.round((threshold - line.detected_qty) * velocity * asp),
      });
    }
  }

  return gaps;
}
