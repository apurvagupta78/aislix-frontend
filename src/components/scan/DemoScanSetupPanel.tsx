import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DemoCategoryPicker,
  type DemoCategoryState,
} from "@/components/scan/DemoCategoryPicker";
import { ScanContextPanel } from "@/components/scan/ScanContextPanel";
import type { ShelfCategory } from "@/lib/categories.data";
import type { ScanContextState } from "@/lib/scan-context";

type DemoScanSetupPanelProps = {
  mode: "sample" | "upload";
  state: DemoCategoryState;
  onChange: (next: DemoCategoryState) => void;
  categories: ShelfCategory[];
  ready: boolean;
  disabled?: boolean;
  onStart: () => void;
  scanContext: ScanContextState;
  onScanContextChange: (next: ScanContextState) => void;
  defaultCategory?: string;
  defaultSubCategory?: string;
};

export function DemoScanSetupPanel({
  mode,
  state,
  onChange,
  categories,
  ready,
  disabled = false,
  onStart,
  scanContext,
  onScanContextChange,
  defaultCategory,
  defaultSubCategory,
}: DemoScanSetupPanelProps) {
  return (
    <div className="py-4 sm:py-6">
      <p className="mx-auto mb-5 max-w-lg text-center text-sm text-muted-foreground">
        {mode === "sample"
          ? "Confirm shelf category, optionally add your company focus or planogram, then start scanning the sample photo below."
          : "Tell AI what type of shelf you're auditing, optionally add a planogram, then start scanning."}
      </p>

      <DemoCategoryPicker
        state={state}
        onChange={onChange}
        categories={categories}
        disabled={disabled}
      />

      <ScanContextPanel
        value={scanContext}
        onChange={onScanContextChange}
        defaultCategory={defaultCategory}
        defaultSubCategory={defaultSubCategory}
        className="mt-5"
      />

      {!ready && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Select category and sub-category to enable scanning.
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
