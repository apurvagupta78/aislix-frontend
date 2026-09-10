/**
 * Optional company/brand/product focus + compact planogram (CSV or manual)
 * for demo and dashboard scan results.
 */

import { useState } from "react";
import { ChevronDown, Download, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EMPTY_SCAN_CONTEXT,
  hasActiveScanContext,
  type ScanContextState,
  type ScanFocusFilter,
} from "@/lib/scan-context";
import {
  emptyRow,
  fetchPlanogramCsvTemplate,
  parsePlanogramCsv,
  REQUIRED_CSV_COLUMNS,
  SAMPLE_CSV_HEADERS,
  type DraftRow,
  type PlanogramRow,
} from "@/lib/planogram";
import { cn } from "@/lib/utils";

const OPTIONAL_CSV_COLUMNS = [
  "variant",
  "mrp_inr",
  "avg_daily_sales",
  "sku",
  "shelf_position",
] as const;

type ScanContextPanelProps = {
  value: ScanContextState;
  onChange: (next: ScanContextState) => void;
  defaultCategory?: string;
  defaultSubCategory?: string;
  defaultLocation?: string;
  className?: string;
};

export function ScanContextPanel({
  value,
  onChange,
  defaultCategory = "",
  defaultSubCategory = "",
  defaultLocation = "",
  className,
}: ScanContextPanelProps) {
  const [open, setOpen] = useState(hasActiveScanContext(value));
  const [manual, setManual] = useState<Partial<PlanogramRow>>({
    brand: "",
    product_name: "",
    expected_qty: 1,
    mrp_inr: undefined,
    avg_daily_sales: undefined,
  });
  const [csvError, setCsvError] = useState<string | null>(null);

  const setFocus = (patch: Partial<ScanFocusFilter>) =>
    onChange({ ...value, focus: { ...value.focus, ...patch } });

  const setRows = (rows: PlanogramRow[]) => onChange({ ...value, planogramRows: rows });

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
    const brand = manual.brand?.trim();
    const product = manual.product_name?.trim();
    if (!brand || !product) return;
    const row: PlanogramRow = {
      ...emptyRow(),
      location: defaultLocation || "A-1",
      category: defaultCategory || "General",
      sub_category: defaultSubCategory || "General",
      brand,
      product_name: product,
      expected_qty: Number(manual.expected_qty) || 1,
      mrp_inr: manual.mrp_inr ? Number(manual.mrp_inr) : undefined,
      avg_daily_sales: manual.avg_daily_sales ? Number(manual.avg_daily_sales) : undefined,
    };
    setRows([...value.planogramRows, row]);
    setManual({
      brand: "",
      product_name: "",
      expected_qty: 1,
      mrp_inr: undefined,
      avg_daily_sales: undefined,
    });
    setOpen(true);
  }

  async function downloadTemplate() {
    const text = await fetchPlanogramCsvTemplate();
    const blob = new Blob([text], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aislix-planogram-template.csv";
    a.click();
    URL.revokeObjectURL(url);
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
            Optional — filter results to your company and add MRP / sales for financial impact
          </p>
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-5 border-t border-border px-4 pb-4 pt-4">
          {/* Brand filter */}
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
                  placeholder="Hindustan Unilever"
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

          {/* Planogram */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Planogram data
            </p>

            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
              <p className="text-xs font-medium text-foreground">CSV columns</p>
              <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Required: </span>
                  {REQUIRED_CSV_COLUMNS.join(", ")}
                </p>
                <p>
                  <span className="font-medium text-foreground">Optional: </span>
                  {OPTIONAL_CSV_COLUMNS.join(", ")}
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
              <p className="text-xs font-medium">Or add one product manually</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label className="text-xs">Brand *</Label>
                  <Input
                    className="h-9 rounded-lg text-sm"
                    value={manual.brand ?? ""}
                    onChange={(e) => setManual({ ...manual, brand: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-1 lg:col-span-2">
                  <Label className="text-xs">Product name *</Label>
                  <Input
                    className="h-9 rounded-lg text-sm"
                    value={manual.product_name ?? ""}
                    onChange={(e) => setManual({ ...manual, product_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Expected qty</Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-9 rounded-lg text-sm"
                    value={manual.expected_qty ?? 1}
                    onChange={(e) => setManual({ ...manual, expected_qty: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">MRP (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-9 rounded-lg text-sm"
                    placeholder="299"
                    value={manual.mrp_inr ?? ""}
                    onChange={(e) =>
                      setManual({
                        ...manual,
                        mrp_inr: e.target.value ? Number(e.target.value) : undefined,
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
                <table className="w-full min-w-[28rem] text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Brand</th>
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 font-medium">Qty</th>
                      <th className="px-3 py-2 font-medium">MRP</th>
                      <th className="px-3 py-2 font-medium">Sales/d</th>
                      <th className="px-3 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {value.planogramRows.map((row, i) => (
                      <tr key={`${row.brand}-${row.product_name}-${i}`} className="border-t border-border">
                        <td className="px-3 py-2">{row.brand}</td>
                        <td className="px-3 py-2">{row.product_name}</td>
                        <td className="px-3 py-2 tabular-nums">{row.expected_qty}</td>
                        <td className="px-3 py-2 tabular-nums">{row.mrp_inr ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{row.avg_daily_sales ?? "—"}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Remove row"
                            onClick={() =>
                              setRows(value.planogramRows.filter((_, idx) => idx !== i))
                            }
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
      )}
    </div>
  );
}

export function draftRowsToPlanogram(rows: DraftRow[]): PlanogramRow[] {
  return rows.map(({ key: _key, ...row }) => row);
}
