import { useRef, useState } from "react";
import { ArrowRight, Camera, ClipboardList, ImagePlus, Info, Sparkles } from "lucide-react";

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
  DEMO_ORAL_CARE_PLANNED_FACINGS,
  DEMO_ORAL_CARE_ROWS,
  DEMO_PLANOGRAM_LABEL,
} from "@/lib/demo-oral-care-planogram";
import { EMPTY_PLANOGRAM_META } from "@/lib/planogram-meta";
import { EMPTY_AUDIT_PACKAGE } from "@/lib/planogram-audit-package";
import { homepageCustomAuditBlockReason } from "@/lib/planogram-wizard-homepage-readiness";
import {
  getBrowserTimezone,
  HOMEPAGE_DEMO_ASSORTMENT_STATUS,
  HOMEPAGE_DEMO_LAYOUT_STATUS,
  HOMEPAGE_DEMO_PRICES_STATUS,
  HOMEPAGE_DEMO_PROMOTIONS_STATUS,
  HOMEPAGE_DEMO_SCORING_STATUS,
  HOMEPAGE_NO_PLANOGRAM_PRICES,
  HOMEPAGE_NO_PLANOGRAM_PROMOTIONS,
  HOMEPAGE_DEMO_PRODUCTS_STATUS,
  HOMEPAGE_NO_PLANOGRAM_ASSORTMENT,
  HOMEPAGE_NO_PLANOGRAM_LAYOUT,
  HOMEPAGE_NO_PLANOGRAM_PRODUCTS,
  HOMEPAGE_SHELF_SETUP_FLOW,
} from "@/lib/planogram-wizard-homepage-copy";
import type { ScanContextState } from "@/lib/scan-context";
import { cn } from "@/lib/utils";

export type DemoPlanogramMode = "demo" | "custom" | "none";

const DEMO_PRODUCT_COUNT = new Set(DEMO_ORAL_CARE_ROWS.map((row) => row.sku)).size;

const HOMEPAGE_SAMPLE_OPTIONS: Array<{
  mode: DemoPlanogramMode;
  label: string;
  detail: string;
  recommended?: boolean;
}> = [
  {
    mode: "demo",
    label: "Use Demo Setup",
    detail: "Recommended for the free demo.",
    recommended: true,
  },
  {
    mode: "custom",
    label: "Use My Planogram",
    detail: "Compare the shelf against your own planogram.",
  },
  {
    mode: "none",
    label: "Audit Without Planogram",
    detail: "Analyse the visible shelf without an expected layout.",
  },
];

const HOMEPAGE_UPLOAD_OPTIONS: Array<{
  mode: DemoPlanogramMode;
  label: string;
  detail: string;
}> = [
  {
    mode: "custom",
    label: "Use My Planogram",
    detail: "Compare the shelf against your own planogram.",
  },
  {
    mode: "none",
    label: "Audit Without Planogram",
    detail: "Analyse the visible shelf without an expected layout.",
  },
];

type DemoScanSetupPanelProps = {
  mode: "sample" | "upload";
  homepageIntro?: boolean;
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

function HomepagePlanogramOption({
  label,
  detail,
  selected,
  recommended,
  disabled,
  onClick,
}: {
  label: string;
  detail: string;
  selected: boolean;
  recommended?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border-brand bg-brand-soft/50 shadow-sm"
          : "border-border bg-card hover:border-brand/30",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        {recommended ? (
          <Badge variant="secondary" className="text-[10px] font-medium">
            Recommended
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{detail}</p>
    </button>
  );
}

export function DemoScanSetupPanel({
  mode,
  homepageIntro = false,
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

  function resolveSubCategoryLabel(next: DemoCategoryState): string {
    if (next.subId === "others") return next.customSub.trim();
    const category = categories.find((item) => item.name === next.categoryName);
    const sub = category?.subcategories?.find((item) => item.id === next.subId);
    return sub?.label ?? "";
  }

  function syncPlanogramMetaFromPicker(next: DemoCategoryState) {
    if (!next.categoryName) return;
    onScanContextChange({
      ...scanContext,
      planogramMeta: {
        ...(scanContext.planogramMeta ?? EMPTY_PLANOGRAM_META),
        category: next.categoryName,
        sub_category: resolveSubCategoryLabel(next),
      },
    });
  }

  function handleCategoryChange(next: DemoCategoryState) {
    onChange(next);
    syncPlanogramMetaFromPicker(next);
  }

  function setPlanogramMode(next: DemoPlanogramMode) {
    onPlanogramModeChange?.(next);
    if (planogramModeProp == null) setInternalMode(next);
    if (next === "demo" && mode === "sample") {
      onScanContextChange(buildDemoOralCareScanContext(scanContext.auditRole));
    } else if (next === "custom") {
      if (!state.categoryName) return;
      onScanContextChange({
        ...scanContext,
        planogramRows: homepageIntro ? [] : scanContext.planogramRows,
        planogramMeta: {
          ...(scanContext.planogramMeta ?? EMPTY_PLANOGRAM_META),
          category: state.categoryName,
          sub_category: resolveSubCategoryLabel(state),
        },
        ...(homepageIntro
          ? {
              auditPackage: {
                ...(scanContext.auditPackage ?? EMPTY_AUDIT_PACKAGE),
                assortment_skus: [],
                msl_skus: [],
                price_requirements: [],
                promotions: [],
                scoring: {},
                store_timezone: getBrowserTimezone(),
              },
            }
          : {}),
      });
    } else if (next === "none") {
      onScanContextChange({
        ...scanContext,
        planogramRows: [],
        auditPackage: {
          assortment_skus: [],
          msl_skus: [],
          price_requirements: [],
          promotions: [],
          scoring: {},
        },
      });
    }
  }

  const showDemoPlanogram = mode === "sample" && planogramMode === "demo";
  const showWizard = planogramMode === "custom";
  const uploadReady = mode === "upload" ? ready && hasPhoto : ready;
  const auditBlockReason = homepageIntro
    ? homepageCustomAuditBlockReason(
        planogramMode,
        scanContext.planogramRows,
        mode === "upload",
        hasPhoto,
      )
    : null;
  const canStart = uploadReady && !disabled && !auditBlockReason;
  /** Custom wizard has its own Start Audit CTA on Step 8 — avoid duplicating it below. */
  const hideBottomStartButton = homepageIntro && showWizard;

  function handleStart() {
    setStartError(null);
    if (mode === "upload" && !hasPhoto) {
      setStartError(
        homepageIntro
          ? "Add a shelf photo before starting the audit."
          : "Add a shelf photo before scanning.",
      );
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
      {homepageIntro ? (
        <div className="mx-auto mb-5 max-w-lg text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            SET UP YOUR FREE AI AUDIT
          </p>
          <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Tell Aislix What You&apos;re Auditing.
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Choose the type of shelf you want to analyse. Aislix will use the sample shelf and its
            demo reference data to show you how a real retail audit works.
          </p>
        </div>
      ) : (
        <p className="mx-auto mb-5 max-w-lg text-center text-sm text-muted-foreground">
          {mode === "sample"
            ? "Pick shelf category and role, then scan the sample photo. A pre-built demo planogram loads automatically."
            : "Pick shelf category, optionally upload your planogram CSV, add a shelf photo, then start the scan."}
        </p>
      )}

      <DemoCategoryPicker
        state={state}
        onChange={handleCategoryChange}
        categories={categories}
        disabled={disabled}
        helperText={
          homepageIntro
            ? "This helps Aislix understand what it's looking at."
            : undefined
        }
      />

      {homepageIntro ? (
        <div
          className={cn(
            "mt-5 grid gap-2",
            mode === "sample" ? "sm:grid-cols-3" : "sm:grid-cols-2",
          )}
        >
          {(mode === "sample" ? HOMEPAGE_SAMPLE_OPTIONS : HOMEPAGE_UPLOAD_OPTIONS).map((option) => (
            <HomepagePlanogramOption
              key={option.mode}
              label={option.label}
              detail={option.detail}
              recommended={"recommended" in option ? option.recommended : false}
              selected={planogramMode === option.mode}
              disabled={disabled}
              onClick={() => setPlanogramMode(option.mode)}
            />
          ))}
        </div>
      ) : mode === "sample" ? (
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
              {homepageIntro ? (
                <>
                  <p className="text-sm font-semibold text-foreground">Demo Shelf Setup</p>
                  <p className="text-xs text-foreground/90">Oral Care · Main Gondola</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Pre-configured demo reference ready
                  </p>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
          <div className="space-y-2 p-4 text-xs text-muted-foreground">
            {homepageIntro ? (
              <>
                <p className="font-medium text-brand">{HOMEPAGE_DEMO_PRODUCTS_STATUS.title}</p>
                <p className="font-medium text-foreground">
                  {HOMEPAGE_DEMO_PRODUCTS_STATUS.summary(
                    DEMO_PRODUCT_COUNT,
                    DEMO_ORAL_CARE_META.shelf_count ?? 5,
                    DEMO_ORAL_CARE_ROWS.length,
                  )}
                </p>
                <p className="mt-2 font-medium text-brand">{HOMEPAGE_DEMO_LAYOUT_STATUS.title}</p>
                <p className="font-medium text-foreground">
                  {HOMEPAGE_DEMO_LAYOUT_STATUS.summary(
                    DEMO_ORAL_CARE_ROWS.length,
                    DEMO_ORAL_CARE_PLANNED_FACINGS,
                  )}
                </p>
                <p className="mt-2 font-medium text-brand">{HOMEPAGE_DEMO_ASSORTMENT_STATUS.title}</p>
                <p className="mt-2 font-medium text-brand">{HOMEPAGE_DEMO_PRICES_STATUS.title}</p>
                <p className="mt-2 font-medium text-brand">{HOMEPAGE_DEMO_PROMOTIONS_STATUS.title}</p>
                <p className="mt-2 font-medium text-brand">{HOMEPAGE_DEMO_SCORING_STATUS.title}</p>
              </>
            ) : (
              <p>
                <span className="font-medium text-foreground">18 demo SKUs</span> ·{" "}
                {DEMO_ORAL_CARE_ROWS.length} positions · 87 planned facings · 5 shelves
              </p>
            )}
            <p className="flex items-start gap-1.5 rounded-md border border-border/80 bg-muted/30 px-3 py-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-brand" />
              {homepageIntro
                ? HOMEPAGE_DEMO_PRODUCTS_STATUS.note
                : "Fictional demo reference data — not verified from the photograph."}
            </p>
          </div>
        </div>
      ) : null}

      {homepageIntro && planogramMode === "none" ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <p className="text-sm font-semibold text-foreground">{HOMEPAGE_NO_PLANOGRAM_PRODUCTS.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {HOMEPAGE_NO_PLANOGRAM_PRODUCTS.description}
          </p>
          <p className="mt-4 text-sm font-semibold text-foreground">
            {HOMEPAGE_NO_PLANOGRAM_LAYOUT.title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {HOMEPAGE_NO_PLANOGRAM_LAYOUT.description}
          </p>
          <p className="mt-4 text-sm font-semibold text-foreground">
            {HOMEPAGE_NO_PLANOGRAM_ASSORTMENT.title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {HOMEPAGE_NO_PLANOGRAM_ASSORTMENT.description}
          </p>
          <p className="mt-4 text-sm font-semibold text-foreground">
            {HOMEPAGE_NO_PLANOGRAM_PRICES.title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {HOMEPAGE_NO_PLANOGRAM_PRICES.description}
          </p>
          <p className="mt-4 text-sm font-semibold text-foreground">
            {HOMEPAGE_NO_PLANOGRAM_PROMOTIONS.title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {HOMEPAGE_NO_PLANOGRAM_PROMOTIONS.description}
          </p>
          <Button
            type="button"
            size="lg"
            className="mt-4 bg-brand"
            disabled={!canStart}
            onClick={handleStart}
          >
            {HOMEPAGE_NO_PLANOGRAM_PRODUCTS.cta} <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : null}

      {showWizard ? (
        <div className="mt-5 overflow-hidden rounded-2xl border-2 border-brand/30 bg-gradient-to-br from-brand-soft/60 to-background shadow-sm">
          <div className="flex items-center gap-2 border-b border-brand/20 bg-brand/5 px-4 py-3">
            <ClipboardList className="size-4 shrink-0 text-brand" />
            <div className="flex-1">
              {homepageIntro ? (
                <>
                  <p className="text-sm font-semibold text-foreground">Set Up Your Shelf</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Tell Aislix what should be on this shelf, where products belong and how the shelf
                    should be arranged. Aislix will use this setup as the reference for your audit.
                  </p>
                  <p className="mt-2 text-[10px] leading-snug text-muted-foreground/90">
                    {HOMEPAGE_SHELF_SETUP_FLOW}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">Custom planogram</p>
                  <p className="text-[11px] text-muted-foreground">
                    Import CSV or enter products manually — role at Step 1 drives KPI requirements
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="p-4">
            <NewPlanogramWizard
              ref={wizardRef}
              homepageIntro={homepageIntro}
              planogramMode={planogramMode}
              value={scanContext}
              onChange={onScanContextChange}
              categories={categories}
              defaultCategory={defaultCategory}
              defaultSubCategory={defaultSubCategory}
              defaultLocation="A-1"
              homepageStartAudit={
                homepageIntro
                  ? {
                      disabled: !canStart,
                      disabledReason: auditBlockReason ?? startError,
                      onStart: handleStart,
                    }
                  : undefined
              }
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
          {homepageIntro
            ? "Upload or take a shelf photo to start the audit."
            : "Upload or take a shelf photo to enable scanning."}
        </p>
      ) : null}

      {startError ? (
        <p className="mt-3 text-center text-xs font-medium text-destructive">{startError}</p>
      ) : null}

      {!hideBottomStartButton ? (
        <div className="mt-6 flex flex-col items-center gap-2">
          {homepageIntro && auditBlockReason ? (
            <p className="max-w-md text-center text-xs font-medium text-destructive">
              {auditBlockReason}
            </p>
          ) : null}
          <Button
            size="xl"
            className="min-h-11 w-full bg-brand sm:w-auto"
            disabled={!canStart}
            onClick={handleStart}
          >
            {homepageIntro ? (
              <>
                Start Audit <ArrowRight className="size-4" />
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Start Scanning
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
