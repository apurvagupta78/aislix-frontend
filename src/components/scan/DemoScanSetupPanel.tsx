import { useRef, useState } from "react";
import { ClipboardList, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DemoCategoryPicker,
  type DemoCategoryState,
} from "@/components/scan/DemoCategoryPicker";
import {
  NewPlanogramWizard,
  type NewPlanogramWizardHandle,
} from "@/components/planogram/NewPlanogramWizard";
import type { ShelfCategory } from "@/lib/categories.data";
import { pricingSetupMessage, type ScanContextState } from "@/lib/scan-context";

type DemoScanSetupPanelProps = {
  mode: "sample" | "upload";
  state: DemoCategoryState;
  onChange: (next: DemoCategoryState) => void;
  categories: ShelfCategory[];
  ready: boolean;
  disabled?: boolean;
  /** Called with flushed planogram context — use this for results enrichment, not stale React state. */
  onStart: (ctx: ScanContextState) => void;
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
  const wizardRef = useRef<NewPlanogramWizardHandle>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const canStart = ready && !disabled;

  function handleStart() {
    setStartError(null);
    const next = wizardRef.current?.flush() ?? scanContext;
    onScanContextChange(next);
    const validation = wizardRef.current?.validate() ?? pricingSetupMessage(next);
    if (validation) {
      setStartError(validation);
      return;
    }
    onStart(next);
  }

  return (
    <div className="py-4 sm:py-6">
      <p className="mx-auto mb-5 max-w-lg text-center text-sm text-muted-foreground">
        {mode === "sample"
          ? "Pick shelf category, build a role-based planogram (step-by-step), then scan the sample photo."
          : "Pick shelf category, build a role-based planogram (step-by-step), then upload your shelf photo."}
      </p>

      <DemoCategoryPicker
        state={state}
        onChange={onChange}
        categories={categories}
        disabled={disabled}
      />

      <div className="mt-5 overflow-hidden rounded-2xl border-2 border-brand/30 bg-gradient-to-br from-brand-soft/60 to-background shadow-sm">
        <div className="flex items-center gap-2 border-b border-brand/20 bg-brand/5 px-4 py-3">
          <ClipboardList className="size-4 text-brand" />
          <div>
            <p className="text-sm font-semibold text-foreground">New planogram (required)</p>
            <p className="text-[11px] text-muted-foreground">
              Step-by-step — role at Step 1 controls which sections you need
            </p>
          </div>
        </div>

        <div className="p-4">
          <NewPlanogramWizard
            ref={wizardRef}
            value={scanContext}
            onChange={onScanContextChange}
            categories={categories}
            defaultCategory={defaultCategory}
            defaultSubCategory={defaultSubCategory}
            defaultLocation="A-1"
          />
        </div>
      </div>

      {!ready && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Select category and sub-category to continue.
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
