/**
 * Multi "Category · Subcategory" shelf types for one shelf audit.
 *
 * A retail rack often mixes product types (snacks + bread), so audits carry a
 * list of selections. The first entry stays the legacy primary category so old
 * audits and the vision backend keep working.
 */

import type { ShelfCategory } from "@/lib/categories.data";

export type CategorySelection = {
  category_id: string; // e.g. "packaged_food_snacks"
  category_name: string; // e.g. "Packaged Food & Snacks"
  sub_category_id: string; // e.g. "chips"
  sub_category_label: string; // e.g. "Chips"
  sub_category_custom?: string; // required when sub_category_id === "others"
};

export function formatCategorySelections(selections: CategorySelection[], max = 3): string {
  if (!selections.length) return "";
  const tags = selections.map((s) =>
    s.sub_category_id === "others" && s.sub_category_custom
      ? `${s.category_name} · ${s.sub_category_custom}`
      : [s.category_name, s.sub_category_label].filter(Boolean).join(" · "),
  );
  if (tags.length <= max) return tags.join(", ");
  return `${tags.slice(0, max).join(", ")} +${tags.length - max} more`;
}

/** Short label for one chip / tag. */
export function selectionLabel(s: CategorySelection): string {
  if (s.sub_category_id === "others" && s.sub_category_custom) return s.sub_category_custom;
  return s.sub_category_label || s.category_name;
}

export function primarySelection(selections: CategorySelection[]): CategorySelection | null {
  return selections[0] ?? null;
}

export function selectionKey(s: CategorySelection): string {
  return `${s.category_id}::${s.sub_category_id}::${(s.sub_category_custom ?? "").toLowerCase()}`;
}

export function dedupeSelections(list: CategorySelection[]): CategorySelection[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const k = selectionKey(s);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const norm = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s&-]+/g, "_");

export function slugifyCategory(name: string): string {
  return norm(name).replace(/[^a-z0-9_]/g, "");
}

export function categoryIdOf(category: ShelfCategory): string {
  return category.id?.trim() || slugifyCategory(category.name);
}

/** Parses a Supabase `category_selections` JSON column into typed selections. */
export function parseCategorySelections(raw: unknown): CategorySelection[] {
  if (!Array.isArray(raw)) return [];
  const list: CategorySelection[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const category_name = String(row["category_name"] ?? "").trim();
    if (!category_name) continue;
    const custom = String(row["sub_category_custom"] ?? "").trim();
    list.push({
      category_id: String(row["category_id"] ?? "").trim() || slugifyCategory(category_name),
      category_name,
      sub_category_id: String(row["sub_category_id"] ?? "").trim(),
      sub_category_label: String(row["sub_category_label"] ?? "").trim(),
      ...(custom ? { sub_category_custom: custom } : {}),
    });
  }
  return dedupeSelections(list);
}

/**
 * Display helper — never show a stale single category when selections exist.
 */
export function shelfTypesLabel(
  scan: {
    category_selections?: CategorySelection[] | null;
    category?: string | null;
    sub_category_label?: string | null;
    sub_category?: string | null;
  },
  max = 3,
): string {
  const selections = scan.category_selections ?? [];
  if (selections.length) return formatCategorySelections(selections, max);
  return [scan.category, scan.sub_category_label || scan.sub_category].filter(Boolean).join(" · ");
}

/**
 * Maps free-text planogram (category, sub_category) pairs onto GET /categories
 * so CSV rows can be merged into the scan's shelf types.
 */
export function resolveSelection(
  categories: ShelfCategory[],
  rawCategory: string,
  rawSubCategory: string,
): CategorySelection | null {
  const wanted = norm(rawCategory);
  const wantedSub = norm(rawSubCategory);
  if (!wanted && !wantedSub) return null;

  const category =
    categories.find((item) => norm(item.name) === wanted || norm(item.id) === wanted) ??
    categories.find(
      (item) =>
        Boolean(wanted) &&
        (norm(item.name).includes(wanted) || wanted.includes(norm(item.name))),
    ) ??
    categories.find((item) =>
      (item.subcategories ?? []).some(
        (sub) => norm(sub.id) === wanted || norm(sub.label) === wanted,
      ),
    ) ??
    categories.find((item) =>
      (item.subcategories ?? []).some(
        (sub) => norm(sub.id) === wantedSub || norm(sub.label) === wantedSub,
      ),
    );
  if (!category) return null;

  const subs = category.subcategories ?? [];
  const sub =
    (wantedSub
      ? (subs.find((item) => norm(item.id) === wantedSub || norm(item.label) === wantedSub) ??
        subs.find(
          (item) => norm(item.label).includes(wantedSub) || wantedSub.includes(norm(item.id)),
        ))
      : undefined) ??
    subs.find((item) => norm(item.id) === wanted || norm(item.label) === wanted);

  return {
    category_id: categoryIdOf(category),
    category_name: category.name,
    sub_category_id: sub?.id ?? "",
    sub_category_label: sub?.label ?? "",
  };
}

/** Distinct shelf types implied by a set of planogram rows. */
export function selectionsFromPlanogramRows(
  categories: ShelfCategory[],
  rows: Array<{ category?: string | null; sub_category?: string | null }>,
): CategorySelection[] {
  const out: CategorySelection[] = [];
  for (const row of rows) {
    const resolved = resolveSelection(
      categories,
      String(row.category ?? ""),
      String(row.sub_category ?? ""),
    );
    if (resolved) out.push(resolved);
  }
  return dedupeSelections(out);
}

/** Legacy single-field audit/assignment context → one selection. */
export function selectionsFromLegacy(
  categories: ShelfCategory[],
  category: string | null | undefined,
  subCategory: string | null | undefined,
): CategorySelection[] {
  const resolved = resolveSelection(categories, String(category ?? ""), String(subCategory ?? ""));
  if (resolved) return [resolved];
  const name = String(category ?? "").trim();
  if (!name) return [];
  return [
    {
      category_id: slugifyCategory(name),
      category_name: name,
      sub_category_id: "",
      sub_category_label: String(subCategory ?? "").trim(),
    },
  ];
}
