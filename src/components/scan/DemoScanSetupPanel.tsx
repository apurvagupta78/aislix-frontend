import { useRef, useState } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Camera,
  Check,
  ClipboardList,
  Image as ImageIcon,
  ImagePlus,
  Layers3,
  LayoutGrid,
  Package,
  Sparkles,
  Tag,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DemoCategoryPicker,
  type DemoCategoryState,
} from "@/components/scan/DemoCategoryPicker";
import { HomepageRolePicker } from "@/components/planogram/HomepageRolePicker";
import {
  MasterShelfSetupPanel,
  type MasterSetupPhase,
} from "@/components/planogram/MasterShelfSetupPanel";
import {
  NewPlanogramWizard,
  type NewPlanogramWizardHandle,
} from "@/components/planogram/NewPlanogramWizard";
import type { MasterImportResult } from "@/lib/master-shelf-setup";
import type { ShelfCategory } from "@/lib/categories.data";
import {
  buildDemoOralCareScanContext,
  DEMO_ORAL_CARE_META,
  DEMO_ORAL_CARE_ROWS,
  DEMO_PLANOGRAM_LABEL,
} from "@/lib/demo-oral-care-planogram";
import { EMPTY_PLANOGRAM_META } from "@/lib/planogram-meta";
import { EMPTY_AUDIT_PACKAGE } from "@/lib/planogram-audit-package";
import { homepageCustomAuditBlockReason } from "@/lib/planogram-wizard-homepage-readiness";
import {
  getBrowserTimezone,
  HOMEPAGE_DEMO_READY_CARD,
  HOMEPAGE_DEMO_READY_CHECKLIST,
  HOMEPAGE_FREE_AUDIT_INTRO,
  HOMEPAGE_AUDIT_WITHOUT_PLANOGRAM,
  HOMEPAGE_DISTRIBUTOR_SETUP,
  HOMEPAGE_SHELF_SETUP_FLOW,
  HOMEPAGE_START_AUDIT_CTA,
} from "@/lib/planogram-wizard-homepage-copy";
import { HOMEPAGE_DISTRIBUTOR_OUTLET } from "@/lib/planogram-wizard-homepage-role-flow";
import { defaultAuditRoleTab, type AuditRoleTab } from "@/lib/role-audit-ui";
import type { ScanContextState } from "@/lib/scan-context";
import { cn } from "@/lib/utils";

export type DemoPlanogramMode = "demo" | "custom" | "none";
type CustomSetupPath = "choose" | "master" | "manual";

const DEMO_PRODUCT_COUNT = new Set(DEMO_ORAL_CARE_ROWS.map((row) => row.sku)).size;

const NO_PLANOGRAM_CAPABILITY_ICONS = {
  products_brands: Package,
  availability_facings: Layers3,
  prices_promotions: Tag,
  shelf_issues: TriangleAlert,
} as const;

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
  const [customSetupPath, setCustomSetupPath] = useState<CustomSetupPath>("choose");
  const [masterPhase, setMasterPhase] = useState<MasterSetupPhase>("upload");
  const [masterImport, setMasterImport] = useState<MasterImportResult | null>(null);
  const [internalMode, setInternalMode] = useState<DemoPlanogramMode>(
    mode === "sample" ? "demo" : "none",
  );
  const planogramMode = planogramModeProp ?? internalMode;
  const auditRole = defaultAuditRoleTab(scanContext.auditRole);

  function setAuditRole(nextRole: AuditRoleTab) {
    if (planogramMode === "demo" && mode === "sample") {
      onScanContextChange(buildDemoOralCareScanContext(nextRole));
      return;
    }
    onScanContextChange({ ...scanContext, auditRole: nextRole });
  }

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
      setCustomSetupPath("choose");
      setMasterPhase("upload");
      setMasterImport(null);
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
  const showMasterSetup =
    homepageIntro &&
    planogramMode === "custom" &&
    customSetupPath !== "manual" &&
    masterPhase !== "ready";
  const showMasterReady =
    homepageIntro && planogramMode === "custom" && masterPhase === "ready" && customSetupPath !== "manual";
  const showWizard = planogramMode === "custom" && (!homepageIntro || customSetupPath === "manual");
  const showManualSetupOption =
    homepageIntro && planogramMode === "custom" && customSetupPath === "choose" && masterPhase === "upload";
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
  /** Wizard, no-planogram, and demo cards include their own start actions on homepage. */
  const hideBottomStartButton =
    homepageIntro &&
    (showWizard || planogramMode === "none" || showDemoPlanogram || showMasterReady || showMasterSetup);

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
    } else if (planogramMode === "custom" && masterPhase === "ready") {
      next = scanContext;
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
            {HOMEPAGE_FREE_AUDIT_INTRO}
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
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5">
          <HomepageRolePicker value={auditRole} onChange={setAuditRole} />
        </div>
      ) : null}

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
                  <p className="text-sm font-semibold text-foreground">
                    {HOMEPAGE_DEMO_READY_CARD.title}
                  </p>
                  <p className="text-xs text-foreground/90">Oral Care · Main Gondola</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {HOMEPAGE_DEMO_READY_CARD.subtitle}
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
          <div className="space-y-3 p-4">
            {homepageIntro ? (
              <>
                <p className="text-sm font-medium text-foreground">
                  {HOMEPAGE_DEMO_READY_CARD.summaryLine}
                </p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {HOMEPAGE_DEMO_READY_CHECKLIST.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="size-4 shrink-0 text-success" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {HOMEPAGE_DEMO_READY_CARD.valueMessage}
                </p>
                <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                    <div className="flex min-w-[7.5rem] flex-1 items-start gap-2 rounded-lg bg-card/80 px-2.5 py-2">
                      <LayoutGrid className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                          {HOMEPAGE_DEMO_READY_CARD.expectedShelf.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {HOMEPAGE_DEMO_READY_CARD.expectedShelf.detail}
                        </p>
                      </div>
                    </div>
                    <ArrowLeftRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div className="flex min-w-[7.5rem] flex-1 items-start gap-2 rounded-lg bg-card/80 px-2.5 py-2">
                      <ImageIcon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                          {HOMEPAGE_DEMO_READY_CARD.actualShelf.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {HOMEPAGE_DEMO_READY_CARD.actualShelf.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-2.5 text-center text-[11px] font-medium text-foreground">
                    {HOMEPAGE_DEMO_READY_CARD.comparisonResult}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">{HOMEPAGE_DEMO_READY_CARD.ctaHint}</p>
                <Button
                  type="button"
                  size="lg"
                  className="w-full bg-brand sm:w-auto"
                  disabled={!canStart}
                  onClick={handleStart}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {HOMEPAGE_START_AUDIT_CTA}
                    <ArrowRight className="size-4" aria-hidden />
                  </span>
                </Button>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {HOMEPAGE_DEMO_READY_CARD.disclosure}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">18 demo SKUs</span> ·{" "}
                  {DEMO_ORAL_CARE_ROWS.length} positions · 87 planned facings · 5 shelves
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Fictional demo reference data — not verified from the photograph.
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}

      {homepageIntro && planogramMode === "none" ? (
        <div className="mt-5 overflow-hidden rounded-2xl border-2 border-brand/20 bg-gradient-to-br from-brand-soft/40 to-background p-5 shadow-soft sm:p-6">
          <p className="text-base font-semibold text-foreground">
            {HOMEPAGE_AUDIT_WITHOUT_PLANOGRAM.title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {HOMEPAGE_AUDIT_WITHOUT_PLANOGRAM.introduction}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {HOMEPAGE_AUDIT_WITHOUT_PLANOGRAM.capabilities.map((item) => {
              const Icon = NO_PLANOGRAM_CAPABILITY_ICONS[item.id];
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-border/80 bg-card/80 p-3"
                >
                  <div className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                    <div>
                      <p className="text-[11px] font-semibold tracking-wide text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            {HOMEPAGE_AUDIT_WITHOUT_PLANOGRAM.limitation}
          </p>
          {auditRole === "distributor" ? (
            <div className="mt-4 space-y-3 rounded-xl border border-border/80 bg-card/80 p-4">
              <p className="text-sm font-medium text-foreground">
                {HOMEPAGE_DISTRIBUTOR_OUTLET.heading}
              </p>
              <p className="text-xs text-muted-foreground">{HOMEPAGE_DISTRIBUTOR_SETUP.noneModeNote}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">{HOMEPAGE_DISTRIBUTOR_OUTLET.portfolioLabel}</Label>
                  <Input
                    className="h-9 rounded-lg"
                    placeholder="ABC Distribution"
                    value={scanContext.focus.company ?? ""}
                    onChange={(e) =>
                      onScanContextChange({
                        ...scanContext,
                        focus: { ...scanContext.focus, company: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{HOMEPAGE_DISTRIBUTOR_OUTLET.outletLabel}</Label>
                  <Input
                    className="h-9 rounded-lg"
                    placeholder="Outlet 102"
                    value={scanContext.planogramMeta?.store_outlet ?? ""}
                    onChange={(e) =>
                      onScanContextChange({
                        ...scanContext,
                        planogramMeta: {
                          ...(scanContext.planogramMeta ?? EMPTY_PLANOGRAM_META),
                          store_outlet: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>
            </div>
          ) : null}
          <Button
            type="button"
            size="lg"
            className="mt-5 w-full bg-brand sm:w-auto"
            disabled={!canStart}
            onClick={handleStart}
          >
            <span className="inline-flex items-center gap-1.5">
              {HOMEPAGE_START_AUDIT_CTA}
              <ArrowRight className="size-4" aria-hidden />
            </span>
          </Button>
        </div>
      ) : null}

      {showMasterSetup ? (
        <div className="mt-5 space-y-4">
          <MasterShelfSetupPanel
            role={auditRole}
            disabled={disabled || !ready}
            phase={masterPhase}
            onPhaseChange={setMasterPhase}
            importResult={masterImport}
            onImportResult={setMasterImport}
            canStartAudit={canStart}
            onContextReady={(ctx) => {
              onScanContextChange({
                ...ctx,
                auditRole: auditRole,
                planogramMeta: {
                  ...(ctx.planogramMeta ?? EMPTY_PLANOGRAM_META),
                  category: ctx.planogramMeta?.category || state.categoryName,
                  sub_category: ctx.planogramMeta?.sub_category || resolveSubCategoryLabel(state),
                },
              });
              setCustomSetupPath("master");
            }}
            onStartAudit={handleStart}
            onReviewSetup={() => {
              setCustomSetupPath("manual");
            }}
            onReplace={() => {
              setMasterPhase("upload");
              setMasterImport(null);
              setCustomSetupPath("choose");
            }}
          />
          {showManualSetupOption ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/15 px-4 py-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Or</p>
              <p className="text-sm text-muted-foreground">Prefer to set it up manually?</p>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={disabled || !ready}
                onClick={() => setCustomSetupPath("manual")}
              >
                Configure Step by Step
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {showMasterReady ? (
        <div className="mt-5">
          <MasterShelfSetupPanel
            role={auditRole}
            disabled={disabled}
            phase="ready"
            onPhaseChange={setMasterPhase}
            importResult={masterImport}
            onImportResult={setMasterImport}
            canStartAudit={canStart}
            onContextReady={onScanContextChange}
            onStartAudit={handleStart}
            onReviewSetup={() => setCustomSetupPath("manual")}
            onReplace={() => {
              setMasterPhase("upload");
              setMasterImport(null);
              setCustomSetupPath("choose");
            }}
          />
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
                    Aislix has tailored these steps for your role. Enter only the information relevant
                    to your audit — products, layout, and checks that matter to your business.
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
              <span className="inline-flex items-center gap-1.5">
                {HOMEPAGE_START_AUDIT_CTA}
                <ArrowRight className="size-4" aria-hidden />
              </span>
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
