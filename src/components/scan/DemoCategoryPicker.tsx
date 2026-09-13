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
import type { DemoCategoryState } from "@/components/scan/use-demo-category";

export {
  DEFAULT_DEMO_CATEGORY,
  DEFAULT_DEMO_SUBCATEGORY,
  EMPTY_DEMO_CATEGORY_STATE,
  useDemoCategory,
  type DemoCategoryState,
} from "@/components/scan/use-demo-category";

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
