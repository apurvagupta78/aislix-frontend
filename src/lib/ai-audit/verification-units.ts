import { astraAnalysisFromScanResult } from "@/lib/ai-audit/astra-response";
import type { ScanResult } from "@/lib/scan-results";

type ProductUnits = { brand?: string | null; product_name?: string | null; variant?: string | null; units: number };

function norm(text: string | null | undefined) {
  return (text ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Build a lookup from inventory rows (brand / product / variant) to the AI visible-unit count.
 * detected_products only persists facings, so units must come from the per-product AI analysis;
 * returns null when no single analysis row matches, never the facing count.
 */
export function buildVisibleUnitsLookup(rows: ProductUnits[]) {
  const exact = new Map<string, number>();
  const byProduct = new Map<string, number[]>();
  for (const row of rows) {
    const productKey = `${norm(row.brand)}|${norm(row.product_name)}`;
    exact.set(`${productKey}|${norm(row.variant)}`, (exact.get(`${productKey}|${norm(row.variant)}`) ?? 0) + row.units);
    byProduct.set(productKey, [...(byProduct.get(productKey) ?? []), row.units]);
  }
  return (brand: string | null | undefined, product: string | null | undefined, variant?: string | null) => {
    const productKey = `${norm(brand)}|${norm(product)}`;
    const hit = exact.get(`${productKey}|${norm(variant)}`);
    if (hit != null) return hit;
    const candidates = byProduct.get(productKey);
    return candidates?.length === 1 ? candidates[0]! : null;
  };
}

export function visibleUnitsLookupFromScan(result: ScanResult) {
  const analysis = astraAnalysisFromScanResult(result);
  if (analysis.mode !== "shelf_only" && analysis.mode !== "planogram") return () => null;
  const rows: ProductUnits[] = (analysis.products as Array<Record<string, unknown>>)
    .filter((p) => typeof p.actual_visible_units === "number")
    .map((p) => ({
      brand: p.brand as string | undefined,
      product_name: (p.product_name ?? p.product) as string | undefined,
      variant: p.variant as string | undefined,
      units: p.actual_visible_units as number,
    }));
  return buildVisibleUnitsLookup(rows);
}
