import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FALLBACK_CATEGORIES, type ShelfCategory } from "@/lib/categories.data";
import { fetchShelfCategories } from "@/lib/categories.functions";
import type { LandingScanContext } from "@/lib/landing-scan-api";

export const DEFAULT_DEMO_CATEGORY = "Personal Care";
export const DEFAULT_DEMO_SUBCATEGORY = "toothpaste";

export type DemoCategoryState = {
  categoryName: string;
  subId: string;
  customSub: string;
};

export const EMPTY_DEMO_CATEGORY_STATE: DemoCategoryState = {
  categoryName: "",
  subId: "",
  customSub: "",
};

export function useDemoCategory(options?: { enabled?: boolean }): {
  state: DemoCategoryState;
  setState: (next: DemoCategoryState) => void;
  categories: ShelfCategory[];
  ready: boolean;
  context: LandingScanContext;
} {
  const enabled = options?.enabled ?? true;
  // Upload flow starts empty on purpose — the visitor must name their own shelf.
  const [state, setState] = useState<DemoCategoryState>(EMPTY_DEMO_CATEGORY_STATE);

  const categoriesQuery = useQuery({
    queryKey: ["shelf-categories", "landing"],
    queryFn: () => fetchShelfCategories(),
    retry: false,
    staleTime: 10 * 60_000,
    enabled,
  });
  const categories: ShelfCategory[] = categoriesQuery.data?.length
    ? categoriesQuery.data
    : FALLBACK_CATEGORIES;

  const category = useMemo(
    () => categories.find((item) => item.name === state.categoryName),
    [categories, state.categoryName],
  );
  const sub = (category?.subcategories ?? []).find((item) => item.id === state.subId);
  const needsCustom = state.subId === "others";
  const ready = Boolean(category && sub && (!needsCustom || state.customSub.trim()));

  const context: LandingScanContext = {
    category: category?.name ?? "",
    sub_category: sub?.id ?? "",
    sub_category_label: needsCustom ? state.customSub.trim() : (sub?.label ?? ""),
  };

  return { state, setState, categories, ready, context };
}
