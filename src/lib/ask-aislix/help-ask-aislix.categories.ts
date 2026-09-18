import type { ShelfCategory } from "@/lib/categories.data";
import { FALLBACK_CATEGORIES } from "@/lib/categories.data";

const OTHERS_SUB = { id: "others", label: "Others", allow_custom: true as const };

export function mergeHelpAskCategories(
  categoryMaster: ShelfCategory[],
  scanRows: Array<{ category?: string | null; sub_category?: string | null }>,
): { categoryCatalog: ShelfCategory[]; categories: string[] } {
  const master = categoryMaster.length ? categoryMaster : FALLBACK_CATEGORIES;
  const scanCategorySet = new Set<string>();

  for (const row of scanRows) {
    const cat = String(row.category ?? "").trim();
    if (cat) scanCategorySet.add(cat);
  }

  const masterByName = new Map(master.map((c) => [c.name, c]));
  const mergedCatalog: ShelfCategory[] = [...master];

  for (const scanCat of scanCategorySet) {
    if (masterByName.has(scanCat)) continue;
    mergedCatalog.push({
      name: scanCat,
      examples: "",
      subcategories: [OTHERS_SUB],
    });
  }

  for (const row of scanRows) {
    const cat = String(row.category ?? "").trim();
    const sub = String(row.sub_category ?? "").trim();
    if (!cat || !sub) continue;

    const entry = mergedCatalog.find((c) => c.name === cat);
    if (!entry) continue;

    const subs = entry.subcategories ?? [];
    const exists = subs.some((s) => s.label.toLowerCase() === sub.toLowerCase());
    if (!exists) {
      entry.subcategories = [
        ...subs.filter((s) => s.id !== "others"),
        { id: sub.toLowerCase().replace(/\s+/g, "_"), label: sub },
        OTHERS_SUB,
      ];
    }
  }

  const categories = mergedCatalog.map((c) => c.name).sort((a, b) => a.localeCompare(b));
  return { categoryCatalog: mergedCatalog, categories };
}

export function resolveSubCategoryLabel(
  catalog: ShelfCategory[],
  categoryName: string,
  subId: string,
  customSub: string,
): string | null {
  if (!subId) return null;
  if (subId === "others") {
    const trimmed = customSub.trim();
    return trimmed || null;
  }
  const category = catalog.find((c) => c.name === categoryName);
  return category?.subcategories?.find((s) => s.id === subId)?.label ?? null;
}
