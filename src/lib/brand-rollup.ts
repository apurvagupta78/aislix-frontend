export type BrandRollupItem = {
  brand?: string | null;
  product?: string | null;
  product_name?: string | null;
  variant?: string | null;
  quantity?: number | null;
  qty?: number | null;
};

export type BrandRollup<T> = {
  brand: string;
  skuCount: number;
  totalQty: number;
  items: T[];
};

/** Collapse detected products into one row per brand (client-side only). */
export function rollupByBrand<T extends BrandRollupItem>(products: T[]): BrandRollup<T>[] {
  const map = new Map<string, BrandRollup<T>>();
  for (const p of products) {
    const brand = (p.brand ?? "").trim() || "Unknown";
    const cur = map.get(brand) ?? { brand, skuCount: 0, totalQty: 0, items: [] as T[] };
    cur.items.push(p);
    cur.totalQty += Number(p.quantity ?? p.qty ?? 0) || 0;
    cur.skuCount = new Set(
      cur.items.map((i) =>
        `${(i.product ?? i.product_name ?? "").toLowerCase()}|${(i.variant ?? "").toLowerCase()}`,
      ),
    ).size;
    map.set(brand, cur);
  }
  return [...map.values()].sort((a, b) => b.totalQty - a.totalQty);
}
