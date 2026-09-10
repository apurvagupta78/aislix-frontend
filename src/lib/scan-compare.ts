/**
 * SKU-level before/after diff for scan comparison.
 */

import type { ScanResult } from "@/lib/scan-results";

export type SkuCompareRow = {
  key: string;
  brand: string;
  product: string;
  before_qty: number;
  after_qty: number;
  delta: number;
  status: "added" | "removed" | "increased" | "decreased" | "unchanged";
};

function skuKey(row: { brand?: string; product?: string; variant?: string }): string {
  return [row.brand, row.product, row.variant].filter(Boolean).join("|").toLowerCase();
}

export function buildSkuCompareDiff(before: ScanResult, after: ScanResult): SkuCompareRow[] {
  const beforeMap = new Map<string, { brand: string; product: string; qty: number }>();
  for (const row of before.inventory ?? []) {
    const key = skuKey(row);
    const existing = beforeMap.get(key);
    const qty = row.quantity ?? 0;
    if (existing) existing.qty += qty;
    else beforeMap.set(key, { brand: row.brand, product: row.product, qty });
  }

  const afterMap = new Map<string, { brand: string; product: string; qty: number }>();
  for (const row of after.inventory ?? []) {
    const key = skuKey(row);
    const existing = afterMap.get(key);
    const qty = row.quantity ?? 0;
    if (existing) existing.qty += qty;
    else afterMap.set(key, { brand: row.brand, product: row.product, qty });
  }

  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const rows: SkuCompareRow[] = [];

  for (const key of keys) {
    const b = beforeMap.get(key);
    const a = afterMap.get(key);
    const beforeQty = b?.qty ?? 0;
    const afterQty = a?.qty ?? 0;
    const delta = afterQty - beforeQty;
    let status: SkuCompareRow["status"] = "unchanged";
    if (beforeQty === 0 && afterQty > 0) status = "added";
    else if (beforeQty > 0 && afterQty === 0) status = "removed";
    else if (delta > 0) status = "increased";
    else if (delta < 0) status = "decreased";

    if (status === "unchanged") continue;

    rows.push({
      key,
      brand: a?.brand ?? b?.brand ?? "Unknown",
      product: a?.product ?? b?.product ?? "Unknown",
      before_qty: beforeQty,
      after_qty: afterQty,
      delta,
      status,
    });
  }

  return rows.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
}
