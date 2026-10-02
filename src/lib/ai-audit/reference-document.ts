/**
 * Customer reference documents (invoice, PO, price list, pick list, CSV) → editable
 * reference rows → expected products for an AI Audit compared against the shelf.
 */

import { emptyRow, type PlanogramRow } from "@/lib/planogram";

export type ReferenceRow = {
  id: string;
  line_no: number;
  brand: string;
  product: string;
  variant: string;
  pack_size: string;
  /** Quantity expected on the shelf, in single units when the document gave cases + units per case. */
  qty: number | null;
  unit: string;
  /** Expected shelf price: MRP when printed, otherwise the document's rate (flagged for the user to confirm). */
  price: number | null;
  location: string;
  raw_text: string;
  /** 0–1 reading confidence from Luna; null for CSV / manual rows. */
  confidence: number | null;
  /** Fields Luna could not read clearly — highlighted for the user to check. */
  check_fields: ReferenceField[];
};

export type ReferenceField = "brand" | "product" | "variant" | "pack_size" | "qty" | "unit" | "price" | "location";

export type ReferenceDocumentMeta = {
  source: "document" | "csv";
  filename: string | null;
  /** Original file in the org's scan-images folder (document uploads only). */
  storage_path: string | null;
  mime_type: string | null;
  document_type: string | null;
  supplier_name: string | null;
  buyer_or_store_name: string | null;
  document_number: string | null;
  document_date: string | null;
  currency: string | null;
  reading_quality: "GOOD" | "LIMITED" | "POOR" | null;
  printed_line_count: number | null;
  total_quantity: number | null;
  warnings: string[];
};

export type ReferenceDocumentState = {
  meta: ReferenceDocumentMeta;
  rows: ReferenceRow[];
};

export const LOW_CONFIDENCE = 0.7;

const CASE_UNITS = /^(case|cases|cs|ctn|ctns|carton|cartons|box|boxes|outer|outers)$/i;
const NON_ITEM_LINE =
  /^\s*(sub\s*-?\s*total|grand\s*total|total|net\s*amount|amount|gst|cgst|sgst|igst|cess|tax|vat|round(ing)?\s*off|freight|discount|less|add)\b/i;
const SHELF_PRICE_DOCUMENTS = new Set([
  "price_list",
  "promo_sheet",
  "planogram",
  "product_list",
  "shelf_photo",
  "product_label",
]);

let rowSeq = 0;
function rowId(): string {
  rowSeq += 1;
  return `ref-${Date.now().toString(36)}-${rowSeq}`;
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  const out = String(value).trim();
  return /^(null|none|n\/a|na|-|—)$/i.test(out) ? "" : out;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

const UNREADABLE_TO_FIELD: Record<string, ReferenceField> = {
  brand: "brand",
  product: "product",
  variant: "variant",
  pack_size: "pack_size",
  quantity: "qty",
  quantity_unit: "unit",
  units_per_case: "qty",
  free_quantity: "qty",
  unit_price: "price",
  mrp: "price",
  location: "location",
};

export function emptyReferenceMeta(source: ReferenceDocumentMeta["source"], filename: string | null): ReferenceDocumentMeta {
  return {
    source,
    filename,
    storage_path: null,
    mime_type: null,
    document_type: null,
    supplier_name: null,
    buyer_or_store_name: null,
    document_number: null,
    document_date: null,
    currency: null,
    reading_quality: null,
    printed_line_count: null,
    total_quantity: null,
    warnings: [],
  };
}

export function emptyReferenceRow(lineNo: number): ReferenceRow {
  return {
    id: rowId(),
    line_no: lineNo,
    brand: "",
    product: "",
    variant: "",
    pack_size: "",
    qty: null,
    unit: "",
    price: null,
    location: "",
    raw_text: "",
    confidence: null,
    check_fields: [],
  };
}

/** Shelf quantity for one document line: cases × units per case (+ free goods) when printed. */
export function shelfQuantity(line: Record<string, unknown>): { qty: number | null; unit: string } {
  const quantity = num(line.quantity);
  const unit = text(line.quantity_unit);
  const perCase = num(line.units_per_case);
  const free = num(line.free_quantity) ?? 0;
  if (quantity === null) return { qty: null, unit };
  if (CASE_UNITS.test(unit) && perCase) {
    return { qty: (quantity + free) * perCase, unit: "units" };
  }
  return { qty: quantity + free, unit };
}

/** Normalise Luna's document JSON into reference rows + document metadata. */
export function parseLunaDocument(payload: unknown, filename: string | null): ReferenceDocumentState {
  const root = obj(payload);
  const docMeta = obj(root.document_meta);
  const totals = obj(root.totals);
  const documentType = text(root.document_type).toLowerCase() || null;
  const quality = text(root.reading_quality).toUpperCase();
  const meta: ReferenceDocumentMeta = {
    ...emptyReferenceMeta("document", filename),
    document_type: documentType,
    supplier_name: text(docMeta.supplier_name) || null,
    buyer_or_store_name: text(docMeta.buyer_or_store_name) || null,
    document_number: text(docMeta.document_number) || null,
    document_date: text(docMeta.document_date) || null,
    currency: text(docMeta.currency) || null,
    reading_quality: quality === "GOOD" || quality === "LIMITED" || quality === "POOR" ? quality : null,
    printed_line_count: num(totals.printed_line_count),
    total_quantity: num(totals.total_quantity),
    warnings: Array.isArray(root.warnings) ? root.warnings.map(text).filter(Boolean) : [],
  };

  const items = Array.isArray(root.line_items) ? root.line_items.map(obj) : [];
  const rows: ReferenceRow[] = [];
  for (const line of items) {
    const raw = text(line.raw_text);
    const product = text(line.product);
    const brand = text(line.brand);
    if (!product && !brand && !raw) continue;
    if (!product && !brand && NON_ITEM_LINE.test(raw)) continue;
    const { qty, unit } = shelfQuantity(line);
    const mrp = num(line.mrp);
    const unitPrice = num(line.unit_price);
    const price = mrp ?? unitPrice;
    const priceIsTradeRate =
      mrp === null && unitPrice !== null && !(documentType && SHELF_PRICE_DOCUMENTS.has(documentType));
    const confidence = num(line.confidence);
    const unreadable = Array.isArray(line.unreadable_fields) ? line.unreadable_fields.map(text) : [];
    const check = new Set<ReferenceField>();
    for (const field of unreadable) {
      const mapped = UNREADABLE_TO_FIELD[field.toLowerCase()];
      if (mapped) check.add(mapped);
    }
    if (confidence !== null && confidence < LOW_CONFIDENCE) {
      for (const field of ["brand", "product", "qty", "price"] as const) check.add(field);
    }
    if (!brand) check.add("brand");
    if (priceIsTradeRate) check.add("price");
    const printedQty = num(line.quantity);
    const lineTotal = num(line.line_total);
    if (
      unitPrice !== null &&
      printedQty !== null &&
      lineTotal !== null &&
      lineTotal > 0 &&
      Math.abs(unitPrice * printedQty - lineTotal) > lineTotal * 0.01
    ) {
      check.add("price");
      check.add("qty");
      meta.warnings.push(
        `Line ${rows.length + 1}: rate × quantity does not match the printed amount — please check price and quantity.`,
      );
    }
    rows.push({
      id: rowId(),
      line_no: rows.length + 1,
      brand,
      product: product || (brand ? "" : raw),
      variant: text(line.variant),
      pack_size: text(line.pack_size),
      qty,
      unit,
      price,
      location: text(line.location),
      raw_text: raw,
      confidence: confidence === null ? null : Math.min(confidence, 1),
      check_fields: [...check],
    });
  }
  return { meta, rows };
}

const CSV_ALIASES: Record<ReferenceField | "raw_text", string[]> = {
  brand: ["brand", "brand name", "company", "manufacturer"],
  product: ["product", "product name", "product_name", "item", "item name", "description", "sku name", "name"],
  variant: ["variant", "flavour", "flavor", "type"],
  pack_size: ["pack", "pack size", "pack_size", "size", "weight", "uom size"],
  qty: ["qty", "quantity", "invoice qty", "invoice_qty", "units", "expected qty", "expected_qty", "count"],
  unit: ["unit", "uom", "quantity unit", "quantity_unit"],
  price: ["price", "mrp", "mrp_inr", "shelf price", "selling price", "expected price", "expected_price", "rate"],
  location: ["location", "bin", "bin code", "bin location", "shelf", "slot", "expected location", "expected_location"],
  raw_text: ["raw_text", "raw text", "line text"],
};

function normHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s]+/g, " ");
}

/** Map spreadsheet rows (header → value) to reference rows using common column names. */
export function referenceRowsFromTable(
  headers: string[],
  records: Array<Record<string, string>>,
): { rows: ReferenceRow[]; missingColumns: string[] } {
  const lookup = new Map(headers.map((h) => [normHeader(h), h]));
  const column = (field: keyof typeof CSV_ALIASES): string | null => {
    for (const alias of CSV_ALIASES[field]) {
      const hit = lookup.get(normHeader(alias));
      if (hit) return hit;
    }
    return null;
  };
  const cols = Object.fromEntries(
    (Object.keys(CSV_ALIASES) as Array<keyof typeof CSV_ALIASES>).map((field) => [field, column(field)]),
  ) as Record<keyof typeof CSV_ALIASES, string | null>;
  const missingColumns = cols.product || cols.brand ? [] : ["product"];
  const get = (record: Record<string, string>, field: keyof typeof CSV_ALIASES) => {
    const key = cols[field];
    return key ? text(record[key]) : "";
  };

  const rows: ReferenceRow[] = [];
  for (const record of records) {
    const product = get(record, "product");
    const brand = get(record, "brand");
    if (!product && !brand) continue;
    rows.push({
      ...emptyReferenceRow(rows.length + 1),
      brand,
      product,
      variant: get(record, "variant"),
      pack_size: get(record, "pack_size"),
      qty: num(get(record, "qty")),
      unit: get(record, "unit"),
      price: num(get(record, "price")),
      location: get(record, "location"),
      raw_text: get(record, "raw_text") || [brand, product, get(record, "variant")].filter(Boolean).join(" "),
      check_fields: brand ? [] : ["brand"],
    });
  }
  return { rows, missingColumns };
}

export const REFERENCE_CSV_HEADERS = [
  "Line",
  "Brand",
  "Product",
  "Variant",
  "Pack size",
  "Qty",
  "Unit",
  "Price",
  "Location",
  "Raw text",
  "Confidence",
] as const;

export function referenceRowsToCsvCells(rows: ReferenceRow[]): Array<Array<string | number | null>> {
  return rows.map((row) => [
    row.line_no,
    row.brand,
    row.product,
    row.variant,
    row.pack_size,
    row.qty,
    row.unit,
    row.price,
    row.location,
    row.raw_text,
    row.confidence === null ? null : Math.round(row.confidence * 100) / 100,
  ]);
}

/** Rows the scan can use: at least a product or brand name. */
export function usableReferenceRows(rows: ReferenceRow[]): ReferenceRow[] {
  return rows.filter((row) => row.product.trim() || row.brand.trim());
}

function productName(row: ReferenceRow): string {
  return row.product.trim() || row.brand.trim();
}

function variantWithPack(row: ReferenceRow): string {
  return [row.variant.trim(), row.pack_size.trim()].filter(Boolean).join(" ");
}

/**
 * Expected products for Astra + the planogram matcher. Presence is the target (1 facing);
 * document quantity / price / bin travel separately as reference items.
 */
export function referenceRowsToPlanogramRows(
  rows: ReferenceRow[],
  scope: { category?: string | null; subCategory?: string | null },
): PlanogramRow[] {
  return usableReferenceRows(rows).map((row) => ({
    ...emptyRow(),
    location: row.location.trim() || "—",
    category: scope.category?.trim() || "",
    sub_category: scope.subCategory?.trim() || "",
    brand: row.brand.trim(),
    product_name: productName(row),
    variant: variantWithPack(row),
    expected_qty: 1,
    expected_facings: 1,
    mrp_inr: row.price ?? undefined,
  }));
}

/** Per-line document expectations sent to the backend reference comparison. */
export function referenceItemsForScan(
  rows: ReferenceRow[],
  scope: { category?: string | null; subCategory?: string | null },
): Record<string, unknown>[] {
  return usableReferenceRows(rows).map((row) => ({
    line_no: row.line_no,
    raw_text: row.raw_text || null,
    brand: row.brand.trim() || null,
    product_name: productName(row),
    variant: variantWithPack(row) || null,
    pack_size: row.pack_size.trim() || null,
    category: scope.category?.trim() || null,
    sub_category: scope.subCategory?.trim() || null,
    invoice_qty: row.qty,
    quantity_unit: row.unit.trim() || null,
    expected_price: row.price,
    expected_location: row.location.trim() || null,
    confidence: row.confidence,
  }));
}

/** Persisted on the scan / assignment so the scan request can rebuild the comparison. */
export function referencePayload(
  state: ReferenceDocumentState,
  scope: { category?: string | null; subCategory?: string | null },
): { comparison_basis: "reference"; document: ReferenceDocumentMeta; items: Record<string, unknown>[] } {
  return {
    comparison_basis: "reference",
    document: state.meta,
    items: referenceItemsForScan(state.rows, scope),
  };
}

export function documentTypeLabel(type: string | null | undefined): string {
  if (!type) return "Document";
  return type
    .split("_")
    .map((part) => (part === "grn" ? "GRN" : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}
