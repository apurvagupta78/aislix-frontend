import { useRef, useState } from "react";
import { Camera, ClipboardList, ImagePlus, Info, Sparkles } from "lucide-react";

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
  onStart: (ctx: ScanContextState) => void;
  scanContext: ScanContextState;
  onScanContextChange: (next: ScanContextState) => void;
  defaultCategory?: string;
  defaultSubCategory?: string;
  planogramMode?: DemoPlanogramMode;
  onPlanogramModeChange?: (mode: DemoPlanogramMode) => void;
  /** Upload mode — shelf photo selected */
  hasPhoto?: boolean;
  previewImageUrl?: string | null;
  onPickUploadPhoto?: () => void;
  onTakeMobilePhoto?: () => void;
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
  hasPhoto = false,
  previewImageUrl,
  onPickUploadPhoto,
  onTakeMobilePhoto,
}: DemoScanSetupPanelProps) {
  const wizardRef = useRef<NewPlanogramWizardHandle>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [internalMode, setInternalMode] = useState<DemoPlanogramMode>(
    mode === "sample" ? "demo" : "none",
  );
  const planogramMode = planogramModeProp ?? internalMode;

  function setPlanogramMode(next: DemoPlanogramMode) {
    onPlanogramModeChange?.(next);
    if (planogramModeProp == null) setInternalMode(next);
    if (next === "demo" && mode === "sample") {
      onScanContextChange(buildDemoOralCareScanContext(scanContext.auditRole));
    } else if (next === "none") {
      onScanContextChange({
        ...scanContext,
        planogramRows: [],
        auditPackage: { assortment_skus: [], msl_skus: [], price_requirements: [], promotions: [] },
      });
    }
  }

  const showDemoPlanogram = mode === "sample" && planogramMode === "demo";
  const showWizard = planogramMode === "custom";
  const uploadReady = mode === "upload" ? ready && hasPhoto : ready;
  const canStart = uploadReady && !disabled;

  function handleStart() {
    setStartError(null);
    if (mode === "upload" && !hasPhoto) {
      setStartError("Add a shelf photo before scanning.");
      return;
    }
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
          ? "Pick shelf category and role, then scan the sample photo. A pre-built demo planogram loads automatically."
          : "Pick shelf category, optionally upload your planogram CSV, add a shelf photo, then start the scan."}
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
      ) : (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={planogramMode === "custom" ? "default" : "outline"}
            className={planogramMode === "custom" ? "bg-brand" : ""}
            disabled={disabled}
            onClick={() => setPlanogramMode("custom")}
          >
            <ClipboardList className="size-3.5" /> Custom planogram
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
      )}

      {mode === "upload" ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface/80">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Your shelf photo</p>
            <p className="text-[11px] text-muted-foreground">
              Upload from your device or take a photo with your phone camera
            </p>
          </div>
          <div className="flex flex-col items-center gap-4 p-4 sm:flex-row sm:items-start">
            {previewImageUrl ? (
              <img
                src={previewImageUrl}
                alt="Shelf preview"
                className="max-h-40 w-full max-w-[200px] rounded-lg border border-border object-contain sm:max-h-48"
              />
            ) : (
              <div className="flex h-32 w-full max-w-[200px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
                No photo yet
              </div>
            )}
            <div className="flex w-full flex-1 flex-col gap-2 sm:max-w-xs">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                disabled={disabled}
                onClick={onPickUploadPhoto}
              >
                <ImagePlus className="size-4" /> Upload shelf photo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                disabled={disabled}
                onClick={onTakeMobilePhoto}
              >
                <Camera className="size-4" /> Take photo on mobile
              </Button>
              {!hasPhoto ? (
                <p className="text-[11px] text-muted-foreground">
                  On mobile, &quot;Take photo&quot; opens your camera. On desktop, it opens your webcam or
                  file picker.
                </p>
              ) : null}
            </div>
          </div>
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
              {DEMO_ORAL_CARE_ROWS.length} positions · 87 planned facings · 5 shelves
            </p>
            <p className="flex items-start gap-1.5 rounded-md border border-border/80 bg-muted/30 px-3 py-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-brand" />
              Fictional demo reference data — not verified from the photograph.
            </p>
          </div>
        </div>
      ) : null}

      {showWizard ? (
        <div className="mt-5 overflow-hidden rounded-2xl border-2 border-brand/30 bg-gradient-to-br from-brand-soft/60 to-background shadow-sm">
          <div className="flex items-center gap-2 border-b border-brand/20 bg-brand/5 px-4 py-3">
            <ClipboardList className="size-4 text-brand" />
            <div>
              <p className="text-sm font-semibold text-foreground">Custom planogram</p>
              <p className="text-[11px] text-muted-foreground">
                Import CSV or enter products manually — role at Step 1 drives KPI requirements
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

      {mode === "upload" && ready && !hasPhoto ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Upload or take a shelf photo to enable scanning.
        </p>
      ) : null}

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
