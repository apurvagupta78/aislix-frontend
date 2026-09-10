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
  type DraftRow,
  type PlanogramRow,
} from "@/lib/planogram";
import { cn } from "@/lib/utils";

type ScanContextPanelProps = {
  value: ScanContextState;
  onChange: (next: ScanContextState) => void;
  /** Pre-fill category context for manual planogram rows. */
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
    setManual({ brand: "", product_name: "", expected_qty: 1, mrp_inr: undefined, avg_daily_sales: undefined });
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
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="text-sm font-medium">Your brand & planogram</p>
          <p className="text-xs text-muted-foreground">
            Optional — filter calculations to your company and add MRP / sales data
          </p>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-4 pb-4 pt-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Company</Label>
              <Input
                className="h-9 rounded-lg text-sm"
                placeholder="e.g. Hindustan Unilever"
                value={value.focus.company ?? ""}
                onChange={(e) => setFocus({ company: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Brand</Label>
              <Input
                className="h-9 rounded-lg text-sm"
                placeholder="e.g. Colgate"
                value={value.focus.brand ?? ""}
                onChange={(e) => setFocus({ brand: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Product</Label>
              <Input
                className="h-9 rounded-lg text-sm"
                placeholder="e.g. MaxFresh"
                value={value.focus.product ?? ""}
                onChange={(e) => setFocus({ product: e.target.value })}
              />
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border p-3">
            <p className="text-xs font-medium">Planogram (CSV or manual)</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Include expected qty, MRP (₹), and daily sales for accurate financial impact.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50">
                <Upload className="size-3.5" /> Upload CSV
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
              <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => void downloadTemplate()}>
                <Download className="size-3.5" /> Template
              </Button>
            </div>
            {csvError && <p className="mt-2 text-xs text-destructive">{csvError}</p>}

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Input className="h-8 rounded-lg text-xs" placeholder="Brand *" value={manual.brand ?? ""} onChange={(e) => setManual({ ...manual, brand: e.target.value })} />
              <Input className="h-8 rounded-lg text-xs" placeholder="Product *" value={manual.product_name ?? ""} onChange={(e) => setManual({ ...manual, product_name: e.target.value })} />
              <Input className="h-8 rounded-lg text-xs" type="number" min={0} placeholder="Qty" value={manual.expected_qty ?? 1} onChange={(e) => setManual({ ...manual, expected_qty: Number(e.target.value) })} />
              <Input className="h-8 rounded-lg text-xs" type="number" min={0} placeholder="MRP ₹" value={manual.mrp_inr ?? ""} onChange={(e) => setManual({ ...manual, mrp_inr: e.target.value ? Number(e.target.value) : undefined })} />
              <Input className="h-8 rounded-lg text-xs" type="number" min={0} placeholder="Sales/day" value={manual.avg_daily_sales ?? ""} onChange={(e) => setManual({ ...manual, avg_daily_sales: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <Button type="button" size="sm" variant="subtle" className="mt-2 h-8 rounded-lg text-xs" onClick={addManualRow}>
              <Plus className="size-3.5" /> Add product
            </Button>

            {value.planogramRows.length > 0 && (
              <div className="mt-3 max-h-32 overflow-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted/80 text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">Brand</th>
                      <th className="px-2 py-1.5 font-medium">Product</th>
                      <th className="px-2 py-1.5 font-medium">Qty</th>
                      <th className="px-2 py-1.5 font-medium">MRP</th>
                      <th className="px-2 py-1.5 font-medium">Sales/d</th>
                      <th className="px-2 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {value.planogramRows.map((row, i) => (
                      <tr key={`${row.brand}-${row.product_name}-${i}`} className="border-t border-border">
                        <td className="px-2 py-1.5">{row.brand}</td>
                        <td className="px-2 py-1.5">{row.product_name}</td>
                        <td className="px-2 py-1.5 tabular-nums">{row.expected_qty}</td>
                        <td className="px-2 py-1.5 tabular-nums">{row.mrp_inr ?? "—"}</td>
                        <td className="px-2 py-1.5 tabular-nums">{row.avg_daily_sales ?? "—"}</td>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Remove"
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
            )}
          </div>

          {hasActiveScanContext(value) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg text-xs text-muted-foreground"
              onClick={() => onChange(EMPTY_SCAN_CONTEXT)}
            >
              Clear filters & planogram
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Convert draft rows from PlanogramBuilder to plain planogram rows for scan context. */
export function draftRowsToPlanogram(rows: DraftRow[]): PlanogramRow[] {
  return rows.map(({ key: _key, ...row }) => row);
}
