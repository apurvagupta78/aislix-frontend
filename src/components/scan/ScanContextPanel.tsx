/**

 * Optional company/brand/product focus + compact planogram (CSV or manual)

 * for demo and dashboard scan results.

 */



import { forwardRef, useImperativeHandle, useState } from "react";

import { ChevronDown, Download, Plus, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import {

  convertToInr,

  formatStoredPrice,

  priceFieldLabel,

  useDisplayCurrency,

} from "@/lib/display-currency";

import {

  EMPTY_SCAN_CONTEXT,

  hasActiveScanContext,

  type ScanContextState,

  type ScanFocusFilter,

} from "@/lib/scan-context";

import { buildMatchKey } from "@/lib/demo-planogram-match";

import {

  emptyRow,

  downloadPlanogramCsvTemplateFile,

  parsePlanogramCsv,

  parsePlanogramQty,

  SAMPLE_CSV_HEADERS,

  type DraftRow,

  type PlanogramRow,

} from "@/lib/planogram";

import { RolePlanogramHeader } from "@/components/scan/RolePlanogramHeader";
import { defaultAuditRoleTab, roleTabLabel, type AuditRoleTab } from "@/lib/role-audit-ui";
import {
  autoPopulateAuditPackage,
  EMPTY_AUDIT_PACKAGE,
} from "@/lib/planogram-audit-package";
import {
  autoSku,
  getRolePlanogramFields,
  isFieldRequired,
  roleRequiresPricing,
  type PlanogramFieldKey,
} from "@/lib/role-planogram-requirements";
import { cn } from "@/lib/utils";



type ManualForm = Partial<PlanogramRow> & {

  price_display?: number;

  /** Raw digits while typing — avoids number-input coercion (e.g. 015 → 15). */

  expected_qty_input?: string;

};



export type ScanContextPanelHandle = {

  /** Commit a filled manual row if valid; returns updated context (or current if nothing to flush). */

  flushPendingManualRow: () => ScanContextState;

};



type ScanContextPanelProps = {

  value: ScanContextState;

  onChange: (next: ScanContextState) => void;

  defaultCategory?: string;

  defaultSubCategory?: string;

  defaultLocation?: string;

  /** When false, panel starts collapsed (recommended for post-scan). */

  defaultOpen?: boolean;

  /** Require MRP on manual add and highlight pricing fields. */

  requirePricing?: boolean;

  /** Inside colored setup card — hide outer border. */

  embedded?: boolean;

  className?: string;

};



function emptyManual(defaults: {

  location: string;

  category: string;

  sub_category: string;

}): ManualForm {

  return {

    location: defaults.location,

    category: defaults.category,

    sub_category: defaults.sub_category,

    brand: "",

    product_name: "",

    variant: "",

    expected_qty: 1,

    expected_qty_input: "1",

    price_display: undefined,

    avg_daily_sales: undefined,

    sku: "",

    shelf_position: "",

  };

}



function contextSummary(value: ScanContextState): string | null {

  const parts: string[] = [];

  if (value.focus.brand) parts.push(value.focus.brand);

  if (value.focus.product) parts.push(value.focus.product);

  if (value.planogramRows.length) {

    parts.push(`${value.planogramRows.length} planogram row${value.planogramRows.length === 1 ? "" : "s"}`);

  }

  return parts.length ? parts.join(" · ") : null;

}



function manualFormHasDraft(manual: ManualForm): boolean {

  return Boolean(

    manual.brand?.trim() ||

      manual.product_name?.trim() ||

      manual.price_display != null ||

      (manual.expected_qty_input != null && manual.expected_qty_input !== "" && manual.expected_qty_input !== "1"),

  );

}



function buildManualRow(

  manual: ManualForm,

  options: {

    requirePricing: boolean;

    currency: ReturnType<typeof useDisplayCurrency>["currency"];

    role: AuditRoleTab;

  },

): { row?: PlanogramRow; error?: string } {

  const brand = manual.brand?.trim();

  const product = manual.product_name?.trim();

  const location = manual.location?.trim();

  const category = manual.category?.trim();

  const subCategory = manual.sub_category?.trim();

  if (!brand || !product || !location || !category || !subCategory) {

    return { error: "Fill location, category, sub category, brand, and product name." };

  }

  if (
    options.requirePricing &&
    (manual.price_display == null || !Number.isFinite(manual.price_display) || manual.price_display <= 0)
  ) {
    return { error: "Shelf price (MRP) is required for each product." };
  }

  if (
    isFieldRequired(options.role, "shelf_position") &&
    !manual.shelf_position?.trim()
  ) {
    return { error: "Shelf position / slot ID is required for this audit role." };
  }

  const qty = parsePlanogramQty(manual.expected_qty_input ?? manual.expected_qty);

  if (qty === null) {
    return { error: "Expected facings must be a whole number of 0 or more." };
  }

  const sku = manual.sku?.trim() || autoSku(brand, product);

  return {
    row: {
      ...emptyRow(),
      location,
      category,
      sub_category: subCategory,
      brand,
      product_name: product,
      variant: manual.variant?.trim() ?? "",
      expected_qty: qty,
      expected_facings: qty,
      mrp_inr:
        manual.price_display != null && Number.isFinite(manual.price_display)
          ? convertToInr(manual.price_display, options.currency)
          : undefined,
      avg_daily_sales:
        manual.avg_daily_sales != null && Number.isFinite(manual.avg_daily_sales)
          ? Number(manual.avg_daily_sales)
          : undefined,
      sku,
      shelf_position: manual.shelf_position?.trim() ?? "",
      match_key: buildMatchKey(brand, product, sku),
    },
  };
}



export const ScanContextPanel = forwardRef<ScanContextPanelHandle, ScanContextPanelProps>(

  function ScanContextPanel(

    {

      value,

      onChange,

      defaultCategory = "",

      defaultSubCategory = "",

      defaultLocation = "",

      defaultOpen,

      requirePricing = false,

      embedded = false,

      className,

    },

    ref,

  ) {

    const { currency } = useDisplayCurrency();

    const priceLabel = priceFieldLabel(currency);

    const auditRole = defaultAuditRoleTab(value.auditRole);

    const roleFields = getRolePlanogramFields(auditRole);

    const roleNeedsPrice = roleRequiresPricing(auditRole);

    const effectiveRequirePricing = requirePricing && roleNeedsPrice;

    const [open, setOpen] = useState(

      defaultOpen !== undefined ? defaultOpen : hasActiveScanContext(value),

    );

    const [manual, setManual] = useState<ManualForm>(() =>

      emptyManual({

        location: defaultLocation || "A-1",

        category: defaultCategory || "Personal Care",

        sub_category: defaultSubCategory || "Toothpaste",

      }),

    );

    const [csvError, setCsvError] = useState<string | null>(null);



    const setFocus = (patch: Partial<ScanFocusFilter>) =>

      onChange({ ...value, focus: { ...value.focus, ...patch } });



    const setRows = (rows: PlanogramRow[]) => onChange({ ...value, planogramRows: rows });



    function resetManualForm(keep: { location: string; category: string; sub_category: string }) {

      setManual(emptyManual(keep));

    }



    function commitManualRow(): ScanContextState {

      if (!manualFormHasDraft(manual)) return value;

      const built = buildManualRow(manual, {
        requirePricing: effectiveRequirePricing,
        currency,
        role: auditRole,
      });

      if (built.error || !built.row) {

        if (built.error) setCsvError(built.error);

        return value;

      }

      setCsvError(null);

      const location = built.row.location;

      const category = built.row.category;

      const subCategory = built.row.sub_category;

      const next = { ...value, planogramRows: [...value.planogramRows, built.row] };

      onChange(next);

      resetManualForm({

        location: location || defaultLocation || "A-1",

        category: category || defaultCategory || "Personal Care",

        sub_category: subCategory || defaultSubCategory || "Toothpaste",

      });

      setOpen(true);

      return next;

    }



    useImperativeHandle(ref, () => ({

      flushPendingManualRow: commitManualRow,

    }));



    async function onCsv(file: File) {

      setCsvError(null);

      try {

        const parsed = await parsePlanogramCsv(file);

        const valid = parsed.rows.filter((r) => r.valid && r.data).map((r) => r.data as PlanogramRow);

        if (!valid.length) {

          setCsvError(parsed.errors.join("\n") || "No valid rows in CSV.");

          return;

        }

        setRows([...value.planogramRows, ...valid]);

        setOpen(true);

      } catch (err) {

        setCsvError(err instanceof Error ? err.message : "Could not parse CSV.");

      }

    }



    function addManualRow() {

      const next = commitManualRow();

      if (next === value && manualFormHasDraft(manual)) {

        // commitManualRow already set csvError when validation failed

        if (!csvError) setCsvError("Could not add product — check required fields.");

      }

    }



    function downloadTemplate() {
      downloadPlanogramCsvTemplateFile();
    }



    const requiredCols = roleFields.filter((f) => f.required).map((f) => f.key);

    const optionalCols = roleFields.filter((f) => !f.required).map((f) => f.key);

    const fieldRequired = (key: PlanogramFieldKey) => isFieldRequired(auditRole, key);

    function setAuditRole(role: AuditRoleTab) {
      const auditPackage = autoPopulateAuditPackage(
        value.planogramRows,
        value.auditPackage ?? EMPTY_AUDIT_PACKAGE,
      );
      onChange({ ...value, auditRole: role, auditPackage });
    }

    const defaultHint = effectiveRequirePricing
      ? "Select audit role, add products with role-specific fields, then audit."
      : "Select audit role and add expected products — optional price for financial estimates";

    const panelBody = open ? (
      <div className={cn("space-y-5 px-4 pb-4 pt-4", !embedded && "border-t border-border")}>
        <RolePlanogramHeader
          role={auditRole}
          onRoleChange={setAuditRole}
          rows={value.planogramRows}
          auditPackage={value.auditPackage}
        />

        <div className="space-y-3">

          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">

            Filter calculations

          </p>

          <div className="grid gap-3 sm:grid-cols-3">

            <div className="space-y-1.5">

              <Label htmlFor="scan-focus-company" className="text-xs">

                Company

              </Label>

              <Input

                id="scan-focus-company"

                className="h-9 rounded-lg text-sm"

                placeholder="Colgate-Palmolive"

                value={value.focus.company ?? ""}

                onChange={(e) => setFocus({ company: e.target.value })}

              />

            </div>

            <div className="space-y-1.5">

              <Label htmlFor="scan-focus-brand" className="text-xs">

                Brand

              </Label>

              <Input

                id="scan-focus-brand"

                className="h-9 rounded-lg text-sm"

                placeholder="Colgate"

                value={value.focus.brand ?? ""}

                onChange={(e) => setFocus({ brand: e.target.value })}

              />

            </div>

            <div className="space-y-1.5">

              <Label htmlFor="scan-focus-product" className="text-xs">

                Product

              </Label>

              <Input

                id="scan-focus-product"

                className="h-9 rounded-lg text-sm"

                placeholder="MaxFresh"

                value={value.focus.product ?? ""}

                onChange={(e) => setFocus({ product: e.target.value })}

              />

            </div>

          </div>

        </div>



        <div className="space-y-3">

          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">

            Planogram data

          </p>



          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3 sm:p-4">

            <p className="text-xs font-medium text-foreground">
              CSV format for {roleTabLabel(auditRole)} — required fields vary by role
            </p>

            <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">

              <p>

                <span className="font-medium text-foreground">Required: </span>

                {requiredCols.join(", ")}

              </p>

              <p>

                <span className="font-medium text-foreground">Optional: </span>

                {optionalCols.join(", ")}

              </p>

              <p>

                <span className="font-medium text-foreground">Price column: </span>

                <code className="rounded bg-background px-1">mrp_inr</code> in CSV files (INR values). Manual

                entry below uses {currency}.

              </p>

            </div>

            <pre className="overflow-x-auto rounded-md border border-border bg-background p-2.5 text-[10px] leading-relaxed text-muted-foreground">

              {SAMPLE_CSV_HEADERS}

            </pre>

            <div className="flex flex-wrap gap-2">

              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted/50">

                <Upload className="size-3.5 shrink-0" />

                Upload CSV

                <input

                  type="file"

                  accept=".csv,text/csv"

                  className="sr-only"

                  onChange={(e) => {

                    const f = e.target.files?.[0];

                    e.target.value = "";

                    if (f) void onCsv(f);

                  }}

                />

              </label>

              <Button

                type="button"

                variant="outline"

                size="sm"

                className="h-9 rounded-lg text-xs"

                onClick={() => void downloadTemplate()}

              >

                <Download className="size-3.5 shrink-0" />

                Download template CSV

              </Button>

            </div>

            {csvError ? <p className="text-xs text-destructive">{csvError}</p> : null}

          </div>



          <div className="rounded-lg border border-dashed border-border p-3 sm:p-4">

            <p className="text-xs font-medium">Add one product manually</p>

            <p className="mt-1 text-[11px] text-muted-foreground">

              Fields follow the same order as the CSV template above. Click Add product, or your entry

              is saved automatically when you start auditing.

            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

              <div className="space-y-1.5">

                <Label className="text-xs">Location *</Label>

                <Input

                  className="h-9 rounded-lg text-sm"

                  value={manual.location ?? ""}

                  onChange={(e) => setManual({ ...manual, location: e.target.value })}

                />

              </div>

              <div className="space-y-1.5">

                <Label className="text-xs">Category *</Label>

                <Input

                  className="h-9 rounded-lg text-sm"

                  value={manual.category ?? ""}

                  onChange={(e) => setManual({ ...manual, category: e.target.value })}

                />

              </div>

              <div className="space-y-1.5">

                <Label className="text-xs">Sub category *</Label>

                <Input

                  className="h-9 rounded-lg text-sm"

                  value={manual.sub_category ?? ""}

                  onChange={(e) => setManual({ ...manual, sub_category: e.target.value })}

                />

              </div>

              <div className="space-y-1.5">

                <Label className="text-xs">Brand *</Label>

                <Input

                  className="h-9 rounded-lg text-sm"

                  value={manual.brand ?? ""}

                  onChange={(e) => setManual({ ...manual, brand: e.target.value })}

                />

              </div>

              <div className="space-y-1.5 sm:col-span-2">

                <Label className="text-xs">Product name *</Label>

                <Input

                  className="h-9 rounded-lg text-sm"

                  value={manual.product_name ?? ""}

                  onChange={(e) => setManual({ ...manual, product_name: e.target.value })}

                />

              </div>

              <div className="space-y-1.5">

                <Label className="text-xs">Variant</Label>

                <Input

                  className="h-9 rounded-lg text-sm"

                  placeholder="340ml"

                  value={manual.variant ?? ""}

                  onChange={(e) => setManual({ ...manual, variant: e.target.value })}

                />

              </div>

              <div className="space-y-1.5">

                <Label className="text-xs">
                  Expected facings{fieldRequired("expected_qty") ? " *" : ""}
                </Label>

                <Input

                  type="text"

                  inputMode="numeric"

                  pattern="[0-9]*"

                  className="h-9 rounded-lg text-sm tabular-nums"

                  placeholder="e.g. 15"

                  value={manual.expected_qty_input ?? "1"}

                  onChange={(e) =>

                    setManual({

                      ...manual,

                      expected_qty_input: e.target.value.replace(/\D/g, ""),

                    })

                  }

                />

              </div>

              <div className="space-y-1.5">

                <Label className="text-xs">

                  {priceLabel}
                  {effectiveRequirePricing && fieldRequired("mrp_inr") ? " *" : ""}

                </Label>

                <Input

                  type="number"

                  min={0}

                  step="0.01"

                  className={cn(

                    "h-9 rounded-lg text-sm",

                    effectiveRequirePricing && "border-brand/40 bg-brand-soft/20",

                  )}

                  placeholder={currency === "INR" ? "100" : "3.99"}

                  value={manual.price_display ?? ""}

                  onChange={(e) =>

                    setManual({

                      ...manual,

                      price_display: e.target.value ? Number(e.target.value) : undefined,

                    })

                  }

                />

              </div>

              <div className="space-y-1.5">

                <Label className="text-xs">Daily sales (units)</Label>

                <Input

                  type="number"

                  min={0}

                  className="h-9 rounded-lg text-sm"

                  placeholder="6"

                  value={manual.avg_daily_sales ?? ""}

                  onChange={(e) =>

                    setManual({

                      ...manual,

                      avg_daily_sales: e.target.value ? Number(e.target.value) : undefined,

                    })

                  }

                />

              </div>

              <div className="space-y-1.5">

                <Label className="text-xs">
                  SKU{fieldRequired("sku") ? " *" : ""}
                </Label>

                <Input

                  className="h-9 rounded-lg text-sm"

                  value={manual.sku ?? ""}

                  onChange={(e) => setManual({ ...manual, sku: e.target.value })}

                />

              </div>

              <div className="space-y-1.5">

                <Label className="text-xs">
                  Shelf position / slot{fieldRequired("shelf_position") ? " *" : ""}
                </Label>

                <Input

                  className="h-9 rounded-lg text-sm"

                  placeholder="1"

                  value={manual.shelf_position ?? ""}

                  onChange={(e) => setManual({ ...manual, shelf_position: e.target.value })}

                />

              </div>

            </div>

            <Button

              type="button"

              size="sm"

              variant="subtle"

              className="mt-3 h-9 rounded-lg text-xs"

              onClick={addManualRow}

            >

              <Plus className="size-3.5" /> Add product

            </Button>

          </div>



          {value.planogramRows.length > 0 ? (

            <div className="overflow-x-auto rounded-lg border border-border">

              <table className="w-full min-w-[40rem] text-left text-xs">

                <thead className="bg-muted/50 text-muted-foreground">

                  <tr>

                    {roleFields.map((f) => (

                      <th key={f.key} className="px-2 py-2 font-medium whitespace-nowrap">

                        {f.key === "mrp_inr" ? priceLabel : f.label}

                      </th>

                    ))}

                    <th className="w-8 px-2 py-2" />

                  </tr>

                </thead>

                <tbody>

                  {value.planogramRows.map((row, i) => (

                    <tr key={`${row.brand}-${row.product_name}-${i}`} className="border-t border-border">

                      <td className="px-2 py-2">{row.location || "—"}</td>

                      <td className="px-2 py-2">{row.category || "—"}</td>

                      <td className="px-2 py-2">{row.sub_category || "—"}</td>

                      <td className="px-2 py-2">{row.brand}</td>

                      <td className="px-2 py-2">{row.product_name}</td>

                      <td className="px-2 py-2">{row.variant || "—"}</td>

                      <td className="px-2 py-2 tabular-nums">

                        {row.expected_facings ?? row.expected_qty}

                      </td>

                      <td className="px-2 py-2 tabular-nums whitespace-nowrap">

                        {formatStoredPrice(row.mrp_inr, currency)}

                      </td>

                      <td className="px-2 py-2 tabular-nums">{row.avg_daily_sales ?? "—"}</td>

                      <td className="px-2 py-2">{row.sku || "—"}</td>

                      <td className="px-2 py-2">{row.shelf_position || "—"}</td>

                      <td className="px-2 py-2">

                        <button

                          type="button"

                          className="text-muted-foreground hover:text-destructive"

                          aria-label="Remove row"

                          onClick={() => setRows(value.planogramRows.filter((_, idx) => idx !== i))}

                        >

                          <Trash2 className="size-3.5" />

                        </button>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          ) : null}

        </div>



        {hasActiveScanContext(value) ? (

          <Button

            type="button"

            variant="ghost"

            size="sm"

            className="h-8 rounded-lg text-xs text-muted-foreground"

            onClick={() => onChange(EMPTY_SCAN_CONTEXT)}

          >

            Clear filters &amp; planogram

          </Button>

        ) : null}

      </div>

    ) : null;



    if (embedded) {

      return <div className={cn(className)}>{panelBody}</div>;

    }



    return (

      <div className={cn("rounded-xl border border-border bg-surface", className)}>

        <button

          type="button"

          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"

          onClick={() => setOpen((v) => !v)}

        >

          <div className="min-w-0 flex-1">

            <p className="text-sm font-medium">Your brand &amp; planogram</p>

            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">

              {contextSummary(value) ?? defaultHint}

            </p>

          </div>

          <ChevronDown

            className={cn(

              "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",

              open && "rotate-180",

            )}

          />

        </button>

        {panelBody}

      </div>

    );

  },

);



export function draftRowsToPlanogram(rows: DraftRow[]): PlanogramRow[] {

  return rows.map(({ key: _key, ...row }) => row);

}


