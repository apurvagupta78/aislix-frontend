/**
 * One verifiable row per product: what the planogram / document expected, what the AI detected
 * and (later) what a human verified, for every field. Pure — built from persisted scan data.
 */

import type {
  AstraPlanogramProduct,
  AstraShelfProduct,
  AstraUnplannedProduct,
  NormalizedAstraAnalysis,
} from "@/lib/ai-audit/astra-response";
import {
  TEXT_VERIFICATION_FIELDS,
  verifiedFieldValue,
  type FieldVerification,
  type VerificationFieldKey,
} from "@/lib/ai-audit/field-verifications";
import type { ReferenceExtraProduct, ReferenceMatchLine } from "@/lib/ai-audit/reference-match";

export type FieldValue = string | number | null;

export const VERIFY_FIELDS: ReadonlyArray<{ key: VerificationFieldKey; label: string; kind: "bool" | "text" | "number" }> = [
  { key: "present", label: "On shelf", kind: "bool" },
  { key: "brand", label: "Brand", kind: "text" },
  { key: "product", label: "Product / variant", kind: "text" },
  { key: "facings", label: "Facings", kind: "number" },
  { key: "visible_units", label: "Visible units", kind: "number" },
  { key: "location", label: "Location", kind: "text" },
  { key: "price", label: "Price (₹)", kind: "number" },
  { key: "promotion", label: "Promotion", kind: "text" },
];

type FieldRecord = Record<VerificationFieldKey, FieldValue>;

export type VerificationRow = {
  rowKey: string;
  detectedProductId: string | null;
  /** Expected identity when the row is planned, else the AI identity. */
  identity: { brand: string | null; product: string | null; variant: string | null };
  label: string;
  planned: boolean;
  category?: string | null;
  sku?: string | null;
  expected: FieldRecord;
  ai: FieldRecord;
  /** Status the pipeline persisted for this field (location / price / promotion), when assessed. */
  pipelineStatus: Partial<Record<VerificationFieldKey, string | null>>;
};

export type InventoryRowLike = {
  id: string;
  brand?: string | null;
  product?: string | null;
  variant?: string | null;
  facings?: number | null;
  quantity?: number | null;
};

function norm(text: unknown): string {
  return String(text ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function str(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function count(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** "₹1,299.00" / "Rs 45" / "45" → number; null when no price is readable. */
export function priceNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const match = String(value).replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function productText(product: string | null, variant: string | null): string | null {
  if (!product) return variant;
  if (variant && !product.toLowerCase().includes(variant.toLowerCase())) return `${product} ${variant}`;
  return product;
}

function rowLabel(brand: string | null, product: string | null, variant: string | null): string {
  const name = productText(product, variant);
  if (brand && name && !name.toLowerCase().startsWith(brand.toLowerCase())) return `${brand} · ${name}`;
  return name ?? brand ?? "Product";
}

function emptyRecord(): FieldRecord {
  return {
    present: null,
    brand: null,
    product: null,
    facings: null,
    visible_units: null,
    location: null,
    price: null,
    promotion: null,
  };
}

type Draft = Omit<VerificationRow, "rowKey" | "detectedProductId" | "label"> & {
  aiKey: { brand: string | null; product: string | null; variant: string | null } | null;
};

function fromPlanogram(p: AstraPlanogramProduct): Draft {
  const found = p.match_status !== "NOT_FOUND";
  const aiBrand = str(p.actual_brand) ?? (found ? str(p.brand) : null);
  const aiProduct = str(p.actual_product_name) ?? (found ? str(p.product_name) : null);
  const aiVariant = str(p.actual_variant) ?? (found ? str(p.variant) : null);
  return {
    identity: { brand: str(p.brand), product: str(p.product_name), variant: str(p.variant) },
    planned: true,
    category: str(p.category),
    sku: str(p.sku),
    expected: {
      ...emptyRecord(),
      present: 1,
      brand: str(p.brand),
      product: productText(str(p.product_name), str(p.variant)),
      facings: p.expected_facings > 0 ? p.expected_facings : null,
      visible_units: p.expected_shelf_units > 0 ? p.expected_shelf_units : null,
      location: str(p.expected_location),
      price: p.expected_mrp_inr > 0 ? p.expected_mrp_inr : null,
    },
    ai: {
      ...emptyRecord(),
      present: found ? 1 : 0,
      brand: found ? aiBrand : null,
      product: found ? productText(aiProduct, aiVariant) : null,
      facings: found ? count(p.actual_facings) : 0,
      visible_units: found ? count(p.actual_visible_units) : null,
      location: found ? str(p.actual_location_label) : null,
      price: found ? priceNumber(p.visible_price) : null,
    },
    pipelineStatus: { location: str(p.location_status), price: str(p.price_status) },
    aiKey: found ? { brand: aiBrand, product: aiProduct, variant: aiVariant } : null,
  };
}

function fromReferenceLine(l: ReferenceMatchLine, planned?: AstraPlanogramProduct): Draft {
  const found = l.presence_status !== "MISSING";
  return {
    identity: { brand: l.brand, product: l.product_name, variant: l.variant },
    planned: true,
    category: planned ? str(planned.category) : null,
    sku: planned ? str(planned.sku) : null,
    expected: {
      ...emptyRecord(),
      present: 1,
      brand: l.brand,
      product: productText(l.product_name, l.variant),
      facings: planned && planned.expected_facings > 0 ? planned.expected_facings : null,
      visible_units: l.invoice_qty,
      location: l.expected_location,
      price: l.expected_price,
      promotion: l.expected_promo,
    },
    ai: {
      ...emptyRecord(),
      present: l.presence_status === "UNCLEAR" ? null : found ? 1 : 0,
      brand: found ? (l.actual_brand ?? l.brand) : null,
      product: found ? productText(l.actual_product_name ?? l.product_name, l.actual_variant ?? l.variant) : null,
      facings: found ? l.shelf_facings : 0,
      visible_units: found ? l.shelf_units : 0,
      location: found ? l.shelf_location_label : null,
      price: found ? priceNumber(l.visible_price) : null,
      promotion: found ? l.shelf_promotion : null,
    },
    pipelineStatus: { location: l.location_status, price: l.price_status, promotion: l.promo_status },
    aiKey: found
      ? { brand: l.actual_brand ?? l.brand, product: l.actual_product_name ?? l.product_name, variant: l.actual_variant ?? l.variant }
      : null,
  };
}

function aiOnly(input: {
  brand: string | null;
  product: string | null;
  variant: string | null;
  facings: number | null;
  units: number | null;
  location?: string | null;
  price?: unknown;
  promotion?: string | null;
  category?: string | null;
}): Draft {
  return {
    identity: { brand: input.brand, product: input.product, variant: input.variant },
    planned: false,
    category: input.category ?? null,
    sku: null,
    expected: emptyRecord(),
    ai: {
      ...emptyRecord(),
      present: 1,
      brand: input.brand,
      product: productText(input.product, input.variant),
      facings: input.facings,
      visible_units: input.units,
      location: input.location ?? null,
      price: priceNumber(input.price),
      promotion: input.promotion ?? null,
    },
    pipelineStatus: {},
    aiKey: { brand: input.brand, product: input.product, variant: input.variant },
  };
}

function shelfDraft(p: AstraShelfProduct): Draft {
  return aiOnly({
    brand: str(p.brand),
    product: str(p.product_name),
    variant: str(p.variant),
    facings: count(p.actual_facings),
    units: count(p.actual_visible_units),
    location: str(p.location_label),
    price: p.visible_price,
    promotion: str(p.promotion_text),
    category: str(p.category),
  });
}

function unplannedDraft(p: AstraUnplannedProduct): Draft {
  return aiOnly({
    brand: str(p.brand),
    product: str(p.product_name),
    variant: str(p.variant),
    facings: count(p.actual_facings),
    units: count(p.actual_visible_units),
  });
}

function extraDraft(p: ReferenceExtraProduct): Draft {
  return aiOnly({
    brand: p.brand,
    product: p.product_name,
    variant: p.variant,
    facings: p.shelf_facings,
    units: p.shelf_units,
    location: p.shelf_location_label,
    price: p.visible_price,
    promotion: p.shelf_promotion,
  });
}

/** Rows for the human verification table, covering planned, found and unplanned products. */
export function buildVerificationRows(
  analysis: NormalizedAstraAnalysis,
  inventory: InventoryRowLike[] = [],
): VerificationRow[] {
  let drafts: Draft[] = [];
  if (analysis.mode === "planogram") {
    const reference = analysis.reference_match;
    if (reference?.lines.length) {
      const byKey = new Map(analysis.products.map((p) => [`${norm(p.brand)}|${norm(p.product_name)}|${norm(p.variant)}`, p]));
      drafts = [
        ...reference.lines.map((l) =>
          fromReferenceLine(l, byKey.get(`${norm(l.brand)}|${norm(l.product_name)}|${norm(l.variant)}`)),
        ),
        ...reference.not_on_document.map(extraDraft),
      ];
    } else {
      drafts = [...analysis.products.map(fromPlanogram), ...analysis.observed_unplanned_products.map(unplannedDraft)];
    }
  } else if (analysis.mode === "shelf_only") {
    drafts = analysis.products.map(shelfDraft);
  }

  const unusedInventory = new Map(inventory.map((row) => [row.id, row]));
  const takeInventory = (key: Draft["aiKey"]): InventoryRowLike | null => {
    if (!key) return null;
    const exact = `${norm(key.brand)}|${norm(key.product)}|${norm(key.variant)}`;
    const loose = `${norm(key.brand)}|${norm(key.product)}`;
    let hit: InventoryRowLike | null = null;
    for (const row of unusedInventory.values()) {
      if (`${norm(row.brand)}|${norm(row.product)}|${norm(row.variant)}` === exact) {
        hit = row;
        break;
      }
    }
    if (!hit) {
      const loose_hits = [...unusedInventory.values()].filter((row) => `${norm(row.brand)}|${norm(row.product)}` === loose);
      if (loose_hits.length === 1) hit = loose_hits[0]!;
    }
    if (hit) unusedInventory.delete(hit.id);
    return hit;
  };

  if (!drafts.length) {
    drafts = inventory.map((row) =>
      aiOnly({
        brand: str(row.brand),
        product: str(row.product),
        variant: str(row.variant),
        facings: count(row.facings ?? row.quantity),
        units: null,
      }),
    );
  }

  const seen = new Map<string, number>();
  return drafts.map((draft) => {
    const linked = takeInventory(draft.aiKey);
    if (linked && draft.ai.facings == null) draft.ai.facings = count(linked.facings ?? linked.quantity);
    const { brand, product, variant } = draft.identity;
    let rowKey = linked ? `dp:${linked.id}` : `k:${norm(brand)}|${norm(product)}|${norm(variant)}`;
    const n = seen.get(rowKey) ?? 0;
    seen.set(rowKey, n + 1);
    if (n) rowKey = `${rowKey}#${n}`;
    const { aiKey: _aiKey, ...rest } = draft;
    return { ...rest, rowKey, detectedProductId: linked?.id ?? null, label: rowLabel(brand, product, variant) };
  });
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type FieldResult = "match" | "mismatch" | "below" | "above" | "not_visible" | "na";

const PIPELINE_RESULT: Record<string, FieldResult> = {
  CORRECT: "match",
  MATCH: "match",
  PROMO_SEEN: "match",
  WRONG_LOCATION: "mismatch",
  MISMATCH: "mismatch",
  PROMO_NOT_SEEN: "mismatch",
  NOT_READABLE: "not_visible",
  EXPECTED_NOT_IN_PHOTO: "not_visible",
  NOT_ON_SHELF: "not_visible",
  NO_EXPECTED: "na",
};

function textKey(value: FieldValue): string {
  return norm(value);
}

function words(value: FieldValue): Set<string> {
  return new Set(String(value ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

/** Names match regardless of word order, or when one name is the other plus extra words (e.g. the brand). */
function sameName(a: FieldValue, b: FieldValue): boolean {
  const ka = textKey(a);
  const kb = textKey(b);
  if (!ka || !kb) return false;
  if (ka === kb || ka.includes(kb) || kb.includes(ka)) return true;
  const wa = words(a);
  const wb = words(b);
  const [small, large] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  return small.size > 0 && [...small].every((w) => large.has(w));
}

/** Plan vs a value (the human value when verified, else the AI value). */
export function compareToPlan(key: VerificationFieldKey, expected: FieldValue, value: FieldValue): FieldResult {
  if (expected == null || expected === "") return "na";
  if (value == null || value === "") return "not_visible";
  if (key === "present") return Number(value) === 1 ? "match" : "mismatch";
  if (key === "facings" || key === "visible_units") {
    const diff = Number(value) - Number(expected);
    return diff === 0 ? "match" : diff < 0 ? "below" : "above";
  }
  if (key === "price") return Math.round(Number(value) * 100) === Math.round(Number(expected) * 100) ? "match" : "mismatch";
  if (key === "promotion") return "match";
  const a = textKey(expected);
  const b = textKey(value);
  if (!a || !b) return "not_visible";
  if (key === "location") return a === b ? "match" : "mismatch";
  return sameName(expected, value) ? "match" : "mismatch";
}

/** Result for one field: the human value wins; otherwise the pipeline's own status when it assessed the field. */
export function fieldResult(row: VerificationRow, key: VerificationFieldKey, verified: FieldValue): FieldResult {
  if (verified != null) return compareToPlan(key, row.expected[key], verified);
  const status = row.pipelineStatus[key]?.toUpperCase();
  if (status && PIPELINE_RESULT[status]) return PIPELINE_RESULT[status]!;
  return compareToPlan(key, row.expected[key], row.ai[key]);
}

/** Did the AI read the same thing the human verified? null when the field is not verified. */
export function aiAgrees(key: VerificationFieldKey, ai: FieldValue, verified: FieldValue): boolean | null {
  if (verified == null) return null;
  if (ai == null || ai === "") return false;
  if (TEXT_VERIFICATION_FIELDS.has(key)) {
    const a = textKey(ai);
    const b = textKey(verified);
    return key === "location" ? a === b : sameName(ai, verified);
  }
  if (key === "price") return Math.round(Number(ai) * 100) === Math.round(Number(verified) * 100);
  return Number(ai) === Number(verified);
}

export const RESULT_LABEL: Record<FieldResult, string> = {
  match: "Match",
  mismatch: "Different",
  below: "Below plan",
  above: "Above plan",
  not_visible: "Not visible in photo",
  na: "N/A",
};

export function formatFieldValue(key: VerificationFieldKey, value: FieldValue): string {
  if (value == null || value === "") return "";
  if (key === "present") return Number(value) === 1 ? "Yes" : "No";
  if (key === "price") return `₹${Number(value)}`;
  return String(value);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export function verificationCsv(
  rows: VerificationRow[],
  verifications: Map<string, FieldVerification>,
  userNames: Map<string, string> = new Map(),
): { headers: string[]; data: string[][] } {
  const headers = ["Product", "Planned"];
  for (const field of VERIFY_FIELDS) {
    headers.push(
      `${field.label} expected`,
      `${field.label} AI detected`,
      `${field.label} human verified`,
      `${field.label} result`,
    );
  }
  headers.push("Verified by", "Verified at");

  const data = rows.map((row) => {
    const line = [row.label, row.planned ? "Yes" : "No"];
    let lastAt: string | null = null;
    let lastBy: string | null = null;
    for (const field of VERIFY_FIELDS) {
      const v = verifications.get(`${row.rowKey}:${field.key}`);
      const verified = verifiedFieldValue(v);
      if (verified != null && v?.verified_at && (!lastAt || v.verified_at > lastAt)) {
        lastAt = v.verified_at;
        lastBy = v.verified_by;
      }
      const result = fieldResult(row, field.key, verified);
      line.push(
        formatFieldValue(field.key, row.expected[field.key]) || "N/A",
        formatFieldValue(field.key, row.ai[field.key]) || "Not detected",
        formatFieldValue(field.key, verified),
        RESULT_LABEL[result],
      );
    }
    line.push(lastBy ? (userNames.get(lastBy) ?? lastBy) : "", lastAt ?? "");
    return line;
  });
  return { headers, data };
}
