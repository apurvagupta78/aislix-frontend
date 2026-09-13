/**
 * Keeps the New Scan setup Category / Sub-category in sync with the optional
 * planogram rows, so POST /audit sends the same audit context the planogram
 * expects (bug: ice-cream planogram audited as Beverages · Tea).
 */

import type { ShelfCategory } from "@/lib/categories.data";
import type { DraftRow } from "@/lib/planogram";

export type ResolvedScanCategory = {
  categoryName: string;
  subCategoryId: string;
  subCategoryLabel: string;
};

const norm = (value: string | null | undefined) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

/** Most frequent (category, sub_category) pair across planogram rows. */
export function dominantPlanogramPair(
  rows: Array<Pick<DraftRow, "category" | "sub_category">>,
): { category: string; sub_category: string } | null {
  const counts = new Map<string, { category: string; sub_category: string; count: number }>();
  for (const row of rows) {
    const category = String(row.category ?? "").trim();
    if (!category) continue;
    const sub_category = String(row.sub_category ?? "").trim();
    const key = `${norm(category)}::${norm(sub_category)}`;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { category, sub_category, count: 1 });
  }
  let best: { category: string; sub_category: string; count: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best ? { category: best.category, sub_category: best.sub_category } : null;
}

/** Maps free-text planogram category/sub-category strings onto GET /categories. */
export function resolveScanCategory(
  categories: ShelfCategory[],
  rawCategory: string,
  rawSubCategory: string,
): ResolvedScanCategory | null {
  const wanted = norm(rawCategory);
  if (!wanted) return null;

  const category =
    categories.find((item) => norm(item.name) === wanted || norm(item.id) === wanted) ??
    categories.find(
      (item) => norm(item.name).includes(wanted) || wanted.includes(norm(item.name)),
    ) ??
    categories.find((item) =>
      (item.subcategories ?? []).some(
        (sub) => norm(sub.id) === wanted || norm(sub.label) === wanted,
      ),
    );
  if (!category) return null;

  const subs = category.subcategories ?? [];
  const wantedSub = norm(rawSubCategory);
  const sub =
    (wantedSub
      ? (subs.find((item) => norm(item.id) === wantedSub || norm(item.label) === wantedSub) ??
        subs.find(
          (item) => norm(item.label).includes(wantedSub) || wantedSub.includes(norm(item.id)),
        ))
      : undefined) ??
    // The planogram may name the sub-category in its category column ("Ice cream").
    subs.find((item) => norm(item.id) === wanted || norm(item.label) === wanted);

  return {
    categoryName: category.name,
    subCategoryId: sub?.id ?? "",
    subCategoryLabel: sub?.label ?? "",
  };
}

export function formatScanCategory(resolved: ResolvedScanCategory): string {
  return [resolved.categoryName, resolved.subCategoryLabel].filter(Boolean).join(" · ");
}
