import { useRef, useState } from "react";
import { ClipboardList, Info, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DemoCategoryPicker,
  type DemoCategoryState,
} from "@/components/scan/DemoCategoryPicker";
import {
  NewPlanogramWizard,
  type NewPlanogramWizardHandle,
} from "@/components/planogram/NewPlanogramWizard";
import type { ShelfCategory } from "@/lib/categories.data";
import {
  buildDemoOralCareScanContext,
  DEMO_ORAL_CARE_META,
  DEMO_ORAL_CARE_ROWS,
  DEMO_PLANOGRAM_LABEL,
} from "@/lib/demo-oral-care-planogram";
import type { ScanContextState } from "@/lib/scan-context";

export type DemoPlanogramMode = "demo" | "custom" | "none";

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
  planogramMode?: DemoPlanogramMode;
  onPlanogramModeChange?: (mode: DemoPlanogramMode) => void;
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
  planogramMode: planogramModeProp,
  onPlanogramModeChange,
}: DemoScanSetupPanelProps) {
  const wizardRef = useRef<NewPlanogramWizardHandle>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [internalMode, setInternalMode] = useState<DemoPlanogramMode>(mode === "sample" ? "demo" : "none");
  const planogramMode = planogramModeProp ?? internalMode;

  function setPlanogramMode(next: DemoPlanogramMode) {
    onPlanogramModeChange?.(next);
    if (planogramModeProp == null) setInternalMode(next);
    if (next === "demo" && mode === "sample") {
      onScanContextChange(buildDemoOralCareScanContext(scanContext.auditRole));
    } else if (next === "none") {
      onScanContextChange({ ...scanContext, planogramRows: [], auditPackage: { assortment_skus: [], msl_skus: [], price_requirements: [], promotions: [] } });
    }
  }

  const canStart = ready && !disabled;
  const showDemoPlanogram = mode === "sample" && planogramMode === "demo";
  const showWizard = planogramMode === "custom";

  function handleStart() {
    setStartError(null);
    let next: ScanContextState;
    if (showDemoPlanogram) {
      next = buildDemoOralCareScanContext(scanContext.auditRole);
    } else if (showWizard) {
      next = wizardRef.current?.flush() ?? scanContext;
    } else {
      next = { ...scanContext, planogramRows: [] };
    }
    onScanContextChange(next);
    onStart(next);
  }

  return (
    <div className="py-4 sm:py-6">
      <p className="mx-auto mb-5 max-w-lg text-center text-sm text-muted-foreground">
        {mode === "sample"
          ? "Pick shelf category and role, then scan the sample photo. A pre-built demo planogram loads automatically so you can see full KPI results."
          : "Pick shelf category, optionally configure a planogram, then upload your shelf photo."}
      </p>

      <DemoCategoryPicker
        state={state}
        onChange={onChange}
        categories={categories}
        disabled={disabled}
      />

      {mode === "sample" ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={planogramMode === "demo" ? "default" : "outline"}
            className={planogramMode === "demo" ? "bg-brand" : ""}
            disabled={disabled}
            onClick={() => setPlanogramMode("demo")}
          >
            Demo planogram (auto)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={planogramMode === "custom" ? "default" : "outline"}
            className={planogramMode === "custom" ? "bg-brand" : ""}
            disabled={disabled}
            onClick={() => setPlanogramMode("custom")}
          >
            Custom planogram
          </Button>
          <Button
            type="button"
            size="sm"
            variant={planogramMode === "none" ? "default" : "outline"}
            disabled={disabled}
            onClick={() => setPlanogramMode("none")}
          >
            No planogram
          </Button>
        </div>
      ) : null}

      {showDemoPlanogram ? (
        <div className="mt-5 overflow-hidden rounded-2xl border-2 border-brand/30 bg-gradient-to-br from-brand-soft/60 to-background shadow-sm">
          <div className="flex items-center gap-2 border-b border-brand/20 bg-brand/5 px-4 py-3">
            <ClipboardList className="size-4 text-brand" />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{DEMO_ORAL_CARE_META.name}</p>
                <Badge variant="secondary" className="text-[10px]">
                  {DEMO_PLANOGRAM_LABEL}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {DEMO_ORAL_CARE_META.planogram_id} · {DEMO_ORAL_CARE_META.store_outlet} · Fixture{" "}
                {DEMO_ORAL_CARE_META.fixture_id}
              </p>
            </div>
          </div>
          <div className="space-y-2 p-4 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">18 demo SKUs</span> ·{" "}
              {DEMO_ORAL_CARE_ROWS.length} positions · 87 planned facings · 5 shelves · prices,
              promotion, MSL &amp; Share of Shelf configured.
            </p>
            <p className="flex items-start gap-1.5 rounded-md border border-border/80 bg-muted/30 px-3 py-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-brand" />
              Fictional reference data for demonstration — not verified from the photograph (GTINs,
              prices, dimensions).
            </p>
          </div>
        </div>
      ) : null}

      {showWizard ? (
        <div className="mt-5 overflow-hidden rounded-2xl border-2 border-brand/30 bg-gradient-to-br from-brand-soft/60 to-background shadow-sm">
          <div className="flex items-center gap-2 border-b border-brand/20 bg-brand/5 px-4 py-3">
            <ClipboardList className="size-4 text-brand" />
            <div>
              <p className="text-sm font-semibold text-foreground">New planogram (optional)</p>
              <p className="text-[11px] text-muted-foreground">
                Role at Step 1 controls which KPIs can be calculated
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
      ) : null}

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
