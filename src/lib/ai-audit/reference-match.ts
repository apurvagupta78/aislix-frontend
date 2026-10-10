/** Persisted backend `reference_match` block: customer document vs shelf, per line. */

export type ReferenceVerdict = "MATCHES" | "PARTIAL" | "DOES_NOT_MATCH";

export type ReferencePresence = "FOUND" | "FOUND_VARIANT_UNVERIFIED" | "UNCLEAR" | "MISSING";

export type ReferenceQtyStatus =
  | "COVERED"
  | "BELOW_DOCUMENT"
  | "NOT_ON_SHELF"
  | "PENDING"
  | "NOT_COUNTED"
  | "NO_EXPECTED";

export type ReferenceMatchLine = {
  line_no: number;
  raw_text: string | null;
  brand: string | null;
  product_name: string | null;
  variant: string | null;
  pack_size: string | null;
  invoice_qty: number | null;
  quantity_unit: string | null;
  expected_price: number | null;
  expected_location: string | null;
  document_confidence: number | null;
  presence_status: ReferencePresence;
  actual_brand: string | null;
  actual_product_name: string | null;
  actual_variant: string | null;
  shelf_facings: number | null;
  shelf_units: number | null;
  qty_status: ReferenceQtyStatus;
  shelf_location_label: string | null;
  additional_location_labels: string[];
  location_status: string | null;
  visible_price: string | number | null;
  price_status: string | null;
  price_difference: number | null;
  /** Promotion the document lists for this line (Promo / Offer / Scheme column). */
  expected_promo: string | null;
  /** Offer Astra read on the shelf for this line; null when none was readable. */
  shelf_promotion: string | null;
  shelf_promo_price: string | number | null;
  /** PROMO_SEEN / PROMO_NOT_SEEN / UNEXPECTED_PROMO / NO_EXPECTED / NOT_ON_SHELF; null before promo reading. */
  promo_status: string | null;
};

export type ReferenceExtraProduct = {
  brand: string | null;
  product_name: string | null;
  variant: string | null;
  shelf_facings: number | null;
  shelf_units: number | null;
  shelf_location_label: string | null;
  visible_price: string | number | null;
  shelf_promotion: string | null;
  shelf_promo_price: string | number | null;
};

export type ReferenceMatchMetrics = {
  lines_total: number;
  lines_found: number;
  lines_unclear: number;
  lines_missing: number;
  presence_percent: number | null;
  invoice_qty_total: number | null;
  shelf_units_on_document_lines: number | null;
  qty_lines_checked: number;
  qty_lines_covered: number;
  price_lines_checked: number;
  price_lines_matched: number;
  price_lines_mismatched: number;
  price_match_percent: number | null;
  prices_on_document: number;
  location_lines_checked: number;
  location_lines_correct: number;
  location_lines_wrong: number;
  location_match_percent: number | null;
  locations_on_document: number;
  not_on_document: number;
  /** Null for scans made before promotion reading. */
  promo_lines_expected: number | null;
  promo_lines_seen: number | null;
  promo_lines_not_seen: number | null;
  shelf_promotions_read: number | null;
};

export type ReferenceMatch = {
  document: {
    source?: string | null;
    filename?: string | null;
    document_type?: string | null;
    supplier_name?: string | null;
    document_number?: string | null;
    document_date?: string | null;
    reading_quality?: string | null;
    storage_path?: string | null;
    mime_type?: string | null;
    /** Extra document / CSV column headers, in document order. */
    extra_columns: string[];
    /** User-renamed headers for the standard columns (e.g. price → "MRP"). */
    column_labels: Record<string, string>;
    /** Extra column the user's promotion lives in, after a rename. */
    promo_column: string | null;
  };
  count_pending: boolean;
  verdict: ReferenceVerdict | null;
  metrics: ReferenceMatchMetrics;
  lines: ReferenceMatchLine[];
  not_on_document: ReferenceExtraProduct[];
};

/**
 * Invoices, stock lists and price lists only expect each line to be present (1 facing), so
 * facing targets, facing % and expected share exist only for planograms or a facings column.
 */
export function referenceExpectsFacings(
  match: ReferenceMatch | null | undefined,
  expectedFacings: Array<number | null | undefined> = [],
): boolean {
  if (!match) return true;
  if ((match.document.document_type ?? "").trim().toLowerCase() === "planogram") return true;
  if (match.document.extra_columns.some((header) => /facing/i.test(header))) return true;
  return expectedFacings.some((value) => Number(value) > 1);
}

function rec(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function int(value: unknown): number {
  return numOrNull(value) ?? 0;
}

function strOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s || null;
}

function priceValue(value: unknown): string | number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return strOrNull(value);
}

const PRESENCE = new Set<ReferencePresence>(["FOUND", "FOUND_VARIANT_UNVERIFIED", "UNCLEAR", "MISSING"]);
const QTY = new Set<ReferenceQtyStatus>([
  "COVERED",
  "BELOW_DOCUMENT",
  "NOT_ON_SHELF",
  "PENDING",
  "NOT_COUNTED",
  "NO_EXPECTED",
]);
const VERDICTS = new Set<ReferenceVerdict>(["MATCHES", "PARTIAL", "DOES_NOT_MATCH"]);

function normalizeLine(raw: unknown, index: number): ReferenceMatchLine {
  const r = rec(raw) ?? {};
  const presence = String(r.presence_status ?? "").toUpperCase() as ReferencePresence;
  const qty = String(r.qty_status ?? "").toUpperCase() as ReferenceQtyStatus;
  return {
    line_no: numOrNull(r.line_no) ?? index + 1,
    raw_text: strOrNull(r.raw_text),
    brand: strOrNull(r.brand),
    product_name: strOrNull(r.product_name),
    variant: strOrNull(r.variant),
    pack_size: strOrNull(r.pack_size),
    invoice_qty: numOrNull(r.invoice_qty),
    quantity_unit: strOrNull(r.quantity_unit),
    expected_price: numOrNull(r.expected_price),
    expected_location: strOrNull(r.expected_location),
    document_confidence: numOrNull(r.document_confidence),
    presence_status: PRESENCE.has(presence) ? presence : "MISSING",
    actual_brand: strOrNull(r.actual_brand),
    actual_product_name: strOrNull(r.actual_product_name),
    actual_variant: strOrNull(r.actual_variant),
    shelf_facings: numOrNull(r.shelf_facings),
    shelf_units: numOrNull(r.shelf_units),
    qty_status: QTY.has(qty) ? qty : "NO_EXPECTED",
    shelf_location_label: strOrNull(r.shelf_location_label),
    additional_location_labels: Array.isArray(r.additional_location_labels)
      ? r.additional_location_labels.map(String)
      : [],
    location_status: strOrNull(r.location_status)?.toUpperCase() ?? null,
    visible_price: priceValue(r.visible_price),
    price_status: strOrNull(r.price_status)?.toUpperCase() ?? null,
    price_difference: numOrNull(r.price_difference),
    expected_promo: strOrNull(r.expected_promo),
    shelf_promotion: strOrNull(r.shelf_promotion),
    shelf_promo_price: priceValue(r.shelf_promo_price),
    promo_status: strOrNull(r.promo_status)?.toUpperCase() ?? null,
  };
}

function normalizeExtra(raw: unknown): ReferenceExtraProduct {
  const r = rec(raw) ?? {};
  return {
    brand: strOrNull(r.brand),
    product_name: strOrNull(r.product_name),
    variant: strOrNull(r.variant),
    shelf_facings: numOrNull(r.shelf_facings),
    shelf_units: numOrNull(r.shelf_units),
    shelf_location_label: strOrNull(r.shelf_location_label),
    visible_price: priceValue(r.visible_price),
    shelf_promotion: strOrNull(r.shelf_promotion),
    shelf_promo_price: priceValue(r.shelf_promo_price),
  };
}

export function normalizeReferenceMatch(raw: unknown): ReferenceMatch | undefined {
  const r = rec(raw);
  if (!r || r.available !== true) return undefined;
  const m = rec(r.metrics) ?? {};
  const doc = rec(r.document) ?? {};
  const verdict = String(r.verdict ?? "").toUpperCase() as ReferenceVerdict;
  return {
    document: {
      source: strOrNull(doc.source),
      filename: strOrNull(doc.filename),
      document_type: strOrNull(doc.document_type),
      supplier_name: strOrNull(doc.supplier_name),
      document_number: strOrNull(doc.document_number),
      document_date: strOrNull(doc.document_date),
      reading_quality: strOrNull(doc.reading_quality),
      storage_path: strOrNull(doc.storage_path),
      mime_type: strOrNull(doc.mime_type),
      extra_columns: Array.isArray(doc.extra_columns)
        ? doc.extra_columns.map((h) => String(h ?? "").trim()).filter(Boolean)
        : [],
      column_labels: Object.fromEntries(
        Object.entries(rec(doc.column_labels) ?? {})
          .map(([field, label]) => [field, String(label ?? "").trim()])
          .filter(([, label]) => label),
      ),
      promo_column: strOrNull(doc.promo_column),
    },
    count_pending: r.count_pending === true,
    verdict: VERDICTS.has(verdict) ? verdict : null,
    metrics: {
      lines_total: int(m.lines_total),
      lines_found: int(m.lines_found),
      lines_unclear: int(m.lines_unclear),
      lines_missing: int(m.lines_missing),
      presence_percent: numOrNull(m.presence_percent),
      invoice_qty_total: numOrNull(m.invoice_qty_total),
      shelf_units_on_document_lines: numOrNull(m.shelf_units_on_document_lines),
      qty_lines_checked: int(m.qty_lines_checked),
      qty_lines_covered: int(m.qty_lines_covered),
      price_lines_checked: int(m.price_lines_checked),
      price_lines_matched: int(m.price_lines_matched),
      price_lines_mismatched: int(m.price_lines_mismatched),
      price_match_percent: numOrNull(m.price_match_percent),
      prices_on_document: int(m.prices_on_document),
      location_lines_checked: int(m.location_lines_checked),
      location_lines_correct: int(m.location_lines_correct),
      location_lines_wrong: int(m.location_lines_wrong),
      location_match_percent: numOrNull(m.location_match_percent),
      locations_on_document: int(m.locations_on_document),
      not_on_document: int(m.not_on_document),
      promo_lines_expected: numOrNull(m.promo_lines_expected),
      promo_lines_seen: numOrNull(m.promo_lines_seen),
      promo_lines_not_seen: numOrNull(m.promo_lines_not_seen),
      shelf_promotions_read: numOrNull(m.shelf_promotions_read),
    },
    lines: (Array.isArray(r.lines) ? r.lines : []).map(normalizeLine),
    not_on_document: (Array.isArray(r.not_on_document) ? r.not_on_document : []).map(normalizeExtra),
  };
}

/** Looks in the analysis block, then the scan root / metrics / result. */
export function findReferenceMatch(
  block: Record<string, unknown>,
  root?: Record<string, unknown> | null,
): ReferenceMatch | undefined {
  const nested = root ? (rec(root.metrics) ?? rec(root.result)) : null;
  return normalizeReferenceMatch(block.reference_match ?? root?.reference_match ?? nested?.reference_match);
}
