import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
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
import { cn } from "@/lib/utils";
import type { ShelfCategory } from "@/lib/categories.data";
import {
  categoryIdOf,
  selectionKey,
  selectionLabel,
  type CategorySelection,
} from "@/lib/category-selections";

export type CategorySubcategoryPickerProps = {
  value: CategorySelection[];
  onChange: (next: CategorySelection[]) => void;
  categories: ShelfCategory[];
  minSelections?: number;
  maxSelections?: number;
  disabled?: boolean;
  readOnly?: boolean;
  label?: string;
  helper?: string;
  error?: string | undefined;
  className?: string;
};

const DEFAULT_HELPER =
  "Retail racks often mix product types. Add every category and subcategory you see on this shelf — it helps Aislix detect products more accurately.";

export function CategorySubcategoryPicker({
  value,
  onChange,
  categories,
  minSelections = 1,
  maxSelections = 8,
  disabled = false,
  readOnly = false,
  label = "Shelf types on this rack *",
  helper = DEFAULT_HELPER,
  error,
  className,
}: CategorySubcategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState("");
  const [draftSub, setDraftSub] = useState("");
  const [draftCustom, setDraftCustom] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  const selectedCategory = useMemo(
    () => categories.find((item) => item.name === draftCategory),
    [categories, draftCategory],
  );
  const subcategories = selectedCategory?.subcategories ?? [];
  const isOthersCategory = Boolean(selectedCategory) && subcategories.length === 0;
  const needsCustom = isOthersCategory || draftSub === "others";
  const atMax = value.length >= maxSelections;

  function resetDraft(): void {
    setDraftCategory("");
    setDraftSub("");
    setDraftCustom("");
    setDraftError(null);
  }

  function add(): void {
    if (!selectedCategory) {
      setDraftError("Select a category.");
      return;
    }
    if (!isOthersCategory && subcategories.length > 0 && !draftSub) {
      setDraftError("Select a subcategory.");
      return;
    }
    if (needsCustom && !draftCustom.trim()) {
      setDraftError("Describe the shelf type.");
      return;
    }
    const sub = subcategories.find((item) => item.id === draftSub);
    const next: CategorySelection = {
      category_id: categoryIdOf(selectedCategory),
      category_name: selectedCategory.name,
      sub_category_id: isOthersCategory ? "others" : draftSub,
      sub_category_label: isOthersCategory ? "Others" : (sub?.label ?? ""),
      ...(needsCustom ? { sub_category_custom: draftCustom.trim() } : {}),
    };
    if (value.some((item) => selectionKey(item) === selectionKey(next))) {
      toast.error("Already added");
      return;
    }
    onChange([...value, next]);
    resetDraft();
    setOpen(false);
  }

  function remove(index: number): void {
    if (value.length <= minSelections) {
      toast.error("Add another shelf type before removing this one.");
      return;
    }
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}

      <div className="flex flex-wrap gap-2 pt-1">
        {value.length === 0 && (
          <p className="text-xs text-muted-foreground">No shelf types added yet.</p>
        )}
        {value.map((selection, index) => {
          const removable = !readOnly && !disabled && value.length > minSelections;
          return (
            <span
              key={`${selectionKey(selection)}-${index}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground"
              title={`${selection.category_name} · ${selectionLabel(selection)}`}
            >
              <span className="truncate">
                {selection.category_name} · {selectionLabel(selection)}
              </span>
              {removable && (
                <button
                  type="button"
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  onClick={() => remove(index)}
                >
                  <X className="size-3.5" />
                  <span className="sr-only">
                    Remove {selection.category_name} · {selectionLabel(selection)}
                  </span>
                </button>
              )}
            </span>
          );
        })}
      </div>

      {!readOnly && (
        <>
          {open ? (
            <div className="mt-2 space-y-3 rounded-2xl border border-border bg-surface p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <Select
                    value={draftCategory}
                    onValueChange={(next) => {
                      setDraftCategory(next);
                      setDraftSub("");
                      setDraftCustom("");
                      setDraftError(null);
                    }}
                    disabled={disabled}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[320px]">
                      {categories.map((item) => (
                        <SelectItem key={item.name} value={item.name} className="py-2">
                          <span className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{item.name}</span>
                            {item.examples ? (
                              <span className="text-xs text-muted-foreground">{item.examples}</span>
                            ) : null}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!isOthersCategory && subcategories.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Subcategory</Label>
                    <Select
                      value={draftSub}
                      onValueChange={(next) => {
                        setDraftSub(next);
                        if (next !== "others") setDraftCustom("");
                        setDraftError(null);
                      }}
                      disabled={disabled}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select a subcategory" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[320px]">
                        {subcategories.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {needsCustom && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs text-muted-foreground">Describe shelf type</Label>
                    <Input
                      className="rounded-xl"
                      placeholder="e.g. Imported chocolates end-cap"
                      value={draftCustom}
                      disabled={disabled}
                      onChange={(event) => {
                        setDraftCustom(event.target.value);
                        setDraftError(null);
                      }}
                    />
                  </div>
                )}
              </div>

              {draftError && <p className="text-xs text-destructive">{draftError}</p>}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="brand"
                  size="sm"
                  className="rounded-xl"
                  disabled={disabled}
                  onClick={add}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => {
                    resetDraft();
                    setOpen(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="subtle"
              size="sm"
              className="mt-1 rounded-xl"
              disabled={disabled || atMax}
              onClick={() => setOpen(true)}
            >
              <Plus className="size-4" /> Add shelf type
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            {atMax
              ? `Maximum ${maxSelections} shelf types added.`
              : `Add up to ${maxSelections} shelf types for mixed racks.`}
          </p>
        </>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
