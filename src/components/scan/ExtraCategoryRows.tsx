import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ShelfCategory } from "@/lib/categories.data";
import { categoryIdOf, dedupeSelections, type CategorySelection } from "@/lib/category-selections";

type Row = { key: number; categoryName: string; subId: string; customSub: string };

function rowFromSelection(selection: CategorySelection, key: number): Row {
  return {
    key,
    categoryName: selection.category_name,
    subId: selection.sub_category_id,
    customSub: selection.sub_category_custom ?? "",
  };
}

function selectionFromRow(row: Row, categories: ShelfCategory[]): CategorySelection | null {
  const category = categories.find((item) => item.name === row.categoryName);
  if (!category) return null;
  const subcategories = category.subcategories ?? [];
  const isOthersCategory = subcategories.length === 0;
  const needsCustom = isOthersCategory || row.subId === "others";
  if (!isOthersCategory && !row.subId) return null;
  if (needsCustom && !row.customSub.trim()) return null;
  const sub = subcategories.find((item) => item.id === row.subId);
  return {
    category_id: categoryIdOf(category),
    category_name: category.name,
    sub_category_id: isOthersCategory ? "others" : row.subId,
    sub_category_label: isOthersCategory ? "Others" : (sub?.label ?? ""),
    ...(needsCustom ? { sub_category_custom: row.customSub.trim() } : {}),
  };
}

/** Extra shelf types laid out exactly like the primary Category / Sub-category picker. */
export function ExtraCategoryRows({
  value,
  onChange,
  categories,
  maxRows,
  disabled = false,
}: {
  value: CategorySelection[];
  onChange: (next: CategorySelection[]) => void;
  categories: ShelfCategory[];
  maxRows: number;
  disabled?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(() => value.map((s, i) => rowFromSelection(s, i)));
  const [nextKey, setNextKey] = useState(value.length);

  function commit(next: Row[]) {
    setRows(next);
    onChange(
      dedupeSelections(
        next
          .map((row) => selectionFromRow(row, categories))
          .filter((s): s is CategorySelection => s != null),
      ),
    );
  }

  function updateRow(key: number, patch: Partial<Row>) {
    commit(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows([...rows, { key: nextKey, categoryName: "", subId: "", customSub: "" }]);
    setNextKey(nextKey + 1);
  }

  const atMax = rows.length >= maxRows;

  return (
    <div className="mx-auto max-w-2xl text-left">
      <p className="text-sm font-medium text-foreground">More categories on this shelf (optional)</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Mixed rack? Add every other category and sub-category in the photo so those products are not
        flagged as misplaced.
      </p>

      <div className="mt-3 space-y-3">
        {rows.map((row, index) => {
          const category = categories.find((item) => item.name === row.categoryName);
          const subcategories = category?.subcategories ?? [];
          const isOthersCategory = Boolean(category) && subcategories.length === 0;
          const needsCustom = isOthersCategory || row.subId === "others";
          const categoryId = `extra-category-${row.key}`;
          const subId = `extra-subcategory-${row.key}`;
          return (
            <div key={row.key}>
              <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-1.5">
                  <Label htmlFor={categoryId} className="text-xs">
                    Category
                  </Label>
                  <Select
                    value={row.categoryName}
                    disabled={disabled}
                    onValueChange={(next) =>
                      updateRow(row.key, { categoryName: next, subId: "", customSub: "" })
                    }
                  >
                    <SelectTrigger id={categoryId} className="min-h-11">
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

                <div className="space-y-1.5">
                  <Label htmlFor={subId} className="text-xs">
                    Sub-category
                  </Label>
                  <Select
                    value={row.subId}
                    disabled={disabled || subcategories.length === 0}
                    onValueChange={(next) =>
                      updateRow(row.key, { subId: next, customSub: next === "others" ? row.customSub : "" })
                    }
                  >
                    <SelectTrigger id={subId} className="min-h-11">
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

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11 text-muted-foreground"
                  disabled={disabled}
                  aria-label={`Remove category ${index + 1}`}
                  onClick={() => commit(rows.filter((r) => r.key !== row.key))}
                >
                  <X className="size-4" />
                </Button>
              </div>

              {needsCustom ? (
                <Input
                  value={row.customSub}
                  disabled={disabled}
                  onChange={(event) => updateRow(row.key, { customSub: event.target.value })}
                  placeholder="Describe this shelf type"
                  className="mt-3 min-h-11"
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 min-h-11"
        disabled={disabled || atMax}
        onClick={addRow}
      >
        <Plus className="size-4" /> Add another category
      </Button>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        {atMax
          ? `Maximum ${maxRows} extra categories added.`
          : `Add up to ${maxRows} more categories for mixed racks.`}
      </p>
    </div>
  );
}
