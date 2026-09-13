import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FALLBACK_CATEGORIES, type ShelfCategory } from "@/lib/categories.data";
import { fetchShelfCategories } from "@/lib/categories.functions";
import type { LandingScanContext } from "@/lib/landing-audit-api";

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

export function useDemoCategory(): {
  state: DemoCategoryState;
  setState: (next: DemoCategoryState) => void;
  categories: ShelfCategory[];
  ready: boolean;
  context: LandingScanContext;
} {
  // Upload flow starts empty on purpose — the visitor must name their own shelf.
  const [state, setState] = useState<DemoCategoryState>(EMPTY_DEMO_CATEGORY_STATE);


  const categoriesQuery = useQuery({
    queryKey: ["shelf-categories", "landing"],
    queryFn: () => fetchShelfCategories(),
    retry: false,
    staleTime: 10 * 60_000,
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

export function DemoCategoryPicker({
  state,
  onChange,
  categories,
  disabled = false,
  helperText = "Tell AI what type of shelf you're auditing",
}: {
  state: DemoCategoryState;
  onChange: (next: DemoCategoryState) => void;
  categories: ShelfCategory[];
  disabled?: boolean;
  helperText?: string;
}) {
  const category = categories.find((item) => item.name === state.categoryName);
  const subcategories = category?.subcategories ?? [];

  return (
    <div className="mx-auto mt-7 max-w-2xl">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 text-left">
          <Label htmlFor="demo-category" className="text-xs">
            Category
          </Label>
          <Select
            value={state.categoryName}
            disabled={disabled}
            onValueChange={(value) => onChange({ categoryName: value, subId: "", customSub: "" })}
          >
            <SelectTrigger id="demo-category" className="min-h-11">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((item) => (
                <SelectItem key={item.name} value={item.name}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 text-left">
          <Label htmlFor="demo-subcategory" className="text-xs">
            Sub-category
          </Label>
          <Select
            value={state.subId}
            disabled={disabled || subcategories.length === 0}
            onValueChange={(value) => onChange({ ...state, subId: value, customSub: "" })}
          >
            <SelectTrigger id="demo-subcategory" className="min-h-11">
              <SelectValue placeholder="Select sub-category" />
            </SelectTrigger>
            <SelectContent>
              {subcategories.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {state.subId === "others" && (
        <Input
          value={state.customSub}
          disabled={disabled}
          onChange={(event) => onChange({ ...state, customSub: event.target.value })}
          placeholder="Describe this shelf type"
          className="mt-3 min-h-11"
        />
      )}

      <p className="mt-2 text-center text-xs text-muted-foreground">{helperText}</p>
    </div>
  );
}
