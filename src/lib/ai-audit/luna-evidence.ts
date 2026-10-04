import type { LunaAnalysisEvidence } from "@/lib/ai-audit/prompts/luna-analysis.prompt";
import type { ReferenceMatch } from "@/lib/ai-audit/reference-match";

type ShelfProduct = {
  name: string;
  brand: string | null;
  variant: string | null;
  facings: number;
  price_inr: number | null;
  stock_status: string;
  confidence: number | null;
};

function rowText(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function rowNumber(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const n = Number(row[key]);
    if (row[key] !== null && row[key] !== undefined && row[key] !== "" && Number.isFinite(n)) return n;
  }
  return null;
}

/** Shelf products from a raw scan payload's inventory rows (landing demo / backend JSON). */
export function shelfProductsFromRows(rows: unknown): ShelfProduct[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
    .map((r) => ({
      name: rowText(r, "product", "product_name", "name") ?? "",
      brand: rowText(r, "brand"),
      variant: rowText(r, "variant"),
      facings: Math.max(0, Math.round(rowNumber(r, "facings", "actual_facings", "quantity", "count") ?? 0)),
      price_inr: rowNumber(r, "price_inr", "visible_price", "price"),
      stock_status: rowText(r, "stock_status", "status_label") ?? "",
      confidence: rowNumber(r, "confidence"),
    }))
    .filter((p) => p.name);
}

function compact<T extends Record<string, unknown>>(row: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(row).filter(([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)),
  ) as Partial<T>;
}

/** Persisted Astra + Aislix numbers, trimmed to what Luna needs to answer the user. */
export function buildLunaEvidence(input: {
  referenceMatch: ReferenceMatch | undefined;
  products: ShelfProduct[];
  brandShare: { brand: string; share: number }[];
  totalFacings: number;
  countPending: boolean;
  photoCount: number | null;
}): LunaAnalysisEvidence {
  const match = input.referenceMatch;
  return {
    documentLines: (match?.lines ?? []).map((line) =>
      compact({
        line_no: line.line_no,
        document_product: [line.brand, line.product_name, line.variant].filter(Boolean).join(" ") || line.raw_text,
        document_qty: line.invoice_qty,
        document_unit: line.quantity_unit,
        document_price: line.expected_price,
        document_location: line.expected_location,
        presence: line.presence_status,
        shelf_product: [line.actual_brand, line.actual_product_name, line.actual_variant].filter(Boolean).join(" "),
        shelf_facings: line.shelf_facings,
        shelf_units: line.shelf_units,
        qty_status: line.qty_status,
        shelf_location: line.shelf_location_label,
        location_status: line.location_status,
        visible_price: line.visible_price,
        price_status: line.price_status,
        price_difference: line.price_difference,
      }),
    ),
    notOnDocument: (match?.not_on_document ?? []).map((p) =>
      compact({
        product: [p.brand, p.product_name, p.variant].filter(Boolean).join(" "),
        shelf_facings: p.shelf_facings,
        shelf_units: p.shelf_units,
        shelf_location: p.shelf_location_label,
        visible_price: p.visible_price,
      }),
    ),
    shelfProducts: input.products.map((p) =>
      compact({
        product: [p.brand, p.name, p.variant].filter(Boolean).join(" "),
        facings: p.facings,
        visible_price: p.price_inr,
        stock_status: p.stock_status,
        confidence: p.confidence,
      }),
    ),
    metrics: compact({
      total_facings: input.totalFacings,
      brand_share_percent: input.brandShare.slice(0, 12).map((b) => ({ brand: b.brand, share: b.share })),
      ...(match
        ? {
            document_verdict: match.verdict,
            lines_total: match.metrics.lines_total,
            lines_found: match.metrics.lines_found,
            lines_unclear: match.metrics.lines_unclear,
            lines_missing: match.metrics.lines_missing,
            presence_percent: match.metrics.presence_percent,
            qty_lines_checked: match.metrics.qty_lines_checked,
            qty_lines_covered: match.metrics.qty_lines_covered,
            price_lines_checked: match.metrics.price_lines_checked,
            price_lines_matched: match.metrics.price_lines_matched,
            price_lines_mismatched: match.metrics.price_lines_mismatched,
            price_match_percent: match.metrics.price_match_percent,
            location_lines_checked: match.metrics.location_lines_checked,
            location_lines_correct: match.metrics.location_lines_correct,
            location_lines_wrong: match.metrics.location_lines_wrong,
            location_match_percent: match.metrics.location_match_percent,
            products_not_on_document: match.metrics.not_on_document,
          }
        : {}),
    }),
    countPending: input.countPending || Boolean(match?.count_pending),
    photoCount: input.photoCount,
  };
}
