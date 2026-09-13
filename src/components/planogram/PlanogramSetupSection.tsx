import { useRef, useState, type RefObject } from "react";
import { ArrowRight, Check, ClipboardList, Layers3, Package, Tag, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HomepageRolePicker } from "@/components/planogram/HomepageRolePicker";
import {
  MasterShelfSetupPanel,
  type MasterSetupPhase,
} from "@/components/planogram/MasterShelfSetupPanel";
import {
  NewPlanogramWizard,
  type NewPlanogramWizardHandle,
} from "@/components/planogram/NewPlanogramWizard";
import {
  PLANOGRAM_SAMPLE_OPTIONS,
  PLANOGRAM_UPLOAD_OPTIONS,
  PlanogramModeOption,
  type PlanogramModeChoice,
} from "@/components/planogram/PlanogramModeOption";
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
  HOMEPAGE_AUDIT_WITHOUT_PLANOGRAM,
  HOMEPAGE_DEMO_READY_CARD,
  HOMEPAGE_DEMO_READY_CHECKLIST,
  HOMEPAGE_DISTRIBUTOR_SETUP,
  HOMEPAGE_SHELF_SETUP_FLOW,
  HOMEPAGE_START_AUDIT_CTA,
} from "@/lib/planogram-wizard-homepage-copy";
import { HOMEPAGE_DISTRIBUTOR_OUTLET } from "@/lib/planogram-wizard-homepage-role-flow";
import { defaultAuditRoleTab, type AuditRoleTab } from "@/lib/role-audit-ui";
import type { ScanContextState } from "@/lib/scan-context";
import { cn } from "@/lib/utils";

type CustomSetupPath = "choose" | "master" | "manual";

const NO_PLANOGRAM_CAPABILITY_ICONS = {
  products_brands: Package,
  availability_facings: Layers3,
  prices_promotions: Tag,
  shelf_issues: TriangleAlert,
} as const;

const DEMO_PRODUCT_COUNT = new Set(DEMO_ORAL_CARE_ROWS.map((row) => row.sku)).size;

export type PlanogramSetupSectionProps = {
  variant: "homepage" | "dashboard";
  flowMode: "sample" | "upload";
  planogramMode: PlanogramModeChoice;
  onPlanogramModeChange: (mode: PlanogramModeChoice) => void;
  scanContext: ScanContextState;
  onScanContextChange: (next: ScanContextState) => void;
  categories: ShelfCategory[];
  categoryName?: string;
  subCategoryLabel?: string;
  onSyncCategoryFromContext?: (ctx: ScanContextState) => void;
  disabled?: boolean;
  wizardRef?: RefObject<NewPlanogramWizardHandle | null>;
  /** Homepage inline start — dashboard omits */
  showInlineStart?: boolean;
  canStart?: boolean;
  onStart?: () => void;
  startError?: string | null;
  hasPhoto?: boolean;
  defaultCategory?: string;
  defaultSubCategory?: string;
  defaultLocation?: string;
};

export function PlanogramSetupSection({
  variant,
  flowMode,
  planogramMode,
  onPlanogramModeChange,
  scanContext,
  onScanContextChange,
  categories,
  categoryName = "",
  subCategoryLabel = "",
  onSyncCategoryFromContext,
  disabled = false,
  wizardRef: wizardRefProp,
  showInlineStart = false,
  canStart = true,
  onStart,
  startError,
  hasPhoto = false,
  defaultCategory,
  defaultSubCategory,
  defaultLocation = "A-1",
}: PlanogramSetupSectionProps) {
  const internalWizardRef = useRef<NewPlanogramWizardHandle>(null);
  const wizardRef = wizardRefProp ?? internalWizardRef;
  const homepageIntro = variant === "homepage";

  const [customSetupPath, setCustomSetupPath] = useState<CustomSetupPath>("choose");
  const [masterPhase, setMasterPhase] = useState<MasterSetupPhase>("upload");
  const [masterImport, setMasterImport] = useState<MasterImportResult | null>(null);

  const auditRole = defaultAuditRoleTab(scanContext.auditRole);

  function setAuditRole(nextRole: AuditRoleTab) {
    if (planogramMode === "demo" && flowMode === "sample") {
      onScanContextChange(buildDemoOralCareScanContext(nextRole));
      return;
    }
    onScanContextChange({ ...scanContext, auditRole: nextRole });
  }

  function setPlanogramMode(next: PlanogramModeChoice) {
    onPlanogramModeChange(next);
    if (next === "demo" && flowMode === "sample") {
      onScanContextChange(buildDemoOralCareScanContext(scanContext.auditRole));
    } else if (next === "custom") {
      setCustomSetupPath("choose");
      setMasterPhase("upload");
      setMasterImport(null);
      onScanContextChange({
        ...scanContext,
        planogramRows: homepageIntro ? [] : scanContext.planogramRows,
        planogramMeta: {
          ...(scanContext.planogramMeta ?? EMPTY_PLANOGRAM_META),
          category: categoryName || scanContext.planogramMeta?.category || "",
          sub_category: categoryName
            ? subCategoryLabel
            : scanContext.planogramMeta?.sub_category || "",
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

  const useMasterFlow = homepageIntro || variant === "dashboard";
  const showDemoPlanogram = flowMode === "sample" && planogramMode === "demo";
  const showMasterSetup =
    useMasterFlow &&
    planogramMode === "custom" &&
    customSetupPath !== "manual" &&
    masterPhase !== "ready";
  const showMasterReady =
    useMasterFlow &&
    planogramMode === "custom" &&
    masterPhase === "ready" &&
    customSetupPath !== "manual";
  const showWizard =
    planogramMode === "custom" && (!useMasterFlow || customSetupPath === "manual");
  const showManualSetupOption =
    useMasterFlow &&
    planogramMode === "custom" &&
    customSetupPath === "choose" &&
    masterPhase === "upload";

  const auditBlockReason = homepageIntro
    ? homepageCustomAuditBlockReason(
        planogramMode,
        scanContext.planogramRows,
        flowMode === "upload",
        hasPhoto,
      )
    : null;

  const handleStart = () => onStart?.();

  const modeOptions = flowMode === "sample" ? PLANOGRAM_SAMPLE_OPTIONS : PLANOGRAM_UPLOAD_OPTIONS;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5">
        <HomepageRolePicker value={auditRole} onChange={setAuditRole} />
      </div>

      <div
        className={cn(
          "mt-5 grid gap-2",
          flowMode === "sample" ? "sm:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {modeOptions.map((option) => (
          <PlanogramModeOption
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
                {showInlineStart ? (
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
                ) : null}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{DEMO_PRODUCT_COUNT} demo SKUs</span> ·{" "}
                {DEMO_ORAL_CARE_ROWS.length} positions
              </p>
            )}
          </div>
        </div>
      ) : null}

      {planogramMode === "none" ? (
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
          {showInlineStart ? (
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
          ) : null}
        </div>
      ) : null}

      {showMasterSetup ? (
        <div className="mt-5 space-y-4">
          <MasterShelfSetupPanel
            role={auditRole}
            disabled={disabled}
            phase={masterPhase}
            onPhaseChange={setMasterPhase}
            importResult={masterImport}
            onImportResult={setMasterImport}
            canStartAudit={canStart}
            onContextReady={(ctx) => {
              const merged: ScanContextState = {
                ...ctx,
                auditRole,
                planogramMeta: {
                  ...(ctx.planogramMeta ?? EMPTY_PLANOGRAM_META),
                  category: ctx.planogramMeta?.category || categoryName,
                  sub_category: ctx.planogramMeta?.sub_category || subCategoryLabel,
                },
              };
              onScanContextChange(merged);
              onSyncCategoryFromContext?.(merged);
              setCustomSetupPath("master");
            }}
            onStartAudit={handleStart}
            onReviewSetup={() => setCustomSetupPath("manual")}
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
                disabled={disabled}
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
                  <p className="text-sm font-semibold text-foreground">Set Up Your Shelf</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Same wizard as the homepage demo — upload a master CSV or configure step by step
                    for role-based compliance KPIs.
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
              manualEntryOnly={useMasterFlow && customSetupPath === "manual"}
              value={scanContext}
              onChange={onScanContextChange}
              categories={categories}
              defaultCategory={defaultCategory}
              defaultSubCategory={defaultSubCategory}
              defaultLocation={defaultLocation}
              homepageStartAudit={
                showInlineStart && homepageIntro
                  ? {
                      disabled: !canStart,
                      disabledReason: auditBlockReason ?? startError ?? null,
                      onStart: handleStart,
                    }
                  : undefined
              }
            />
          </div>
        </div>
      ) : null}

      {startError ? (
        <p className="mt-3 text-center text-xs font-medium text-destructive">{startError}</p>
      ) : null}
    </>
  );
}
