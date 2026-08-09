import { FALLBACK_CATEGORIES, type ShelfCategory } from "@/lib/categories.data";

/** Fetches the FMCG category + subcategory list from the vision backend, falling back locally. */
export async function loadShelfCategories(): Promise<ShelfCategory[]> {
  const base = process.env["AISLIX_AI_API_URL"];
  if (!base) return FALLBACK_CATEGORIES;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(`${base.replace(/\/$/, "")}/categories`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return FALLBACK_CATEGORIES;
    const payload = (await response.json()) as {
      categories?: Array<{
        id?: string;
        name?: string;
        examples?: string | string[];
        subcategories?: Array<{ id?: string; label?: string; allow_custom?: boolean }>;
      }>;
    };
    const rows: ShelfCategory[] = (payload?.categories ?? [])
      .map((row) => ({
        id: String(row?.id ?? "").trim() || undefined,
        name: String(row?.name ?? "").trim(),
        examples: Array.isArray(row?.examples)
          ? row.examples.join(", ")
          : String(row?.examples ?? "").trim(),
        subcategories: (row?.subcategories ?? [])
          .map((sub) => ({
            id: String(sub?.id ?? "").trim(),
            label: String(sub?.label ?? "").trim(),
            allow_custom: Boolean(sub?.allow_custom),
          }))
          .filter((sub) => sub.id.length > 0 && sub.label.length > 0),
      }))
      .filter((row) => row.name.length > 0);
    return rows.length ? rows : FALLBACK_CATEGORIES;
  } catch {
    return FALLBACK_CATEGORIES;
  }
}
