/**
 * New Planogram — stepped wizard with role-specific sections (Aislix spec).
 * Used in demo scan and authenticated New Scan (with planogram mode).
 */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  FileJson,
  Loader2,
  Minus,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlanogramBuilder } from "@/components/planogram/PlanogramBuilder";
import { PlanogramPackageCsvImport } from "@/components/planogram/PlanogramPackageCsvImport";
import {
  AssortmentManualForm,
  PriceManualForm,
  PromotionManualForm,
} from "@/components/planogram/PlanogramWizardManualForms";
import { RoleTabSwitcher } from "@/components/scan-results/RoleTabSwitcher";
import type { ShelfCategory } from "@/lib/categories.data";
import { toDraftRow, type DraftRow, type PlanogramRow } from "@/lib/planogram";
import {
  ASSORTMENT_CSV_OPTIONAL_LABEL,
  ASSORTMENT_CSV_REQUIRED_LABEL,
} from "@/lib/planogram-assortment-template";
import {
  formatPriceBasisLabel,
  formatShelfPriceDate,
  PRICE_CSV_OPTIONAL_LABEL,
  PRICE_CSV_REQUIRED_LABEL,
} from "@/lib/planogram-price-template";
import {
  formatParticipatingProducts,
  formatPromotionDateRange,
  PROMOTION_CSV_OPTIONAL_LABEL,
  PROMOTION_CSV_REQUIRED_LABEL,
  promotionStatusLabel,
} from "@/lib/planogram-promotion-template";
import {
  autoPopulateAuditPackage,
  computeReadiness,
  EMPTY_AUDIT_PACKAGE,
  exportPlanogramPackageJson,
  mergeAssortmentLists,
  parsePlanogramPackageImport,
  splitAssortmentRows,
  type AssortmentEntry,
  type PlanogramAuditPackage,
  type PriceRequirement,
  type PromotionEntry,
} from "@/lib/planogram-audit-package";
import { EMPTY_PLANOGRAM_META, planogramIdFromName, type PlanogramMeta } from "@/lib/planogram-meta";
import {
  readinessKpisForRole,
  roleSettingsHint,
  roleSettingsTitle,
  wizardStepsForRole,
  type PlanogramWizardStepId,
} from "@/lib/planogram-wizard-config";
import { timezoneSelectOptions } from "@/lib/account";
import {
  DEMO_ORAL_CARE_META,
  DEMO_ORAL_CARE_PLANNED_FACINGS,
  DEMO_ORAL_CARE_ROWS,
} from "@/lib/demo-oral-care-planogram";
import {
  getBrowserTimezone,
  HOMEPAGE_ASSORTMENT_CSV,
  HOMEPAGE_ASSORTMENT_EMPTY,
  HOMEPAGE_ASSORTMENT_HEADLINE,
  HOMEPAGE_ASSORTMENT_HELP,
  HOMEPAGE_DEMO_ASSORTMENT_STATUS,
  HOMEPAGE_DEMO_PRICES_STATUS,
  HOMEPAGE_NO_PLANOGRAM_PRICES,
  HOMEPAGE_PRICES_CSV,
  HOMEPAGE_PRICES_EMPTY,
  HOMEPAGE_PRICES_TAB_HELPER,
  HOMEPAGE_DEMO_PROMOTIONS_STATUS,
  HOMEPAGE_NO_PLANOGRAM_PROMOTIONS,
  HOMEPAGE_PROMOTIONS_CSV,
  HOMEPAGE_PROMOTIONS_EMPTY,
  HOMEPAGE_PROMOTIONS_HEADLINE,
  HOMEPAGE_PROMOTIONS_TAB_HELPER,
  HOMEPAGE_DEMO_SCORING_STATUS,
  HOMEPAGE_SCORING_HEADLINE,
  HOMEPAGE_SCORING_NOT_CONFIGURED,
  HOMEPAGE_SCORING_NONE_MODE_KEYS,
  HOMEPAGE_SCORING_NOTE,
  HOMEPAGE_SCORING_TARGET_FIELDS,
  HOMEPAGE_SCORING_TARGET_HELP,
  HOMEPAGE_DEMO_LAYOUT_STATUS,
  HOMEPAGE_DEMO_PRODUCTS_STATUS,
  HOMEPAGE_LAYOUT_EXAMPLE,
  HOMEPAGE_NO_PLANOGRAM_ASSORTMENT,
  HOMEPAGE_NO_PLANOGRAM_LAYOUT,
  HOMEPAGE_NO_PLANOGRAM_PRODUCTS,
  HOMEPAGE_PRODUCTS_TABLE_DESCRIPTION,
  HOMEPAGE_PRODUCTS_TABLE_TITLE,
  HOMEPAGE_DEMO_READINESS_STATUS,
  HOMEPAGE_NONE_READINESS_STATUS,
  HOMEPAGE_READINESS_HEADLINE,
  HOMEPAGE_READINESS_STATUS_LABELS,
  HOMEPAGE_READINESS_SUMMARY_LABEL,
  HOMEPAGE_READINESS_TRUST,
  HOMEPAGE_WIZARD_STEP_COPY,
  homepageRequiredProductTypeLabel,
} from "@/lib/planogram-wizard-homepage-copy";
import {
  computeHomepageShelfChecks,
  summarizeHomepageReadiness,
} from "@/lib/planogram-wizard-homepage-readiness";
import { defaultAuditRoleTab, roleTabLabel, type AuditRoleTab } from "@/lib/role-audit-ui";
import { roleRequiresPricing } from "@/lib/role-planogram-requirements";
import type { ScanContextState } from "@/lib/scan-context";
import { cn } from "@/lib/utils";

export type NewPlanogramWizardHandle = {
  flush: () => ScanContextState;
  validate: () => string | null;
};

type NewPlanogramWizardProps = {
  value: ScanContextState;
  onChange: (next: ScanContextState) => void;
  categories: ShelfCategory[];
  defaultCategory?: string;
  defaultSubCategory?: string;
  defaultLocation?: string;
  compact?: boolean;
  className?: string;
  /** Simplified copy for homepage demo custom shelf setup */
  homepageIntro?: boolean;
  /** Homepage demo planogram mode — products step varies by mode */
  planogramMode?: "demo" | "custom" | "none";
  onStepChange?: (stepId: PlanogramWizardStepId) => void;
  homepageStartAudit?: {
    disabled: boolean;
    disabledReason?: string | null;
    onStart: () => void;
  };
};

function toDraftRows(rows: PlanogramRow[]): DraftRow[] {
  return rows.map((row, i) => ({
    ...row,
    key: `${row.sku || row.brand}-${row.product_name}-${i}`,
  }));
}

function fromDraftRows(rows: DraftRow[]): PlanogramRow[] {
  return rows.map(({ key: _key, ...row }) => row);
}

function mergeMeta(value: ScanContextState, patch: Partial<PlanogramMeta>): ScanContextState {
  const meta = { ...(value.planogramMeta ?? EMPTY_PLANOGRAM_META), ...patch };
  const auditPackage = {
    ...(value.auditPackage ?? EMPTY_AUDIT_PACKAGE),
    fixture_id: meta.store_outlet ? `${meta.store_outlet}-fixture` : value.auditPackage?.fixture_id,
    store_timezone: value.auditPackage?.store_timezone || "Asia/Kolkata",
  };
  return { ...value, planogramMeta: meta, auditPackage };
}

export const NewPlanogramWizard = forwardRef<NewPlanogramWizardHandle, NewPlanogramWizardProps>(
  function NewPlanogramWizard(
    {
      value,
      onChange,
      categories,
      defaultCategory = "Personal Care",
      defaultSubCategory = "Toothpaste",
      defaultLocation = "A-1",
      compact = false,
      className,
      homepageIntro = false,
      planogramMode = "custom",
      onStepChange,
      homepageStartAudit,
    },
    ref,
  ) {
    const role = defaultAuditRoleTab(value.auditRole);
    const steps = useMemo(
      () => wizardStepsForRole(role, { omitLayout: homepageIntro }),
      [role, homepageIntro],
    );
    const displaySteps = useMemo(
      () =>
        homepageIntro
          ? steps.map((step) => ({ ...step, ...HOMEPAGE_WIZARD_STEP_COPY[step.id] }))
          : steps,
      [steps, homepageIntro],
    );
    const [stepIndex, setStepIndex] = useState(0);
    const [promotionEditSeed, setPromotionEditSeed] = useState<PromotionEntry | null>(null);
    const currentStep = steps[stepIndex]?.id ?? "basics";

    useEffect(() => {
      setStepIndex((i) => Math.min(i, Math.max(steps.length - 1, 0)));
    }, [steps.length]);

    useEffect(() => {
      onStepChange?.(currentStep);
    }, [currentStep, onStepChange]);

    const meta = useMemo(() => {
      const stored = value.planogramMeta ?? EMPTY_PLANOGRAM_META;
      return {
        ...EMPTY_PLANOGRAM_META,
        ...stored,
        category: stored.category?.trim() || defaultCategory || EMPTY_PLANOGRAM_META.category,
        sub_category: stored.sub_category?.trim() || defaultSubCategory || "",
        store_outlet: stored.store_outlet?.trim() || defaultLocation || stored.store_outlet,
      };
    }, [value.planogramMeta, defaultCategory, defaultSubCategory, defaultLocation]);

    useEffect(() => {
      const stored = value.planogramMeta ?? EMPTY_PLANOGRAM_META;
      const patch: Partial<PlanogramMeta> = {};
      if (defaultCategory && stored.category !== defaultCategory) {
        patch.category = defaultCategory;
      }
      if (defaultSubCategory && stored.sub_category !== defaultSubCategory) {
        patch.sub_category = defaultSubCategory;
      }
      if (defaultLocation && !stored.store_outlet?.trim()) {
        patch.store_outlet = defaultLocation;
      }
      if (Object.keys(patch).length === 0) return;
      onChange(mergeMeta(value, patch));
    }, [defaultCategory, defaultSubCategory, defaultLocation]);
    const draftRows = useMemo(() => toDraftRows(value.planogramRows), [value.planogramRows]);
    const auditPackage = value.auditPackage ?? EMPTY_AUDIT_PACKAGE;
    const storeTimezone =
      auditPackage.store_timezone?.trim() ||
      (homepageIntro ? getBrowserTimezone() : "Asia/Kolkata");
    const allAssortment = mergeAssortmentLists(auditPackage.assortment_skus, auditPackage.msl_skus);
    const jsonInputRef = useRef<HTMLInputElement>(null);
    const [jsonBusy, setJsonBusy] = useState(false);

    useEffect(() => {
      if (!homepageIntro || auditPackage.store_timezone?.trim()) return;
      onChange({
        ...value,
        auditPackage: { ...auditPackage, store_timezone: getBrowserTimezone() },
      });
    }, [homepageIntro]);

    const patch = (next: ScanContextState) => onChange(next);

    const patchPackage = (partial: Partial<PlanogramAuditPackage>) =>
      patch({ ...value, auditPackage: { ...auditPackage, ...partial } });

    const homepageAuditPackagePopulateOpts = homepageIntro
      ? { skipAssortment: true, skipMsl: true, skipPrices: true }
      : undefined;

    const setRole = (nextRole: AuditRoleTab) => {
      setStepIndex(0);
      patch({
        ...value,
        auditRole: nextRole,
        auditPackage: autoPopulateAuditPackage(
          value.planogramRows,
          value.auditPackage ?? EMPTY_AUDIT_PACKAGE,
          homepageAuditPackagePopulateOpts,
        ),
      });
    };

    const setRows = (rows: DraftRow[]) => {
      const planogramRows = fromDraftRows(rows);
      if (homepageIntro) {
        patch({ ...value, planogramRows });
        return;
      }
      patch({
        ...value,
        planogramRows,
        auditPackage: autoPopulateAuditPackage(
          planogramRows,
          value.auditPackage ?? EMPTY_AUDIT_PACKAGE,
        ),
      });
    };

    useImperativeHandle(ref, () => ({
      flush: () => {
        const rows = value.planogramRows;
        const pkg = autoPopulateAuditPackage(
          rows,
          value.auditPackage ?? EMPTY_AUDIT_PACKAGE,
          homepageAuditPackagePopulateOpts,
        );
        const next = { ...value, auditPackage: pkg };
        onChange(next);
        return next;
      },
      validate: () => null,
    }));

    const readiness = computeReadiness(value.planogramRows, auditPackage);
    const roleKpis = new Set(readinessKpisForRole(role));
    const filteredReadiness = readiness.filter((r) => roleKpis.has(r.kpi_id as never));

    function renderStep(stepId: PlanogramWizardStepId) {
      switch (stepId) {
        case "basics":
          return (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {homepageIntro ? "Who is this audit for?" : "Audit role *"}
                </Label>
                <RoleTabSwitcher value={role} onChange={setRole} />
                <p className="text-xs text-muted-foreground">
                  {homepageIntro
                    ? "Your role determines which shelf checks and KPIs Aislix will use."
                    : "Role selection determines which planogram sections and KPIs apply to this audit."}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">
                    {homepageIntro ? "Shelf Setup Name *" : "Planogram name *"}
                  </Label>
                  <Input
                    className="h-9 rounded-lg"
                    placeholder="Oral Care A-1 — Sep 2026"
                    value={meta.name}
                    onChange={(e) => patch(mergeMeta(value, { name: e.target.value }))}
                  />
                  {meta.name.trim() && !homepageIntro ? (
                    <p className="text-[11px] text-muted-foreground">
                      ID: {planogramIdFromName(meta.name)} · Version: 1 · Status: Draft
                    </p>
                  ) : null}
                  {homepageIntro ? (
                    <p className="text-[11px] text-muted-foreground">
                      Give this shelf setup a name you&apos;ll recognise later.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Store / outlet *</Label>
                  <Input
                    className="h-9 rounded-lg"
                    placeholder={defaultLocation || "Store 102"}
                    value={meta.store_outlet}
                    onChange={(e) => patch(mergeMeta(value, { store_outlet: e.target.value }))}
                  />
                  {homepageIntro ? (
                    <p className="text-[11px] text-muted-foreground">
                      Where will this shelf be audited?
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fixture / rack *</Label>
                  <Input
                    className="h-9 rounded-lg"
                    placeholder="A-1-L"
                    value={auditPackage.fixture_id ?? ""}
                    onChange={(e) =>
                      patch({
                        ...value,
                        auditPackage: { ...auditPackage, fixture_id: e.target.value },
                      })
                    }
                  />
                  {homepageIntro ? (
                    <p className="text-[11px] text-muted-foreground">
                      Which rack or display does this setup belong to?
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Category *</Label>
                  <Input
                    className="h-9 rounded-lg"
                    value={meta.category}
                    onChange={(e) => patch(mergeMeta(value, { category: e.target.value }))}
                  />
                  {homepageIntro ? (
                    <p className="text-[11px] text-muted-foreground">
                      What type of products are on this shelf?
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Sub-category</Label>
                  <Input
                    className="h-9 rounded-lg"
                    value={meta.sub_category ?? ""}
                    onChange={(e) => patch(mergeMeta(value, { sub_category: e.target.value }))}
                  />
                  {homepageIntro ? (
                    <p className="text-[11px] text-muted-foreground">
                      Choose the more specific product group, if needed.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{homepageIntro ? "Start Date *" : "Valid from *"}</Label>
                  <Input
                    type="date"
                    className="h-9 rounded-lg"
                    value={meta.valid_from}
                    onChange={(e) => patch(mergeMeta(value, { valid_from: e.target.value }))}
                  />
                  {homepageIntro ? (
                    <p className="text-[11px] text-muted-foreground">
                      When does this shelf setup become active?
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Store Timezone *</Label>
                  <Select
                    value={storeTimezone}
                    onValueChange={(v) =>
                      patch({
                        ...value,
                        auditPackage: { ...auditPackage, store_timezone: v },
                      })
                    }
                  >
                    <SelectTrigger className="h-9 rounded-lg">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {timezoneSelectOptions(storeTimezone).map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {homepageIntro ? (
                    <p className="text-[11px] text-muted-foreground">
                      Used to evaluate time-sensitive prices and promotions correctly.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {homepageIntro ? "Shelf Measurement Unit *" : "Measurement unit *"}
                  </Label>
                  <Select
                    value={meta.measurement_unit}
                    onValueChange={(v) =>
                      patch(mergeMeta(value, { measurement_unit: v as PlanogramMeta["measurement_unit"] }))
                    }
                  >
                    <SelectTrigger className="h-9 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cm">cm</SelectItem>
                      <SelectItem value="inch">inch</SelectItem>
                      <SelectItem value="mm">mm</SelectItem>
                    </SelectContent>
                  </Select>
                  {homepageIntro ? (
                    <p className="text-[11px] text-muted-foreground">
                      Choose how shelf and product dimensions are measured.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="rounded-xl border border-brand/15 bg-brand-soft/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {homepageIntro
                        ? "Import or Export This Shelf Setup"
                        : "Full planogram package"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {homepageIntro
                        ? "Move your complete shelf setup in or out as a JSON file."
                        : "Import or export products, assortment, prices, promotions, and scoring in one JSON file."}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg border-brand/20"
                      onClick={() =>
                        exportPlanogramPackageJson(
                          meta.name || "planogram",
                          value.planogramRows,
                          auditPackage,
                        )
                      }
                    >
                      <FileJson className="mr-1.5 size-4" />{" "}
                      {homepageIntro ? "Export Setup" : "Export JSON"}
                    </Button>
                    <Button
                      type="button"
                      variant="brand"
                      size="sm"
                      className="rounded-lg"
                      disabled={jsonBusy}
                      onClick={() => jsonInputRef.current?.click()}
                    >
                      {jsonBusy ? (
                        <Loader2 className="mr-1.5 size-4 animate-spin" />
                      ) : (
                        <Upload className="mr-1.5 size-4" />
                      )}
                      {homepageIntro ? "Import Setup" : "Import JSON"}
                    </Button>
                  </div>
                </div>
                <input
                  ref={jsonInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setJsonBusy(true);
                    void file
                      .text()
                      .then((text) => {
                        const parsed = JSON.parse(text) as unknown;
                        const result = parsePlanogramPackageImport(parsed);
                        if (result.errors.length) {
                          toast.error("Could not import planogram package", {
                            description: result.errors.slice(0, 3).join(" · "),
                          });
                          return;
                        }
                        const rows = result.rows;
                        patch({
                          ...value,
                          planogramRows: rows.length ? rows : value.planogramRows,
                          auditPackage: result.auditPackage,
                          planogramMeta: result.name
                            ? { ...meta, name: result.name }
                            : value.planogramMeta,
                        });
                        toast.success("Planogram package imported", {
                          description: `${rows.length} product row(s) loaded.`,
                        });
                      })
                      .catch(() => toast.error("Invalid JSON file."))
                      .finally(() => setJsonBusy(false));
                  }}
                />
              </div>
            </div>
          );

        case "fixture":
          return (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {homepageIntro ? "Fixture Type" : "Fixture type"}
                </Label>
                <Select
                  value={meta.fixture_type ?? "gondola"}
                  onValueChange={(v) => patch(mergeMeta(value, { fixture_type: v }))}
                >
                  <SelectTrigger className="h-9 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["gondola", "wall_shelf", "rack", "refrigerator", "freezer", "display", "pick_shelf"].map(
                      (t) => (
                        <SelectItem key={t} value={t}>
                          {t.replace(/_/g, " ")}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                {homepageIntro ? (
                  <p className="text-[11px] text-muted-foreground">
                    What kind of shelf or display is this?
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {homepageIntro ? "Number of Shelves" : "Number of shelves"}
                </Label>
                <Input
                  type="number"
                  min={1}
                  className="h-9 rounded-lg"
                  value={meta.shelf_count ?? ""}
                  onChange={(e) =>
                    patch(mergeMeta(value, { shelf_count: Number(e.target.value) || undefined }))
                  }
                />
                {homepageIntro ? (
                  <p className="text-[11px] text-muted-foreground">How many shelf levels are there?</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {homepageIntro
                    ? `Fixture Width (${meta.measurement_unit})`
                    : `Fixture width (${meta.measurement_unit})`}
                </Label>
                <Input
                  type="number"
                  min={0}
                  className="h-9 rounded-lg"
                  value={meta.fixture_width ?? ""}
                  onChange={(e) =>
                    patch(mergeMeta(value, { fixture_width: Number(e.target.value) || undefined }))
                  }
                />
                {homepageIntro ? (
                  <p className="text-[11px] text-muted-foreground">
                    Enter the total width of the shelf.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {homepageIntro
                    ? `Fixture Height (${meta.measurement_unit})`
                    : `Fixture height (${meta.measurement_unit})`}
                </Label>
                <Input
                  type="number"
                  min={0}
                  className="h-9 rounded-lg"
                  value={meta.fixture_height ?? ""}
                  onChange={(e) =>
                    patch(mergeMeta(value, { fixture_height: Number(e.target.value) || undefined }))
                  }
                />
                {homepageIntro ? (
                  <p className="text-[11px] text-muted-foreground">
                    Enter the total height of the shelf.
                  </p>
                ) : null}
              </div>
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                {homepageIntro
                  ? "Accurate shelf dimensions help Aislix compare product positions and measure shelf space more precisely."
                  : "Shelf geometry supports Planogram Compliance, Location Accuracy, and Share of Shelf when calibrated. Leave blank if not yet measured — affected KPIs may show Not assessable."}
              </p>
            </div>
          );

        case "products":
          if (homepageIntro && planogramMode === "demo") {
            const demoProductCount = new Set(DEMO_ORAL_CARE_ROWS.map((row) => row.sku)).size;
            return (
              <div className="space-y-4 rounded-xl border border-brand/20 bg-brand-soft/20 p-4">
                <div>
                  <p className="font-medium text-brand">{HOMEPAGE_DEMO_PRODUCTS_STATUS.title}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {HOMEPAGE_DEMO_PRODUCTS_STATUS.summary(
                      demoProductCount,
                      DEMO_ORAL_CARE_META.shelf_count ?? 5,
                      DEMO_ORAL_CARE_ROWS.length,
                    )}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-brand">{HOMEPAGE_DEMO_LAYOUT_STATUS.title}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {HOMEPAGE_DEMO_LAYOUT_STATUS.summary(
                      DEMO_ORAL_CARE_ROWS.length,
                      DEMO_ORAL_CARE_PLANNED_FACINGS,
                    )}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">{HOMEPAGE_DEMO_PRODUCTS_STATUS.note}</p>
              </div>
            );
          }
          if (homepageIntro && planogramMode === "none") {
            return (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {HOMEPAGE_NO_PLANOGRAM_PRODUCTS.title}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {HOMEPAGE_NO_PLANOGRAM_PRODUCTS.description}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {HOMEPAGE_NO_PLANOGRAM_LAYOUT.title}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {HOMEPAGE_NO_PLANOGRAM_LAYOUT.description}
                  </p>
                </div>
              </div>
            );
          }
          return (
            <div className="space-y-4">
              {homepageIntro ? (
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  <p className="font-medium text-foreground">{HOMEPAGE_LAYOUT_EXAMPLE.title}</p>
                  <ul className="mt-1.5 space-y-0.5">
                    {HOMEPAGE_LAYOUT_EXAMPLE.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className="mt-2">{HOMEPAGE_LAYOUT_EXAMPLE.note}</p>
                </div>
              ) : null}
              <PlanogramBuilder
              rows={draftRows.length ? draftRows : [toDraftRow({})]}
              onRowsChange={setRows}
              categories={categories}
              simplifiedCopy={homepageIntro}
              tableTitle={
                homepageIntro ? HOMEPAGE_PRODUCTS_TABLE_TITLE : "Product catalog for this planogram"
              }
              tableDescription={homepageIntro ? HOMEPAGE_PRODUCTS_TABLE_DESCRIPTION : undefined}
              context={{
                location: meta.store_outlet || defaultLocation,
                category: meta.category || defaultCategory,
                subCategoryLabel: meta.sub_category || defaultSubCategory,
              }}
              />
            </div>
          );

        case "layout": {
          const updateRow = (index: number, patch: Partial<PlanogramRow>) => {
            const rows = value.planogramRows.map((row, i) =>
              i === index ? { ...row, ...patch } : row,
            );
            patch({ ...value, planogramRows: rows });
          };
          return (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Set shelf position / slot ID and expected facings for each product. Edit manually below
                or use the Products step CSV.
              </p>
              {value.planogramRows.length ? (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[40rem] text-left text-xs">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2">Slot ID</th>
                        <th className="px-2 py-2">SKU</th>
                        <th className="px-2 py-2">Product</th>
                        <th className="px-2 py-2">H facings</th>
                        <th className="px-2 py-2">Min</th>
                        <th className="px-2 py-2">Max</th>
                        <th className="px-2 py-2">Orientation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {value.planogramRows.map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-2 py-1">
                            <Input
                              className="h-8 min-w-[4rem] rounded-md text-xs"
                              value={row.shelf_position ?? ""}
                              onChange={(e) => updateRow(i, { shelf_position: e.target.value })}
                              placeholder="L3-04"
                            />
                          </td>
                          <td className="px-2 py-2 font-mono">{row.sku || "—"}</td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {row.brand} {row.product_name}
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              type="number"
                              min={0}
                              className="h-8 w-16 rounded-md text-xs tabular-nums"
                              value={row.expected_facings ?? row.expected_qty ?? ""}
                              onChange={(e) => {
                                const n = e.target.value ? Number(e.target.value) : undefined;
                                updateRow(i, { expected_facings: n, expected_qty: n });
                              }}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              type="number"
                              min={0}
                              className="h-8 w-14 rounded-md text-xs"
                              value={row.min_facings ?? ""}
                              onChange={(e) =>
                                updateRow(i, {
                                  min_facings: e.target.value ? Number(e.target.value) : undefined,
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              type="number"
                              min={0}
                              className="h-8 w-14 rounded-md text-xs"
                              value={row.max_facings ?? ""}
                              onChange={(e) =>
                                updateRow(i, {
                                  max_facings: e.target.value ? Number(e.target.value) : undefined,
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              className="h-8 min-w-[5rem] rounded-md text-xs"
                              value={(row as { orientation?: string }).orientation ?? ""}
                              onChange={(e) =>
                                updateRow(i, { orientation: e.target.value } as Partial<PlanogramRow>)
                              }
                              placeholder="front"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Add products in the Products step first — then assign shelf positions and facings here.
                </p>
              )}
            </div>
          );
        }

        case "assortment":
          if (homepageIntro && planogramMode === "demo") {
            return (
              <div className="rounded-xl border border-brand/20 bg-brand-soft/20 p-4">
                <p className="font-medium text-brand">{HOMEPAGE_DEMO_ASSORTMENT_STATUS.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {HOMEPAGE_DEMO_ASSORTMENT_STATUS.description}
                </p>
              </div>
            );
          }
          if (homepageIntro && planogramMode === "none") {
            return (
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-sm font-semibold text-foreground">
                  {HOMEPAGE_NO_PLANOGRAM_ASSORTMENT.title}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {HOMEPAGE_NO_PLANOGRAM_ASSORTMENT.description}
                </p>
              </div>
            );
          }
          return (
            <div className="space-y-4">
              {homepageIntro ? (
                <>
                  <p className="text-sm font-semibold text-foreground">{HOMEPAGE_ASSORTMENT_HEADLINE}</p>
                  <p className="text-[11px] text-muted-foreground">{HOMEPAGE_ASSORTMENT_HELP}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Mandatory assortment for {roleTabLabel(role)}. Upload CSV or auto-fill from product rows.
                  {role === "distributor" ? " MSL rows use list_type=msl in the CSV." : ""}
                </p>
              )}
              {!homepageIntro ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="brand"
                    size="sm"
                    className="rounded-lg"
                    disabled={!value.planogramRows.length}
                    onClick={() =>
                      patchPackage(autoPopulateAuditPackage(value.planogramRows, auditPackage))
                    }
                  >
                    Auto-fill assortment &amp; MSL from products
                  </Button>
                </div>
              ) : null}
              <AssortmentManualForm
                pkg={auditPackage}
                onPatch={patchPackage}
                simplifiedCopy={homepageIntro}
              />
              <PlanogramPackageCsvImport
                label={
                  homepageIntro
                    ? HOMEPAGE_ASSORTMENT_CSV.label
                    : "Or upload CSV — assortment & must-stock list"
                }
                kind="assortment"
                description={
                  homepageIntro
                    ? HOMEPAGE_ASSORTMENT_CSV.supporting
                    : `Required: ${ASSORTMENT_CSV_REQUIRED_LABEL}. Optional: ${ASSORTMENT_CSV_OPTIONAL_LABEL}.`
                }
                templateButtonLabel={
                  homepageIntro ? HOMEPAGE_ASSORTMENT_CSV.templateButton : undefined
                }
                uploadButtonLabel={homepageIntro ? HOMEPAGE_ASSORTMENT_CSV.uploadButton : undefined}
                showAssortmentColumnGuide={homepageIntro}
                onImport={(imported) => {
                  const entries = imported as AssortmentEntry[];
                  const split = splitAssortmentRows(entries);
                  patchPackage({
                    assortment_skus: split.assortment_skus,
                    msl_skus: split.msl_skus,
                  });
                }}
              />
              {allAssortment.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-brand text-brand-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          {homepageIntro ? "Product / SKU" : "SKU"}
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          {homepageIntro ? "Requirement" : "List"}
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          {homepageIntro ? "Store / Outlet" : "Scope"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {allAssortment.map((row, i) => (
                        <tr key={`${row.sku}-${i}`} className="border-t border-border">
                          <td className="px-3 py-2 font-mono text-xs">{row.sku}</td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary" className="capitalize">
                              {homepageIntro
                                ? homepageRequiredProductTypeLabel(row.list_type)
                                : row.list_type.replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{row.outlet_scope}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : homepageIntro ? (
                <div className="rounded-lg border border-dashed border-border p-4">
                  <p className="text-sm font-medium text-foreground">{HOMEPAGE_ASSORTMENT_EMPTY.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {HOMEPAGE_ASSORTMENT_EMPTY.description}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No assortment or MSL rows yet — upload CSV or use auto-fill.
                </p>
              )}
            </div>
          );

        case "prices": {
          const productLabelForSku = (sku: string) => {
            const match = value.planogramRows.find((row) => row.sku === sku);
            if (!match) return sku;
            const label = [match.brand, match.product_name, match.variant].filter(Boolean).join(" ");
            return label.trim() || sku;
          };
          if (homepageIntro && planogramMode === "demo") {
            return (
              <div className="rounded-xl border border-brand/20 bg-brand-soft/20 p-4">
                <p className="font-medium text-brand">{HOMEPAGE_DEMO_PRICES_STATUS.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {HOMEPAGE_DEMO_PRICES_STATUS.description}
                </p>
              </div>
            );
          }
          if (homepageIntro && planogramMode === "none") {
            return (
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-sm font-semibold text-foreground">
                  {HOMEPAGE_NO_PLANOGRAM_PRICES.title}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {HOMEPAGE_NO_PLANOGRAM_PRICES.description}
                </p>
              </div>
            );
          }
          return (
            <div className="space-y-4">
              {homepageIntro ? (
                <p className="text-[11px] text-muted-foreground">{HOMEPAGE_PRICES_TAB_HELPER}</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Import price requirements CSV or set <code className="text-xs">mrp_inr</code> on product
                    rows. Validity uses capture date and store timezone (
                    {auditPackage.store_timezone || "Asia/Kolkata"}).
                  </p>
                  {!roleRequiresPricing(role) ? (
                    <p className="text-xs text-muted-foreground">
                      Optional for {roleTabLabel(role)} audits.
                    </p>
                  ) : null}
                </>
              )}
              <PriceManualForm
                pkg={auditPackage}
                onPatch={patchPackage}
                simplifiedCopy={homepageIntro}
              />
              <PlanogramPackageCsvImport
                label={
                  homepageIntro ? HOMEPAGE_PRICES_CSV.label : "Or upload CSV — price requirements"
                }
                kind="prices"
                description={
                  homepageIntro
                    ? HOMEPAGE_PRICES_CSV.supporting
                    : `Required: ${PRICE_CSV_REQUIRED_LABEL}. Optional: ${PRICE_CSV_OPTIONAL_LABEL}.`
                }
                templateButtonLabel={
                  homepageIntro ? HOMEPAGE_PRICES_CSV.templateButton : undefined
                }
                uploadButtonLabel={homepageIntro ? HOMEPAGE_PRICES_CSV.uploadButton : undefined}
                showPriceColumnGuide={homepageIntro}
                onImport={(imported) =>
                  patchPackage({ price_requirements: imported as PriceRequirement[] })
                }
              />
              {!homepageIntro && value.planogramRows.some((r) => r.mrp_inr != null) && (
                <p className="text-xs text-muted-foreground">
                  {value.planogramRows.filter((r) => r.mrp_inr != null).length} product row(s) include MRP
                  from the Products step.
                </p>
              )}
              {auditPackage.price_requirements.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[40rem] text-sm">
                    <thead className="bg-brand text-brand-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          {homepageIntro ? "Product / SKU" : "SKU"}
                        </th>
                        <th className="px-3 py-2 text-left font-medium">Expected Price</th>
                        <th className="px-3 py-2 text-left font-medium">Currency</th>
                        <th className="px-3 py-2 text-left font-medium">Price Basis</th>
                        <th className="px-3 py-2 text-left font-medium">Active From</th>
                        <th className="px-3 py-2 text-left font-medium">Active Until</th>
                        <th className="px-3 py-2 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditPackage.price_requirements.map((row) => (
                        <tr key={`${row.sku}-${row.label_location}`} className="border-t border-border">
                          <td className="px-3 py-2 text-xs">
                            {homepageIntro ? (
                              <>
                                <span className="font-medium text-foreground">
                                  {productLabelForSku(row.sku)}
                                </span>
                                {productLabelForSku(row.sku) !== row.sku ? (
                                  <span className="mt-0.5 block font-mono text-muted-foreground">
                                    {row.sku}
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              <span className="font-mono">{row.sku}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 tabular-nums">{row.expected_price}</td>
                          <td className="px-3 py-2">{row.currency}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {homepageIntro
                              ? formatPriceBasisLabel(row.price_basis)
                              : row.price_basis}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {formatShelfPriceDate(row.valid_from)}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {formatShelfPriceDate(row.valid_to)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              className="inline-flex items-center text-muted-foreground hover:text-destructive"
                              aria-label="Delete price rule"
                              onClick={() =>
                                patchPackage({
                                  price_requirements: auditPackage.price_requirements.filter(
                                    (r) =>
                                      !(
                                        r.sku === row.sku &&
                                        r.label_location === row.label_location
                                      ),
                                  ),
                                })
                              }
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : homepageIntro ? (
                <div className="rounded-lg border border-dashed border-border p-4">
                  <p className="text-sm font-medium text-foreground">{HOMEPAGE_PRICES_EMPTY.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {HOMEPAGE_PRICES_EMPTY.description}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No price requirements imported — Price Compliance will show Not configured unless MRP is on
                  product rows.
                </p>
              )}
            </div>
          );
        }

        case "promotions": {
          if (homepageIntro && planogramMode === "demo") {
            return (
              <div className="rounded-xl border border-brand/20 bg-brand-soft/20 p-4">
                <p className="font-medium text-brand">{HOMEPAGE_DEMO_PROMOTIONS_STATUS.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {HOMEPAGE_DEMO_PROMOTIONS_STATUS.description}
                </p>
              </div>
            );
          }
          if (homepageIntro && planogramMode === "none") {
            return (
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-sm font-semibold text-foreground">
                  {HOMEPAGE_NO_PLANOGRAM_PROMOTIONS.title}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {HOMEPAGE_NO_PLANOGRAM_PROMOTIONS.description}
                </p>
              </div>
            );
          }
          return (
            <div className="space-y-4">
              {homepageIntro ? (
                <>
                  <p className="text-sm font-semibold text-foreground">
                    {HOMEPAGE_PROMOTIONS_HEADLINE}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{HOMEPAGE_PROMOTIONS_TAB_HELPER}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Upload active promotions CSV. Without promotions, Promotional Compliance shows{" "}
                  <strong>Not applicable</strong> — never 0% or 100%.
                </p>
              )}
              <PromotionManualForm
                pkg={auditPackage}
                onPatch={patchPackage}
                simplifiedCopy={homepageIntro}
                seedDraft={promotionEditSeed}
                onSeedDraftApplied={() => setPromotionEditSeed(null)}
              />
              <PlanogramPackageCsvImport
                label={
                  homepageIntro ? HOMEPAGE_PROMOTIONS_CSV.label : "Or upload CSV — active promotions"
                }
                kind="promotions"
                description={
                  homepageIntro
                    ? HOMEPAGE_PROMOTIONS_CSV.supporting
                    : `Required: ${PROMOTION_CSV_REQUIRED_LABEL}. Optional: ${PROMOTION_CSV_OPTIONAL_LABEL}.`
                }
                templateButtonLabel={
                  homepageIntro ? HOMEPAGE_PROMOTIONS_CSV.templateButton : undefined
                }
                uploadButtonLabel={
                  homepageIntro ? HOMEPAGE_PROMOTIONS_CSV.uploadButton : undefined
                }
                showPromotionColumnGuide={homepageIntro}
                onImport={(imported) => patchPackage({ promotions: imported as PromotionEntry[] })}
              />
              {auditPackage.promotions.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[44rem] text-sm">
                    <thead className="bg-brand text-brand-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Promotion</th>
                        <th className="px-3 py-2 text-left font-medium">Products</th>
                        <th className="px-3 py-2 text-left font-medium">Active dates</th>
                        <th className="px-3 py-2 text-left font-medium">Display location</th>
                        <th className="px-3 py-2 text-left font-medium">Promotional price</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                        <th className="px-3 py-2 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditPackage.promotions.map((promo) => {
                        const status = promotionStatusLabel(promo.start_date, promo.end_date);
                        return (
                          <tr key={promo.promotion_id} className="border-t border-border">
                            <td className="px-3 py-2">
                              <span className="font-medium text-foreground">{promo.promotion_id}</span>
                              {promo.expected_offer_text ? (
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {promo.expected_offer_text}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {formatParticipatingProducts(promo.participating_skus)}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {formatPromotionDateRange(promo.start_date, promo.end_date)}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {promo.required_location || "—"}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {promo.expected_promo_price != null ? promo.expected_promo_price : "—"}
                            </td>
                            <td className="px-3 py-2">
                              {status === "—" ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <Badge
                                  variant={
                                    status === "Active"
                                      ? "default"
                                      : status === "Upcoming"
                                        ? "secondary"
                                        : "outline"
                                  }
                                  className="text-[10px] font-normal"
                                >
                                  {status}
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  className="inline-flex items-center text-muted-foreground hover:text-brand"
                                  aria-label="Edit promotion"
                                  onClick={() => setPromotionEditSeed(promo)}
                                >
                                  <Pencil className="size-4" />
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex items-center text-muted-foreground hover:text-destructive"
                                  aria-label="Delete promotion"
                                  onClick={() =>
                                    patchPackage({
                                      promotions: auditPackage.promotions.filter(
                                        (p) => p.promotion_id !== promo.promotion_id,
                                      ),
                                    })
                                  }
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : homepageIntro ? (
                <div className="rounded-lg border border-dashed border-border p-4">
                  <p className="text-sm font-medium text-foreground">
                    {HOMEPAGE_PROMOTIONS_EMPTY.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {HOMEPAGE_PROMOTIONS_EMPTY.description}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No promotions configured — promotional KPI will show Not applicable.
                </p>
              )}
            </div>
          );
        }

        case "role_settings":
          return (
            <div className="space-y-4">
              <p className="text-sm font-medium">{roleSettingsTitle(role)}</p>
              <p className="text-sm text-muted-foreground">{roleSettingsHint(role)}</p>
              {(role === "fmcg" || role === "supermarket") && (
                <div className="space-y-1.5 max-w-sm">
                  <Label className="text-xs">Primary brand (SOS scope)</Label>
                  <Input
                    className="h-9 rounded-lg"
                    placeholder="Colgate"
                    value={auditPackage.primary_brand ?? ""}
                    onChange={(e) =>
                      patch({
                        ...value,
                        auditPackage: { ...auditPackage, primary_brand: e.target.value },
                        focus: { ...value.focus, brand: e.target.value },
                      })
                    }
                  />
                </div>
              )}
              {role === "distributor" && (
                <div className="space-y-1.5 max-w-sm">
                  <Label className="text-xs">Distributor / portfolio name</Label>
                  <Input
                    className="h-9 rounded-lg"
                    placeholder="ABC Distribution"
                    value={value.focus.company ?? ""}
                    onChange={(e) =>
                      patch({ ...value, focus: { ...value.focus, company: e.target.value } })
                    }
                  />
                </div>
              )}
            </div>
          );

        case "scoring": {
          if (homepageIntro && planogramMode === "demo") {
            return (
              <div className="rounded-xl border border-brand/20 bg-brand-soft/20 p-4">
                <p className="font-medium text-brand">{HOMEPAGE_DEMO_SCORING_STATUS.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {HOMEPAGE_DEMO_SCORING_STATUS.description}
                </p>
              </div>
            );
          }
          const scoringFields = homepageIntro
            ? HOMEPAGE_SCORING_TARGET_FIELDS
            : (
                [
                  ["osa_target", "OSA target %"],
                  ["planogram_target", "Planogram target %"],
                  ["assortment_target", "Assortment target %"],
                  ["price_target", "Price target %"],
                  ["promotional_target", "Promotional target %"],
                  ["msl_target", "MSL target %"],
                  ["share_of_shelf_target", "Share of shelf target %"],
                ] as const
              ).map(([key, label]) => ({ key, label, placeholder: "Optional" }));

          return (
            <div className="space-y-4">
              {homepageIntro ? (
                <p className="text-sm font-semibold text-foreground">{HOMEPAGE_SCORING_HEADLINE}</p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {scoringFields.map(({ key, label, placeholder }) => {
                  const unavailableInNoneMode =
                    homepageIntro &&
                    planogramMode === "none" &&
                    HOMEPAGE_SCORING_NONE_MODE_KEYS.has(key);
                  if (unavailableInNoneMode) {
                    return (
                      <div key={key} className="space-y-1.5 rounded-lg border border-dashed border-border p-3">
                        <Label className="text-xs">{label}</Label>
                        <p className="text-sm text-muted-foreground">{HOMEPAGE_SCORING_NOT_CONFIGURED}</p>
                        <p className="text-[11px] text-muted-foreground">{HOMEPAGE_SCORING_TARGET_HELP}</p>
                      </div>
                    );
                  }
                  return (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-xs">{label}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="h-9 rounded-lg"
                        placeholder={placeholder}
                        value={auditPackage.scoring?.[key] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? undefined : Number(e.target.value);
                          patch({
                            ...value,
                            auditPackage: {
                              ...auditPackage,
                              scoring: { ...auditPackage.scoring, [key]: v },
                            },
                          });
                        }}
                      />
                      {homepageIntro ? (
                        <p className="text-[11px] text-muted-foreground">{HOMEPAGE_SCORING_TARGET_HELP}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {homepageIntro ? (
                <p className="text-[11px] leading-relaxed text-muted-foreground">{HOMEPAGE_SCORING_NOTE}</p>
              ) : null}
            </div>
          );
        }

        case "readiness": {
          if (homepageIntro) {
            const mode = planogramMode ?? "custom";
            const shelfChecks = computeHomepageShelfChecks(
              mode,
              value.planogramRows,
              auditPackage,
            );
            const summary = summarizeHomepageReadiness(mode, shelfChecks);
            const blockReason = homepageStartAudit?.disabledReason;

            return (
              <div className="space-y-4">
                {mode === "demo" ? (
                  <div className="rounded-xl border border-brand/20 bg-brand-soft/20 p-4">
                    <p className="font-medium text-brand">{HOMEPAGE_DEMO_READINESS_STATUS.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {HOMEPAGE_DEMO_READINESS_STATUS.description}
                    </p>
                  </div>
                ) : mode === "none" ? (
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-sm font-semibold text-foreground">
                      {HOMEPAGE_NONE_READINESS_STATUS.title}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {HOMEPAGE_NONE_READINESS_STATUS.description}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-foreground">{HOMEPAGE_READINESS_HEADLINE}</p>
                )}

                <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {HOMEPAGE_READINESS_SUMMARY_LABEL}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{summary.summaryText}</p>
                </div>

                {mode !== "demo" ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {shelfChecks.map((check) => {
                      const statusMeta = HOMEPAGE_READINESS_STATUS_LABELS[check.status];
                      const isReady = check.status === "ready" || check.status === "ready_to_analyse";
                      return (
                        <li
                          key={check.id}
                          className={cn(
                            "flex items-start gap-3 rounded-xl border px-3 py-3",
                            isReady
                              ? "border-success/30 bg-success/5"
                              : check.status === "optional"
                                ? "border-border bg-card"
                                : check.status === "not_applicable" ||
                                    check.status === "not_required"
                                  ? "border-border/80 bg-muted/20"
                                  : "border-border bg-muted/30",
                          )}
                        >
                          {isReady ? (
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                          ) : check.status === "optional" ? (
                            <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-[11px] font-semibold tracking-wide text-foreground">
                                {check.title}
                              </p>
                              <span
                                className={cn(
                                  "text-[11px] font-medium uppercase tracking-wide",
                                  statusMeta?.className,
                                )}
                              >
                                {statusMeta?.label}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              {check.description}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {HOMEPAGE_READINESS_TRUST}
                </p>

                {homepageStartAudit ? (
                  <div className="space-y-2 pt-1">
                    {homepageStartAudit.disabled && blockReason ? (
                      <p className="text-xs font-medium text-destructive">{blockReason}</p>
                    ) : null}
                    <Button
                      type="button"
                      size="lg"
                      variant="brand"
                      className="w-full rounded-xl sm:w-auto"
                      disabled={homepageStartAudit.disabled}
                      onClick={homepageStartAudit.onStart}
                    >
                      Start AI Audit <ChevronRight className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          }

          return (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Review KPI readiness for <strong>{roleTabLabel(role)}</strong> before scanning. Missing
                optional data marks a KPI as Not configured — never fake scores.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {filteredReadiness.map((item) => (
                  <li
                    key={item.kpi_id}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
                      item.ready
                        ? "border-success/30 bg-success/5"
                        : "border-border bg-muted/30",
                    )}
                  >
                    {item.ready ? (
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                    ) : (
                      <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span>
                      <span className="font-medium">{item.label}</span>
                      {item.ready ? " — ready" : " — add data in prior steps"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                {value.planogramRows.length} product(s) · {filteredReadiness.filter((r) => r.ready).length}/
                {filteredReadiness.length} KPIs ready
              </p>
            </div>
          );
        }

        default:
          return null;
      }
    }

    return (
      <div className={cn("space-y-4", className)}>
        {/* Step indicator */}
        <div className="overflow-x-auto pb-1">
          <ol className="flex min-w-max gap-1">
            {displaySteps.map((step, i) => {
              const active = i === stepIndex;
              const done = i < stepIndex;
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-[11px] transition-colors sm:text-xs",
                      active
                        ? "bg-brand text-brand-foreground"
                        : done
                          ? "bg-brand-soft/60 text-brand"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted",
                    )}
                    onClick={() => setStepIndex(i)}
                  >
                    <span className="font-semibold tabular-nums">{i + 1}</span>
                    <span className="hidden max-w-[8rem] truncate sm:inline">{step.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="rounded-xl border border-brand/15 bg-card p-4 sm:p-5">
          <p className="text-sm font-semibold text-foreground">
            Step {stepIndex + 1} · {displaySteps[stepIndex]?.label}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {displaySteps[stepIndex]?.description}
          </p>
          <div className="mt-4">{renderStep(currentStep)}</div>
        </div>

        {!compact && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft className="size-4" /> Back
            </Button>
            <span className="text-xs text-muted-foreground">
              {stepIndex + 1} / {displaySteps.length}
            </span>
            <Button
              type="button"
              variant="brand"
              size="sm"
              className="rounded-lg"
              disabled={stepIndex >= displaySteps.length - 1}
              onClick={() => setStepIndex((i) => Math.min(displaySteps.length - 1, i + 1))}
            >
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    );
  },
);
