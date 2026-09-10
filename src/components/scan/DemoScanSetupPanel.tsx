import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DemoCategoryPicker,
  type DemoCategoryState,
} from "@/components/scan/DemoCategoryPicker";
import type { ShelfCategory } from "@/lib/categories.data";

type DemoScanSetupPanelProps = {
  mode: "sample" | "upload";
  state: DemoCategoryState;
  onChange: (next: DemoCategoryState) => void;
  categories: ShelfCategory[];
  ready: boolean;
  disabled?: boolean;
  onStart: () => void;
};

export function DemoScanSetupPanel({
  mode,
  state,
  onChange,
  categories,
  ready,
  disabled = false,
  onStart,
}: DemoScanSetupPanelProps) {
  return (
    <div className="py-6 sm:py-8">
      <p className="mx-auto mb-6 max-w-md text-center text-sm text-muted-foreground">
        {mode === "sample"
          ? "Confirm the shelf category for the sample photo below, then start scanning."
          : "Tell AI what type of shelf you're auditing, then start scanning your photo."}
      </p>
      <DemoCategoryPicker
        state={state}
        onChange={onChange}
        categories={categories}
        disabled={disabled}
      />
      {!ready && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Select category and sub-category to continue.
        </p>
      )}
      <div className="mt-6 flex justify-center">
        <Button
          size="xl"
          className="min-h-11 w-full sm:w-auto"
          disabled={!ready || disabled}
          onClick={onStart}
        >
          <Sparkles className="size-4" /> Start Scanning
        </Button>
      </div>
    </div>
  );
}
