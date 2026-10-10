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
  /** Every other document / CSV column, kept as printed (header → value). */
  extra: Record<string, string>;
  /** 0–1 reading confidence from Luna; null for CSV / manual rows. */
  confidence: number | null;
  /** Fields Luna could not read clearly — highlighted for the user to check. */
  check_fields: ReferenceField[];
};

export type ReferenceField = "brand" | "product" | "variant" | "pack_size" | "qty" | "unit" | "price" | "location";

export type ReferenceDocumentMeta = {
  /** "manual": a product list typed in Aislix (AI Audit · Start from scratch). */
  source: "document" | "csv" | "manual";
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
  /** Headers of the extra columns, in document order. */
  extra_columns: string[];
  /** User-renamed headers for the standard columns; the field keeps its meaning for the shelf check. */
  column_labels?: Partial<Record<ReferenceField, string>>;
  /** Extra column holding the expected promotion, once the user has renamed it. */
  promo_column?: string | null;
  warnings: string[];
};

export const REFERENCE_FIELD_HEADERS: Record<ReferenceField, string> = {
  brand: "Brand",
  product: "Product",
  variant: "Variant",
  pack_size: "Pack",
  qty: "Qty",
  unit: "Unit",
  price: "Price ₹",
  location: "Location",
};

export const REFERENCE_FIELDS = Object.keys(REFERENCE_FIELD_HEADERS) as ReferenceField[];

export type ReferenceDocumentState = {
  meta: ReferenceDocumentMeta;
  rows: ReferenceRow[];
  /** False while the user has unsaved edits in the lines table. */
  saved?: boolean;
};

export const LOW_CONFIDENCE = 0.7;

const CASE_UNITS = /^(case|cases|cs|ctn|ctns|carton|cartons|box|boxes|outer|outers)$/i;
export const NON_ITEM_LINE =
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

function signedNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  const negative = /^\(.*\)$/.test(raw) || /^-/.test(raw.replace(/^[^\d-]+/, ""));
  const digits = raw.replace(/[^\d.]/g, "");
  if (!digits || digits === ".") return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : null;
}

function num(value: unknown): number | null {
  const parsed = signedNum(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
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

/** Document fields without a dedicated column, shown as extra columns when any line has them. */
const LUNA_EXTRA_FIELDS: Array<[string, string]> = [
  ["sku_code", "SKU code"],
  ["barcode", "Barcode"],
  ["hsn_code", "HSN"],
  ["unit_price", "Rate"],
  ["free_quantity", "Free qty"],
  ["units_per_case", "Units per case"],
  ["discount_text", "Discount"],
  ["line_total", "Amount"],
  ["promo_text", "Promo"],
];

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
    extra_columns: [],
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
    extra: {},
    confidence: null,
    check_fields: [],
  };
}

/** Empty typed product list: the user fills in what should be on the shelf (with a Promo column). */
export function blankProductList(lines = 3): ReferenceDocumentState {
  return {
    meta: { ...emptyReferenceMeta("manual", null), document_type: "product_list", extra_columns: [PROMO_COLUMN] },
    rows: Array.from({ length: lines }, (_, i) => emptyReferenceRow(i + 1)),
    saved: true,
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
  const extraColumns = new Set<string>();
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
    const values: Record<ReferenceField, unknown> = {
      brand,
      product: product || raw,
      variant: text(line.variant),
      pack_size: text(line.pack_size),
      qty,
      unit,
      price,
      location: text(line.location),
    };
    for (const field of [...check]) {
      if (values[field] === null || values[field] === "") check.delete(field);
    }
    const extra: Record<string, string> = {};
    for (const [key, header] of LUNA_EXTRA_FIELDS) {
      if (key === "unit_price" && mrp === null) continue;
      const value = text(line[key]);
      if (!value) continue;
      extra[header] = value;
      extraColumns.add(header);
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
      extra,
      confidence: confidence === null ? null : Math.min(confidence, 1),
      check_fields: [...check],
    });
  }
  meta.extra_columns = LUNA_EXTRA_FIELDS.map(([, header]) => header).filter((h) => extraColumns.has(h));
  return { meta, rows };
}

type CsvField = ReferenceField | "raw_text";

/** Exact header names per field, strongest first. */
const CSV_ALIASES: Record<CsvField, string[]> = {
  brand: ["brand", "brand name", "company", "manufacturer", "make"],
  product: [
    "product",
    "product name",
    "item",
    "item name",
    "item description",
    "description",
    "particulars",
    "sku name",
    "article",
    "name",
  ],
  variant: ["variant", "flavour", "flavor", "type"],
  pack_size: ["pack", "pack size", "size", "weight", "uom size", "net weight"],
  qty: [
    "qty",
    "quantity",
    "invoice qty",
    "units",
    "expected qty",
    "expected shelf units",
    "shelf units",
    "expected units",
    "count",
    "pcs",
    "nos",
  ],
  unit: ["unit", "uom", "quantity unit"],
  price: [
    "price",
    "mrp",
    "mrp inr",
    "shelf price",
    "selling price",
    "expected price",
    "unit price",
    "rate",
    "net rate",
    "sp",
    "cost",
    "unit cost",
    "amount",
    "value",
    "total",
  ],
  location: ["location", "bin", "bin code", "bin location", "shelf", "slot", "rack", "expected location"],
  raw_text: ["raw text", "line text"],
};

/** Fallback when no exact alias matched: header contains one of these words. */
const CSV_KEYWORDS: Array<[CsvField, RegExp]> = [
  ["brand", /\bbrand\b/],
  ["price", /\b(price|mrp|rate)\b/],
  ["price", /\b(amount|cost|value)\b/],
  ["qty", /\b(qty|quantity)\b/],
  ["location", /\b(location|bin|shelf|slot|rack)\b/],
  ["product", /\b(product|item|description|particulars|article|name)\b/],
  ["pack_size", /\b(pack|size|weight)\b/],
  ["variant", /\b(variant|flavou?r)\b/],
  ["unit", /\b(unit|uom)\b/],
];

function normHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[₹$€£]/g, " ")
    .replace(/\b(rs|inr|usd)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Assign each CSV header to at most one reference field; the rest stay as extra columns. */
export function mapReferenceColumns(headers: string[]): {
  columns: Partial<Record<CsvField, string>>;
  extraColumns: string[];
} {
  const normalized = headers.map((h) => ({ header: h, norm: normHeader(h) }));
  const used = new Set<string>();
  const columns: Partial<Record<CsvField, string>> = {};
  for (const field of Object.keys(CSV_ALIASES) as CsvField[]) {
    for (const alias of CSV_ALIASES[field]) {
      const hit = normalized.find((h) => !used.has(h.header) && h.norm === alias);
      if (hit) {
        columns[field] = hit.header;
        used.add(hit.header);
        break;
      }
    }
  }
  for (const [field, pattern] of CSV_KEYWORDS) {
    if (columns[field]) continue;
    const hit = normalized.find((h) => !used.has(h.header) && pattern.test(h.norm));
    if (hit) {
      columns[field] = hit.header;
      used.add(hit.header);
    }
  }
  return { columns, extraColumns: headers.filter((h) => h.trim() && !used.has(h)) };
}

function mostlyText(records: Array<Record<string, string>>, header: string): boolean {
  const values = records.map((r) => text(r[header])).filter(Boolean);
  if (!values.length) return false;
  return values.filter((v) => signedNum(v) === null || /[a-z]/i.test(v)).length / values.length >= 0.5;
}

/** Map spreadsheet rows (header → value) to reference rows. Every column and row is kept. */
export function referenceRowsFromTable(
  headers: string[],
  records: Array<Record<string, string>>,
): { rows: ReferenceRow[]; extraColumns: string[] } {
  const { columns, extraColumns: unmapped } = mapReferenceColumns(headers);
  let extraColumns = unmapped;
  if (!columns.product && !columns.brand) {
    const fallback = unmapped.find((h) => mostlyText(records, h));
    if (fallback) {
      columns.product = fallback;
      extraColumns = unmapped.filter((h) => h !== fallback);
    }
  }
  const get = (record: Record<string, string>, field: CsvField) => {
    const key = columns[field];
    return key ? text(record[key]) : "";
  };

  const rows: ReferenceRow[] = [];
  for (const record of records) {
    if (!headers.some((h) => text(record[h]))) continue;
    const product = get(record, "product");
    const brand = get(record, "brand");
    const extra: Record<string, string> = {};
    for (const header of extraColumns) {
      const value = text(record[header]);
      if (value) extra[header] = value;
    }
    rows.push({
      ...emptyReferenceRow(rows.length + 1),
      brand,
      product,
      variant: get(record, "variant"),
      pack_size: get(record, "pack_size"),
      qty: signedNum(get(record, "qty")),
      unit: get(record, "unit"),
      price: signedNum(get(record, "price")),
      location: get(record, "location"),
      raw_text: get(record, "raw_text") || headers.map((h) => text(record[h])).filter(Boolean).join(" · "),
      extra,
    });
  }
  return { rows, extraColumns };
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

export function referenceCsvHeaders(
  extraColumns: string[],
  labels: Partial<Record<ReferenceField, string>> = {},
): string[] {
  const standard = REFERENCE_FIELDS.map((field, i) => labels[field]?.trim() || REFERENCE_CSV_HEADERS[i + 1]);
  return [REFERENCE_CSV_HEADERS[0], ...standard, ...extraColumns, ...REFERENCE_CSV_HEADERS.slice(-2)];
}

export function referenceRowsToCsvCells(
  rows: ReferenceRow[],
  extraColumns: string[] = [],
): Array<Array<string | number | null>> {
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
    ...extraColumns.map((header) => row.extra?.[header] ?? ""),
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

/** Planogram columns a document / CSV may carry as extra columns (Aislix planogram template and common variants). */
const PLANOGRAM_EXTRA: Record<
  "category" | "sub_category" | "facings" | "min_facings" | "max_facings" | "shelf_position" | "sku" | "avg_daily_sales",
  string[]
> = {
  category: ["category", "category name"],
  sub_category: ["sub category", "subcategory", "sub category name"],
  facings: ["expected facings", "facings", "planned facings", "planogram facings", "target facings"],
  min_facings: ["min facings", "minimum facings"],
  max_facings: ["max facings", "maximum facings"],
  shelf_position: ["shelf position", "position", "shelf level"],
  sku: ["product id", "sku", "sku id", "sku code"],
  avg_daily_sales: ["avg daily sales", "average daily sales", "daily sales"],
};

function extraText(row: Pick<ReferenceRow, "extra">, key: keyof typeof PLANOGRAM_EXTRA): string {
  const aliases = PLANOGRAM_EXTRA[key];
  for (const [header, value] of Object.entries(row.extra ?? {})) {
    if (aliases.includes(normHeader(header)) && text(value)) return text(value);
  }
  return "";
}

function extraNumber(row: Pick<ReferenceRow, "extra">, key: keyof typeof PLANOGRAM_EXTRA): number | undefined {
  return num(extraText(row, key)) ?? undefined;
}

/** The document's own category / sub-category (most common value across lines), when it has those columns. */
export function referenceDocumentScope(rows: ReferenceRow[]): { category: string | null; subCategory: string | null } {
  const mostCommon = (key: "category" | "sub_category") => {
    const counts = new Map<string, number>();
    for (const row of usableReferenceRows(rows)) {
      const value = extraText(row, key);
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  return { category: mostCommon("category"), subCategory: mostCommon("sub_category") };
}

/**
 * Expected products for Astra + the planogram matcher. A planogram document's own facings,
 * min / max, shelf units, category and position are the targets; other documents only
 * expect presence (1 facing). Document quantity / price / bin also travel as reference items.
 */
export function referenceRowsToPlanogramRows(
  rows: ReferenceRow[],
  scope: { category?: string | null; subCategory?: string | null },
): PlanogramRow[] {
  return usableReferenceRows(rows).map((row) => {
    const facings = extraNumber(row, "facings");
    return {
      ...emptyRow(),
      location: row.location.trim() || "—",
      category: extraText(row, "category") || scope.category?.trim() || "",
      sub_category: extraText(row, "sub_category") || scope.subCategory?.trim() || "",
      brand: row.brand.trim(),
      product_name: productName(row),
      variant: variantWithPack(row),
      expected_qty: facings ?? 1,
      expected_facings: facings ?? 1,
      min_facings: extraNumber(row, "min_facings"),
      max_facings: extraNumber(row, "max_facings"),
      expected_shelf_units: facings !== undefined ? (row.qty ?? undefined) : undefined,
      mrp_inr: row.price ?? undefined,
      avg_daily_sales: extraNumber(row, "avg_daily_sales"),
      sku: extraText(row, "sku"),
      shelf_position: extraText(row, "shelf_position"),
    };
  });
}

export const PROMO_COLUMN = "Promo";
const PROMO_HEADER = /promo|offer|scheme|deal/i;

/** The line's promotion: the user's promo column when set, else a Promo / Offer / Scheme column. */
export function referencePromo(row: Pick<ReferenceRow, "extra">, promoColumn?: string | null): string | null {
  if (promoColumn) return text(row.extra?.[promoColumn]) || null;
  for (const [header, value] of Object.entries(row.extra ?? {})) {
    if (PROMO_HEADER.test(header) && text(value)) return text(value);
  }
  return null;
}

/** Header shown for a standard column (the user's name, else the default). */
export function referenceColumnLabel(meta: ReferenceDocumentMeta | undefined, field: ReferenceField): string {
  return meta?.column_labels?.[field]?.trim() || REFERENCE_FIELD_HEADERS[field];
}

function promoColumnOf(meta: ReferenceDocumentMeta): string | null {
  if (meta.promo_column && meta.extra_columns.includes(meta.promo_column)) return meta.promo_column;
  return null;
}

function headerTaken(meta: ReferenceDocumentMeta, label: string, except?: string): boolean {
  const key = label.trim().toLowerCase();
  const headers = [...REFERENCE_FIELDS.map((f) => referenceColumnLabel(meta, f)), ...meta.extra_columns];
  return headers.some((h) => h !== except && h.trim().toLowerCase() === key);
}

export type ColumnEditResult = { state: ReferenceDocumentState } | { error: string };

/** Rename a standard column (label only — it is still checked as that field) or an extra column. */
export function renameReferenceColumn(
  state: ReferenceDocumentState,
  column: { field: ReferenceField } | { extra: string },
  name: string,
): ColumnEditResult {
  const label = name.trim();
  if (!label) return { error: "Column name cannot be empty." };
  const meta = state.meta;
  if ("field" in column) {
    const current = referenceColumnLabel(meta, column.field);
    if (label === current) return { state };
    if (headerTaken(meta, label, current)) return { error: `There is already a column called "${label}".` };
    const labels = { ...meta.column_labels };
    if (label === REFERENCE_FIELD_HEADERS[column.field]) delete labels[column.field];
    else labels[column.field] = label;
    return { state: { ...state, meta: { ...meta, column_labels: labels } } };
  }
  const from = column.extra;
  if (label === from) return { state };
  if (headerTaken(meta, label, from)) return { error: `There is already a column called "${label}".` };
  const isPromo = promoColumnOf(meta) === from || (!promoColumnOf(meta) && PROMO_HEADER.test(from));
  return {
    state: {
      ...state,
      meta: {
        ...meta,
        extra_columns: meta.extra_columns.map((h) => (h === from ? label : h)),
        promo_column: isPromo ? label : meta.promo_column,
      },
      rows: state.rows.map((row) => {
        if (!(from in (row.extra ?? {}))) return row;
        const extra = { ...row.extra, [label]: row.extra[from] };
        delete extra[from];
        return { ...row, extra };
      }),
    },
  };
}

/** Append an empty extra column with a unique placeholder name. */
export function addReferenceColumn(state: ReferenceDocumentState): { state: ReferenceDocumentState; header: string } {
  let header = "New column";
  for (let n = 2; headerTaken(state.meta, header); n += 1) header = `New column ${n}`;
  return { state: { ...state, meta: { ...state.meta, extra_columns: [...state.meta.extra_columns, header] } }, header };
}

/** Drop an extra column and its values (standard columns cannot be removed). */
export function removeReferenceColumn(state: ReferenceDocumentState, header: string): ReferenceDocumentState {
  return {
    ...state,
    meta: {
      ...state.meta,
      extra_columns: state.meta.extra_columns.filter((h) => h !== header),
      promo_column: state.meta.promo_column === header ? null : state.meta.promo_column,
    },
    rows: state.rows.map((row) => {
      if (!(header in (row.extra ?? {}))) return row;
      const extra = { ...row.extra };
      delete extra[header];
      return { ...row, extra };
    }),
  };
}

/** Per-line document expectations sent to the backend reference comparison. */
export function referenceItemsForScan(
  rows: ReferenceRow[],
  scope: { category?: string | null; subCategory?: string | null },
  promoColumn?: string | null,
): Record<string, unknown>[] {
  return usableReferenceRows(rows).map((row) => ({
    line_no: row.line_no,
    raw_text: row.raw_text || null,
    brand: row.brand.trim() || null,
    product_name: productName(row),
    variant: variantWithPack(row) || null,
    pack_size: row.pack_size.trim() || null,
    category: extraText(row, "category") || scope.category?.trim() || null,
    sub_category: extraText(row, "sub_category") || scope.subCategory?.trim() || null,
    invoice_qty: row.qty,
    quantity_unit: row.unit.trim() || null,
    expected_price: row.price,
    expected_location: row.location.trim() || null,
    expected_promo: referencePromo(row, promoColumn),
    confidence: row.confidence,
    ...(row.extra && Object.keys(row.extra).length ? { extra_fields: row.extra } : {}),
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
    items: referenceItemsForScan(state.rows, scope, promoColumnOf(state.meta)),
  };
}

export function documentTypeLabel(type: string | null | undefined): string {
  if (!type) return "Document";
  return type
    .split("_")
    .map((part) => (part === "grn" ? "GRN" : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}
