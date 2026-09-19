import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  emptyExpectedProduct,
  normalizeExpectedProduct,
  type ExpectedProduct,
} from "@/lib/ai-audit/expected-products";
import type { ScanContextState } from "@/lib/scan-context";

type Props = {
  scanContext: ScanContextState;
  onScanContextChange: (next: ScanContextState) => void;
};

function updateRow(rows: ExpectedProduct[], index: number, patch: Partial<ExpectedProduct>) {
  return rows.map((row, i) => (i === index ? normalizeExpectedProduct({ ...row, ...patch }) : row));
}

export function ExpectedProductsPanel({ scanContext, onScanContextChange }: Props) {
  const rows = scanContext.expectedProducts ?? [];
  const categoryDefault = scanContext.planogramMeta?.category?.trim() ?? "";
  const subCategoryDefault = scanContext.planogramMeta?.sub_category?.trim() ?? "";

  function setRows(next: ExpectedProduct[]) {
    onScanContextChange({ ...scanContext, expectedProducts: next });
  }

  function addRow() {
    setRows([
      ...rows,
      emptyExpectedProduct({
        category: categoryDefault,
        sub_category: subCategoryDefault,
      }),
    ]);
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border/80 bg-card/60 p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Expected products (optional)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add products with category, brand, facings and units to compare against your shelf photo.
          Leave empty for general shelf detection only.
        </p>
      </div>

      {rows.length ? (
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2">Location</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Subcategory</th>
                <th className="px-2 py-2">Brand</th>
                <th className="px-2 py-2">Product</th>
                <th className="px-2 py-2">Variant</th>
                <th className="px-2 py-2">Exp. facings</th>
                <th className="px-2 py-2">Exp. units</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`expected-${index}`} className="border-t border-border/60">
                  {(
                    [
                      ["location", "text"],
                      ["category", "text"],
                      ["sub_category", "text"],
                      ["brand", "text"],
                      ["product_name", "text"],
                      ["variant", "text"],
                      ["expected_facings", "number"],
                      ["expected_shelf_units", "number"],
                    ] as const
                  ).map(([field, type]) => (
                    <td key={field} className="px-2 py-1.5">
                      <Input
                        className="h-8 min-w-[88px] text-xs"
                        type={type}
                        min={type === "number" ? 0 : undefined}
                        value={String(row[field] ?? "")}
                        onChange={(event) =>
                          setRows(
                            updateRow(rows, index, {
                              [field]:
                                type === "number"
                                  ? Math.max(0, Number(event.target.value) || 0)
                                  : event.target.value,
                            }),
                          )
                        }
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setRows(rows.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="size-4" /> Add expected product
      </Button>
    </div>
  );
}
