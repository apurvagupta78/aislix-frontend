import { capUnitsToFacings } from "@/lib/ai-audit/astra-response";
import { hideModelNames } from "@/lib/ai-display-text";

type Json = Record<string, unknown>;

function rec(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function text(value: unknown, max = 400): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t || /^(null|n\/a|none|unknown|-)$/i.test(t)) return null;
  return t.slice(0, max);
}

function prose(value: unknown, max = 400): string | null {
  const t = text(value, max);
  return t ? hideModelNames(t) : null;
}

function count(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function confidence(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  return n > 1 ? Math.min(1, n / 100) : n;
}

function quality(value: unknown): string | null {
  const q = text(value, 20)?.toLowerCase();
  if (!q) return null;
  if (q === "good") return "good";
  if (q === "fair" || q === "limited") return "fair";
  if (q === "poor") return "poor";
  return null;
}

function upperKey(value: unknown): string {
  return (text(value, 40) ?? "").toUpperCase().replace(/[\s-]+/g, "_");
}

/* ------------------------------------------------------------------ */
/* Shelf to CSV                                                        */
/* ------------------------------------------------------------------ */

export type ShelfCsvProduct = {
  brand: string | null;
  product: string;
  variant: string | null;
  category: string | null;
  facings: number | null;
  units: number | null;
  price: string | null;
  promotion: string | null;
  location: string | null;
  confidence: number | null;
};

export type ShelfCsvResult = {
  products: ShelfCsvProduct[];
  productsCount: number;
  brandsCount: number;
  facingsTotal: number;
  unitsTotal: number;
  imageQuality: string | null;
};

const UNREAD_BRAND_RE = /^(unidentified|unknown|unbranded|unreadable|not visible|not readable|generic)\b/i;

export function parseShelfCsvPayload(payload: unknown): ShelfCsvResult {
  const root = rec(payload) ?? {};
  const raw = Array.isArray(root.products) ? root.products : [];
  const products: ShelfCsvProduct[] = [];
  for (const item of raw) {
    const r = rec(item);
    if (!r) continue;
    const product = text(r.product ?? r.product_name ?? r.name, 200);
    if (!product) continue;
    const facings = count(r.actual_facings ?? r.facings);
    products.push({
      brand: text(r.brand, 120),
      product,
      variant: text(r.variant, 160),
      category: text(r.category, 120),
      facings,
      units: capUnitsToFacings(count(r.actual_visible_units ?? r.visible_units), facings),
      price: text(r.visible_price, 40),
      promotion: text(r.promotion_text, 160),
      location: text(r.location_label, 60),
      confidence: confidence(r.confidence),
    });
  }
  const brands = new Set(
    products
      .map((p) => p.brand?.toLowerCase())
      .filter((b): b is string => Boolean(b) && !UNREAD_BRAND_RE.test(b!)),
  );
  return {
    products,
    productsCount: products.length,
    brandsCount: brands.size,
    facingsTotal: products.reduce((sum, p) => sum + (p.facings ?? 0), 0),
    unitsTotal: products.reduce((sum, p) => sum + (p.units ?? 0), 0),
    imageQuality: quality(rec(root.image_quality)?.status ?? root.image_quality),
  };
}

function csvCell(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function shelfCsvText(products: ShelfCsvProduct[]): string {
  const header = ["Brand", "Product", "Variant", "Category", "Facings", "Visible units", "Price", "Promotion", "Location label"];
  const lines = products.map((p) =>
    [p.brand, p.product, p.variant, p.category, p.facings, p.units, p.price, p.promotion, p.location].map(csvCell).join(","),
  );
  return [header.join(","), ...lines].join("\r\n");
}

/* ------------------------------------------------------------------ */
/* FNV check                                                           */
/* ------------------------------------------------------------------ */

export type FnvVerdict = "sellable" | "not_sellable" | "check_manually";

export const FNV_VERDICT_LABEL: Record<FnvVerdict, string> = {
  sellable: "Sellable",
  not_sellable: "Not sellable",
  check_manually: "Check manually",
};

const FNV_DEFECT_LABEL: Record<string, string> = {
  rot: "Rot",
  mould: "Mould",
  mold: "Mould",
  bruising: "Bruising",
  cuts: "Cuts or cracks",
  wilting: "Wilting",
  overripe: "Overripe",
  pest_damage: "Pest damage",
  sprouting: "Sprouting",
  discolouration: "Discolouration",
  discoloration: "Discolouration",
  other: "Other",
};

export function fnvDefectLabel(defect: string): string {
  return FNV_DEFECT_LABEL[defect] ?? defect.replace(/_/g, " ");
}

export type FnvCheckResult = {
  product: string | null;
  verdict: FnvVerdict;
  confidence: number | null;
  unitsVisible: number | null;
  unitsNotSellable: number | null;
  defects: string[];
  reason: string | null;
  action: string | null;
  imageQuality: string | null;
};

export function parseFnvCheckPayload(payload: unknown): FnvCheckResult {
  const root = rec(payload) ?? {};
  const key = upperKey(root.verdict ?? root.disposition);
  const verdict: FnvVerdict =
    key === "SELLABLE" ? "sellable" : key === "NOT_SELLABLE" || key === "DAMAGED" ? "not_sellable" : "check_manually";
  const defects = Array.from(
    new Set(
      (Array.isArray(root.defects) ? root.defects : [])
        .map((d) => text(d, 40)?.toLowerCase().replace(/[\s-]+/g, "_"))
        .filter((d): d is string => Boolean(d)),
    ),
  ).slice(0, 10);
  return {
    product: text(root.product, 120),
    verdict,
    confidence: confidence(root.confidence),
    unitsVisible: count(root.units_visible),
    unitsNotSellable: count(root.units_not_sellable),
    defects,
    reason: prose(root.reason),
    action: prose(root.action),
    imageQuality: quality(root.image_quality),
  };
}

/* ------------------------------------------------------------------ */
/* Hygiene check                                                       */
/* ------------------------------------------------------------------ */

export type HygieneVerdict = "passed" | "failed" | "check_manually";

export const HYGIENE_VERDICT_LABEL: Record<HygieneVerdict, string> = {
  passed: "Passed",
  failed: "Failed",
  check_manually: "Check manually",
};

export type HygieneSeverity = "high" | "medium" | "low";

const HYGIENE_TYPE_LABEL: Record<string, string> = {
  dust: "Dust or dirt",
  spill: "Spill or stain",
  litter: "Litter or packaging waste",
  damaged_pack: "Damaged or leaking pack",
  pest: "Pest signs",
  rust_mould: "Rust, mould or broken shelf",
  floor_stock: "Stock on the floor",
  untidy: "Untidy shelf",
  other: "Other",
};

export function hygieneTypeLabel(type: string): string {
  return HYGIENE_TYPE_LABEL[type] ?? type.replace(/_/g, " ");
}

export type HygieneIssue = {
  type: string;
  where: string | null;
  severity: HygieneSeverity;
  whatToDo: string | null;
};

export type HygieneCheckResult = {
  verdict: HygieneVerdict;
  confidence: number | null;
  issues: HygieneIssue[];
  summary: string | null;
  imageQuality: string | null;
};

export function parseHygieneCheckPayload(payload: unknown): HygieneCheckResult {
  const root = rec(payload) ?? {};
  const issues: HygieneIssue[] = [];
  for (const item of Array.isArray(root.issues) ? root.issues : []) {
    const r = rec(item);
    if (!r) continue;
    const sev = text(r.severity, 10)?.toLowerCase();
    issues.push({
      type: text(r.type, 40)?.toLowerCase().replace(/[\s-]+/g, "_") ?? "other",
      where: prose(r.where, 120),
      severity: sev === "high" || sev === "low" ? sev : "medium",
      whatToDo: prose(r.what_to_do ?? r.action, 300),
    });
    if (issues.length >= 20) break;
  }
  const key = upperKey(root.verdict);
  let verdict: HygieneVerdict = key === "PASSED" || key === "PASS" ? "passed" : key === "FAILED" || key === "FAIL" ? "failed" : "check_manually";
  if (verdict === "passed" && issues.some((i) => i.severity !== "low")) verdict = "failed";
  return {
    verdict,
    confidence: confidence(root.confidence),
    issues,
    summary: prose(root.summary),
    imageQuality: quality(root.image_quality),
  };
}
