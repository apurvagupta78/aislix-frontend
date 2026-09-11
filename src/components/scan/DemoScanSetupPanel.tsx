import { useRef, useState } from "react";
import { IndianRupee, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

import {

  DemoCategoryPicker,

  type DemoCategoryState,

} from "@/components/scan/DemoCategoryPicker";

import { ScanContextPanel, type ScanContextPanelHandle } from "@/components/scan/ScanContextPanel";

import type { ShelfCategory } from "@/lib/categories.data";

import { hasPricingConfigured, pricingSetupMessage, type ScanContextState } from "@/lib/scan-context";



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
  const scanContextRef = useRef<ScanContextPanelHandle>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const pricingReady = hasPricingConfigured(scanContext);

  const pricingHint = pricingSetupMessage(scanContext);

  const canStart = ready && !disabled;

  function handleStart() {
    setStartError(null);
    const next = scanContextRef.current?.flushPendingManualRow() ?? scanContext;
    if (next !== scanContext) onScanContextChange(next);
    const hint = pricingSetupMessage(next);
    if (hint) {
      setStartError(hint);
      return;
    }
    onStart();
  }

  return (

    <div className="py-4 sm:py-6">

      <p className="mx-auto mb-5 max-w-lg text-center text-sm text-muted-foreground">

        {mode === "sample"

          ? "Pick shelf category, add your products with prices, then scan the sample photo."

          : "Pick shelf category, add products with shelf prices, then upload your shelf photo."}

      </p>



      <DemoCategoryPicker

        state={state}

        onChange={onChange}

        categories={categories}

        disabled={disabled}

      />



      <div className="mt-5 overflow-hidden rounded-2xl border-2 border-brand/30 bg-gradient-to-br from-brand-soft/60 to-background shadow-sm">

        <div className="flex items-center gap-2 border-b border-brand/20 bg-brand/5 px-4 py-3">

          <IndianRupee className="size-4 text-brand" />

          <p className="text-sm font-semibold text-foreground">Products &amp; prices (required)</p>

        </div>

        <ScanContextPanel
          ref={scanContextRef}
          value={scanContext}
          onChange={onScanContextChange}
          defaultCategory={defaultCategory}
          defaultSubCategory={defaultSubCategory}
          defaultOpen
          requirePricing
          embedded
        />

      </div>



      {!ready && (

        <p className="mt-3 text-center text-xs text-muted-foreground">

          Select category and sub-category to continue.

        </p>

      )}

      {ready && !pricingReady && pricingHint && !startError && (
        <p className="mt-3 text-center text-xs font-medium text-amber-700 dark:text-amber-400">
          {pricingHint}
        </p>
      )}

      {startError ? (
        <p className="mt-3 text-center text-xs font-medium text-destructive">{startError}</p>
      ) : null}

      <div className="mt-6 flex justify-center">

        <Button

          size="xl"

          className="min-h-11 w-full bg-brand sm:w-auto"

          disabled={!canStart}

          onClick={handleStart}

        >

          <Sparkles className="size-4" /> Start Scanning

        </Button>

      </div>

    </div>

  );

}

