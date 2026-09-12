/**
 * New Planogram — stepped wizard with role-specific sections (Aislix spec).
 * Used in demo scan and authenticated New Scan (with planogram mode).
 */

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, CircleDashed, FileJson, Loader2, Upload } from "lucide-react";
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
    },
    ref,
  ) {
    const role = defaultAuditRoleTab(value.auditRole);
    const steps = useMemo(() => wizardStepsForRole(role), [role]);
    const [stepIndex, setStepIndex] = useState(0);
    const currentStep = steps[stepIndex]?.id ?? "basics";

    const meta = value.planogramMeta ?? {
      ...EMPTY_PLANOGRAM_META,
      category: defaultCategory,
      sub_category: defaultSubCategory,
      store_outlet: defaultLocation,
    };
    const draftRows = useMemo(() => toDraftRows(value.planogramRows), [value.planogramRows]);
    const auditPackage = value.auditPackage ?? EMPTY_AUDIT_PACKAGE;
    const allAssortment = mergeAssortmentLists(auditPackage.assortment_skus, auditPackage.msl_skus);
    const jsonInputRef = useRef<HTMLInputElement>(null);
    const [jsonBusy, setJsonBusy] = useState(false);

    const patch = (next: ScanContextState) => onChange(next);

    const patchPackage = (partial: Partial<PlanogramAuditPackage>) =>
      patch({ ...value, auditPackage: { ...auditPackage, ...partial } });

    const setRole = (nextRole: AuditRoleTab) => {
      setStepIndex(0);
      patch({
        ...value,
        auditRole: nextRole,
        auditPackage: autoPopulateAuditPackage(value.planogramRows, value.auditPackage ?? EMPTY_AUDIT_PACKAGE),
      });
    };

    const setRows = (rows: DraftRow[]) => {
      const planogramRows = fromDraftRows(rows);
      patch({
        ...value,
        planogramRows,
        auditPackage: autoPopulateAuditPackage(planogramRows, value.auditPackage ?? EMPTY_AUDIT_PACKAGE),
      });
    };

    useImperativeHandle(ref, () => ({
      flush: () => {
        const rows = value.planogramRows;
        const pkg = autoPopulateAuditPackage(rows, value.auditPackage ?? EMPTY_AUDIT_PACKAGE);
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
                  Audit role *
                </Label>
                <RoleTabSwitcher value={role} onChange={setRole} />
                <p className="text-xs text-muted-foreground">
                  Role selection determines which planogram sections and KPIs apply to this audit.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Planogram name *</Label>
                  <Input
                    className="h-9 rounded-lg"
                    placeholder="Oral Care A-1 — Sep 2026"
                    value={meta.name}
                    onChange={(e) => patch(mergeMeta(value, { name: e.target.value }))}
                  />
                  {meta.name.trim() ? (
                    <p className="text-[11px] text-muted-foreground">
                      ID: {planogramIdFromName(meta.name)} · Version: 1 · Status: Draft
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
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Category *</Label>
                  <Input
                    className="h-9 rounded-lg"
                    value={meta.category}
                    onChange={(e) => patch(mergeMeta(value, { category: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Sub-category</Label>
                  <Input
                    className="h-9 rounded-lg"
                    value={meta.sub_category ?? ""}
                    onChange={(e) => patch(mergeMeta(value, { sub_category: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valid from *</Label>
                  <Input
                    type="date"
                    className="h-9 rounded-lg"
                    value={meta.valid_from}
                    onChange={(e) => patch(mergeMeta(value, { valid_from: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Store timezone *</Label>
                  <Input
                    className="h-9 rounded-lg"
                    placeholder="Asia/Kolkata"
                    value={auditPackage.store_timezone ?? "Asia/Kolkata"}
                    onChange={(e) =>
                      patch({
                        ...value,
                        auditPackage: { ...auditPackage, store_timezone: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Measurement unit *</Label>
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
                </div>
              </div>
              <div className="rounded-xl border border-brand/15 bg-brand-soft/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Full planogram package</p>
                    <p className="text-xs text-muted-foreground">
                      Import or export products, assortment, prices, promotions, and scoring in one JSON file.
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
                      <FileJson className="mr-1.5 size-4" /> Export JSON
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
                      Import JSON
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
                <Label className="text-xs">Fixture type</Label>
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
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Number of shelves</Label>
                <Input
                  type="number"
                  min={1}
                  className="h-9 rounded-lg"
                  value={meta.shelf_count ?? ""}
                  onChange={(e) =>
                    patch(mergeMeta(value, { shelf_count: Number(e.target.value) || undefined }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fixture width ({meta.measurement_unit})</Label>
                <Input
                  type="number"
                  min={0}
                  className="h-9 rounded-lg"
                  value={meta.fixture_width ?? ""}
                  onChange={(e) =>
                    patch(mergeMeta(value, { fixture_width: Number(e.target.value) || undefined }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fixture height ({meta.measurement_unit})</Label>
                <Input
                  type="number"
                  min={0}
                  className="h-9 rounded-lg"
                  value={meta.fixture_height ?? ""}
                  onChange={(e) =>
                    patch(mergeMeta(value, { fixture_height: Number(e.target.value) || undefined }))
                  }
                />
              </div>
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Shelf geometry supports Planogram Compliance, Location Accuracy, and Share of Shelf when
                calibrated. Leave blank if not yet measured — affected KPIs may show Not assessable.
              </p>
            </div>
          );

        case "products":
          return (
            <PlanogramBuilder
              rows={draftRows.length ? draftRows : [toDraftRow({})]}
              onRowsChange={setRows}
              categories={categories}
              tableTitle="Product catalog for this planogram"
              context={{
                location: meta.store_outlet || defaultLocation,
                category: meta.category || defaultCategory,
                subCategoryLabel: meta.sub_category || defaultSubCategory,
              }}
            />
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
                  Add products in Step 3 first — layout fields are optional until you need placement KPIs.
                </p>
              )}
            </div>
          );
        }

        case "assortment":
          return (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Mandatory assortment for {roleTabLabel(role)}. Upload CSV or auto-fill from product rows.
                {role === "distributor" ? " MSL rows use list_type=msl in the CSV." : ""}
              </p>
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
              <AssortmentManualForm pkg={auditPackage} onPatch={patchPackage} />
              <PlanogramPackageCsvImport
                label="Or upload CSV — assortment & must-stock list"
                kind="assortment"
                description="Columns: sku, list_type (mandatory_assortment | msl | optional), outlet_scope, valid_from, valid_to"
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
                        <th className="px-3 py-2 text-left font-medium">SKU</th>
                        <th className="px-3 py-2 text-left font-medium">List</th>
                        <th className="px-3 py-2 text-left font-medium">Scope</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allAssortment.map((row, i) => (
                        <tr key={`${row.sku}-${i}`} className="border-t border-border">
                          <td className="px-3 py-2 font-mono text-xs">{row.sku}</td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary" className="capitalize">
                              {row.list_type.replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{row.outlet_scope}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No assortment or MSL rows yet — upload CSV or use auto-fill.
                </p>
              )}
            </div>
          );

        case "prices":
          return (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Import price requirements CSV or set <code className="text-xs">mrp_inr</code> on product rows.
                Validity uses capture date and store timezone ({auditPackage.store_timezone || "Asia/Kolkata"}).
              </p>
              {!roleRequiresPricing(role) ? (
                <p className="text-xs text-muted-foreground">Optional for {roleTabLabel(role)} audits.</p>
              ) : null}
              <PriceManualForm pkg={auditPackage} onPatch={patchPackage} />
              <PlanogramPackageCsvImport
                label="Or upload CSV — price requirements"
                kind="prices"
                description="Columns: sku, label_location, expected_price, currency, price_basis, valid_from, valid_to"
                onImport={(imported) =>
                  patchPackage({ price_requirements: imported as PriceRequirement[] })
                }
              />
              {value.planogramRows.some((r) => r.mrp_inr != null) && (
                <p className="text-xs text-muted-foreground">
                  {value.planogramRows.filter((r) => r.mrp_inr != null).length} product row(s) include MRP
                  from the Products step.
                </p>
              )}
              {auditPackage.price_requirements.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-brand text-brand-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">SKU</th>
                        <th className="px-3 py-2 text-left">Expected</th>
                        <th className="px-3 py-2 text-left">Basis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditPackage.price_requirements.map((row) => (
                        <tr key={`${row.sku}-${row.label_location}`} className="border-t border-border">
                          <td className="px-3 py-2 font-mono text-xs">{row.sku}</td>
                          <td className="px-3 py-2">
                            {row.currency} {row.expected_price}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{row.price_basis}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No price requirements imported — Price Compliance will show Not configured unless MRP is on
                  product rows.
                </p>
              )}
            </div>
          );

        case "promotions":
          return (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload active promotions CSV. Without promotions, Promotional Compliance shows{" "}
                <strong>Not applicable</strong> — never 0% or 100%.
              </p>
              <PromotionManualForm pkg={auditPackage} onPatch={patchPackage} />
              <PlanogramPackageCsvImport
                label="Or upload CSV — active promotions"
                kind="promotions"
                description="Columns: promotion_id, participating_skus, start_date, end_date, expected_offer_text, expected_promo_price, required_facings"
                onImport={(imported) => patchPackage({ promotions: imported as PromotionEntry[] })}
              />
              {auditPackage.promotions.length > 0 ? (
                <div className="space-y-2">
                  {auditPackage.promotions.map((promo) => (
                    <div
                      key={promo.promotion_id}
                      className="rounded-xl border border-border bg-card px-4 py-3 text-sm"
                    >
                      <p className="font-medium text-brand">{promo.promotion_id}</p>
                      <p className="text-muted-foreground">{promo.expected_offer_text || "—"}</p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        SKUs: {promo.participating_skus.join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No promotions configured — promotional KPI will show Not applicable.
                </p>
              )}
            </div>
          );

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

        case "scoring":
          return (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["osa_target", "OSA target %"],
                  ["planogram_target", "Planogram target %"],
                  ["assortment_target", "Assortment target %"],
                  ["price_target", "Price target %"],
                  ["promotional_target", "Promotional target %"],
                  ["msl_target", "MSL target %"],
                  ["share_of_shelf_target", "Share of shelf target %"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="h-9 rounded-lg"
                    placeholder="Optional"
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
                </div>
              ))}
            </div>
          );

        case "readiness":
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

        default:
          return null;
      }
    }

    return (
      <div className={cn("space-y-4", className)}>
        {/* Step indicator */}
        <div className="overflow-x-auto pb-1">
          <ol className="flex min-w-max gap-1">
            {steps.map((step, i) => {
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
            Step {stepIndex + 1} · {steps[stepIndex]?.label}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{steps[stepIndex]?.description}</p>
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
              {stepIndex + 1} / {steps.length}
            </span>
            <Button
              type="button"
              variant="brand"
              size="sm"
              className="rounded-lg"
              disabled={stepIndex >= steps.length - 1}
              onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
            >
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    );
  },
);
