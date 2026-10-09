/**
 * "View by" for the AI dashboard: every product row the AI audits read is tagged with the store,
 * category, location, price, brand, product, promotion and facings group it belongs to, so every
 * dashboard metric can be cut by one of them (e.g. View by Location → all location issues in all stores).
 * Pure — built from persisted scan results and corrective actions.
 */

import type { VerificationFieldKey } from "@/lib/ai-audit/field-verifications";
import type { FieldResult, FieldValue, VerificationRow } from "@/lib/ai-audit/verification-rows";
import {
  actionStage,
  issueCategoryLabel,
  issueCategoryOf,
  isUnreviewedAction,
  type IssueCategory,
} from "@/lib/corrective-action-catalog";
import type { LifecycleAction } from "@/lib/corrective-action-lifecycle";

export type ScopeLensId = "store" | "city" | "country";
export type LensId = ScopeLensId | "category" | "location" | "price" | "brand" | "product" | "promotion" | "facings";
export type LensFacets = Record<LensId, string>;
export type LensSelection = { lens: LensId; value: string };

export const ALL_VALUES = "all";

export const LENSES: ReadonlyArray<{ id: LensId; label: string; plural: string; question: string }> = [
  { id: "store", label: "Store", plural: "stores", question: "Which stores have the most issues?" },
  { id: "city", label: "City", plural: "cities", question: "Which cities have the most issues?" },
  { id: "country", label: "Country", plural: "countries", question: "Which countries have the most issues?" },
  { id: "category", label: "Category", plural: "categories", question: "Which categories have the most issues?" },
  { id: "location", label: "Location", plural: "locations", question: "Where are products placed wrongly?" },
  { id: "price", label: "Price", plural: "price results", question: "Do shelf prices match the plan?" },
  { id: "brand", label: "Brand share", plural: "brands", question: "Which brands own the shelf?" },
  { id: "product", label: "Product share", plural: "products", question: "Which products own the shelf?" },
  { id: "promotion", label: "Promotion", plural: "promotions", question: "Which promotions are on the shelf?" },
  { id: "facings", label: "Facings", plural: "facing results", question: "Are products on their planned facings?" },
];

export function lensDef(id: LensId) {
  return LENSES.find((l) => l.id === id) ?? { id: "store", label: "Store", plural: "stores", question: "Which stores have the most issues?" };
}

export const SCOPE_LENSES = LENSES.filter((l) => l.id === "store" || l.id === "city" || l.id === "country");
export const TOPIC_LENSES = LENSES.filter((l) => l.id !== "store" && l.id !== "city" && l.id !== "country");

/** Issues that belong to a lens. null = every issue counts. */
export const LENS_TOPIC: Record<LensId, { fields: VerificationFieldKey[]; categories: IssueCategory[] } | null> = {
  store: null,
  city: null,
  country: null,
  category: null,
  product: null,
  location: { fields: ["location"], categories: ["location"] },
  price: { fields: ["price"], categories: [] },
  promotion: { fields: ["promotion"], categories: [] },
  brand: { fields: ["brand"], categories: ["branding"] },
  facings: {
    fields: ["present", "facings", "visible_units"],
    categories: ["facing", "less_quantity", "more_quantity", "refill_item", "remove_item"],
  },
};

/** Issue fields raised on the audit by a person are keyed `ca:<issue category>`. */
export const AUDITOR_FIELD_PREFIX = "ca:";

export function fieldInTopic(lens: LensId, field: string): boolean {
  const topic = LENS_TOPIC[lens];
  if (!topic) return true;
  if (field.startsWith(AUDITOR_FIELD_PREFIX)) {
    return (topic.categories as string[]).includes(field.slice(AUDITOR_FIELD_PREFIX.length));
  }
  return (topic.fields as string[]).includes(field);
}

export function matchesValue(facets: LensFacets | null, sel: LensSelection): boolean {
  if (sel.value === ALL_VALUES) return true;
  return Boolean(facets && facets[sel.lens] === sel.value);
}

// ---------------------------------------------------------------------------
// Facets for one product row
// ---------------------------------------------------------------------------

function text(value: FieldValue | undefined): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

export const NO_LOCATION = "Location not read";
export const NO_PROMOTION = "No promotion seen";
export const UNKNOWN_BRAND = "Unknown brand";

export function rowFacets(input: {
  row: VerificationRow;
  store: string;
  city: string;
  country: string;
  category: string;
  value: (key: VerificationFieldKey) => FieldValue;
  result: (key: VerificationFieldKey) => FieldResult;
}): LensFacets {
  const { row, value, result } = input;
  let price: string;
  if (row.expected.price != null) {
    const r = result("price");
    price = r === "match" ? "Price matches plan" : r === "mismatch" ? "Price differs from plan" : "Price not readable";
  } else {
    price = value("price") != null ? "Price read on shelf" : "No price read";
  }
  let facings: string;
  if (!row.planned) facings = "Not on the plan";
  else if (result("present") === "mismatch") facings = "Missing from shelf";
  else {
    const r = result("facings");
    facings =
      r === "match" ? "On plan" : r === "below" ? "Below plan" : r === "above" ? "Above plan" : "No facings target";
  }
  return {
    store: input.store,
    city: input.city.trim() || "No city",
    country: input.country.trim() || "No country",
    category: input.category,
    location: text(value("location")) ?? text(row.expected.location) ?? NO_LOCATION,
    price,
    brand: text(value("brand")) ?? text(row.identity.brand) ?? UNKNOWN_BRAND,
    product: row.label,
    promotion: text(value("promotion")) ?? NO_PROMOTION,
    facings,
  };
}

const brandKey = (label: string) => label.toLowerCase().replace(/[^a-z0-9]/g, "");

/** One label per brand ("lays" and "Lay's" are the same brand): the most common spelling wins. */
export function canonicalBrands(facets: LensFacets[]): void {
  const counts = new Map<string, Map<string, number>>();
  for (const f of facets) {
    const key = brandKey(f.brand);
    const labels = counts.get(key) ?? new Map<string, number>();
    labels.set(f.brand, (labels.get(f.brand) ?? 0) + 1);
    counts.set(key, labels);
  }
  const best = new Map<string, string>();
  for (const [key, labels] of counts) {
    const sorted = [...labels.entries()].sort(
      (a, b) => b[1] - a[1] || Number(/[A-Z]/.test(b[0])) - Number(/[A-Z]/.test(a[0])) || a[0].localeCompare(b[0]),
    );
    best.set(key, sorted[0]![0]);
  }
  for (const f of facets) f.brand = best.get(brandKey(f.brand)) ?? f.brand;
}

// ---------------------------------------------------------------------------
// Shelf facts and actions
// ---------------------------------------------------------------------------

export type ShelfFact = {
  scanId: string;
  storeId: string | null;
  date: string;
  product: string;
  sku: string;
  planned: boolean;
  facings: number | null;
  units: number | null;
  facets: LensFacets;
};

export type LensScan = {
  scanId: string;
  storeId: string | null;
  date: string;
  store: string;
  city: string;
  country: string;
  team: string;
  category: string;
};

export type LinkedAction = { action: LifecycleAction; facets: LensFacets | null; fact: ShelfFact | null };

const UNLINKED = "";

function productFromTitle(title: string): string {
  const parts = title.split(" · ");
  return (parts.length > 1 ? parts.slice(1).join(" · ") : title).trim() || "Product";
}

/** Ties every action to the product row it is about, so it follows the same View by choice. */
export function linkActions(actions: LifecycleAction[], facts: ShelfFact[], scans: LensScan[]): LinkedAction[] {
  const factsByScan = new Map<string, ShelfFact[]>();
  for (const f of facts) {
    const list = factsByScan.get(f.scanId) ?? [];
    list.push(f);
    factsByScan.set(f.scanId, list);
  }
  const scanById = new Map(scans.map((s) => [s.scanId, s]));
  return actions
    .filter((a) => !isUnreviewedAction(a.status))
    .map((action) => {
      const pool = action.scan_id ? (factsByScan.get(action.scan_id) ?? []) : [];
      const sku = action.sku?.trim().toLowerCase();
      const title = (action.title ?? "").toLowerCase();
      const fact =
        (sku ? pool.find((f) => f.sku.toLowerCase() === sku) : undefined) ??
        pool
          .filter((f) => f.product && title.includes(f.product.toLowerCase()))
          .sort((a, b) => b.product.length - a.product.length)[0] ??
        null;
      if (fact) return { action, facets: fact.facets, fact };
      const scan = (action.scan_id ? scanById.get(action.scan_id) : undefined) ?? scans.find((s) => s.storeId != null && s.storeId === action.store_id);
      const facets: LensFacets = {
        store: scan?.store ?? action.store_name ?? "No store",
        city: scan?.city ?? "No city",
        country: scan?.country ?? "No country",
        category: scan?.category ?? UNLINKED,
        location: UNLINKED,
        price: UNLINKED,
        brand: UNLINKED,
        product: UNLINKED,
        promotion: UNLINKED,
        facings: UNLINKED,
      };
      return { action, facets, fact: null };
    });
}

export function filterLinkedActions(linked: LinkedAction[], sel: LensSelection, scope?: LensSelection): LifecycleAction[] {
  return linked
    .filter(({ action, facets }) => {
      const topic = LENS_TOPIC[sel.lens];
      if (topic && !(topic.categories as string[]).includes(issueCategoryOf(action))) return false;
      return matchesValue(facets, sel) && (!scope || matchesValue(facets, scope));
    })
    .map((l) => l.action);
}

/** Issues a person recorded on the audit (Corrective action form) — they are variances too. */
export type AuditorIssue = {
  scanId: string;
  date: string;
  store: string;
  city: string;
  team: string;
  category: string;
  sku: string;
  product: string;
  field: string;
  fieldLabel: string;
  detail: string;
  facets: LensFacets;
};

export function auditorIssues(linked: LinkedAction[], scans: LensScan[]): AuditorIssue[] {
  const scanById = new Map(scans.map((s) => [s.scanId, s]));
  const out: AuditorIssue[] = [];
  for (const { action, facets, fact } of linked) {
    if (!action.raised_manually || !action.scan_id) continue;
    const scan = scanById.get(action.scan_id);
    if (!scan || !facets) continue;
    const category = issueCategoryOf(action);
    out.push({
      scanId: scan.scanId,
      date: scan.date,
      store: scan.store,
      city: scan.city,
      team: scan.team,
      category: facets.category || scan.category,
      sku: action.sku?.trim() || fact?.sku || "",
      product: fact?.product ?? productFromTitle(action.title ?? ""),
      field: `${AUDITOR_FIELD_PREFIX}${category}`,
      fieldLabel: issueCategoryLabel(category),
      detail: action.issue_detail?.trim() || action.suggestion?.trim() || "",
      facets,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Roll-ups
// ---------------------------------------------------------------------------

export type LensGroup = {
  value: string;
  audits: number;
  products: number;
  facings: number;
  sharePct: number | null;
  units: number | null;
  issues: number;
  openFixes: number;
};

type IssueLike = { facets: LensFacets; field: string };

/** One row per value of the lens (every store, every location…), most issues first. */
export function lensGroups(
  lens: LensId,
  facts: ShelfFact[],
  issues: IssueLike[],
  linked: LinkedAction[],
): LensGroup[] {
  type Acc = { scans: Set<string>; products: Set<string>; facings: number; units: number; hasUnits: boolean; issues: number; openFixes: number };
  const groups = new Map<string, Acc>();
  const acc = (value: string): Acc => {
    let g = groups.get(value);
    if (!g) {
      g = { scans: new Set(), products: new Set(), facings: 0, units: 0, hasUnits: false, issues: 0, openFixes: 0 };
      groups.set(value, g);
    }
    return g;
  };
  let totalFacings = 0;
  for (const f of facts) {
    const g = acc(f.facets[lens]);
    g.scans.add(f.scanId);
    g.products.add(f.facets.product.toLowerCase());
    g.facings += f.facings ?? 0;
    totalFacings += f.facings ?? 0;
    if (f.units != null) {
      g.units += f.units;
      g.hasUnits = true;
    }
  }
  for (const i of issues) {
    if (!fieldInTopic(lens, i.field) || !i.facets[lens]) continue;
    acc(i.facets[lens]).issues += 1;
  }
  const topic = LENS_TOPIC[lens];
  for (const { action, facets } of linked) {
    const value = facets?.[lens];
    if (!value) continue;
    const stage = actionStage(action.status);
    if (stage !== "open" && stage !== "in_progress") continue;
    if (topic && !(topic.categories as string[]).includes(issueCategoryOf(action))) continue;
    acc(value).openFixes += 1;
  }
  return [...groups.entries()]
    .map(([value, g]) => ({
      value,
      audits: g.scans.size,
      products: g.products.size,
      facings: g.facings,
      sharePct: totalFacings > 0 ? Math.round((g.facings / totalFacings) * 1000) / 10 : null,
      units: g.hasUnits ? g.units : null,
      issues: g.issues,
      openFixes: g.openFixes,
    }))
    .sort((a, b) => b.issues - a.issues || b.openFixes - a.openFixes || b.facings - a.facings || a.value.localeCompare(b.value));
}

export type ShelfMetrics = {
  audits: number;
  products: number;
  brands: number;
  facings: number;
  units: number | null;
  brandShare: { label: string; value: number }[];
  categoryShare: { label: string; value: number }[];
  topProductsByFacings: { label: string; value: number }[];
  topProductsByUnits: { label: string; value: number }[];
};

function share(map: Map<string, number>): { label: string; value: number }[] {
  const total = [...map.values()].reduce((s, n) => s + n, 0);
  if (total <= 0) return [];
  return [...map.entries()]
    .map(([label, value]) => ({ label, value: (value / total) * 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function top(map: Map<string, number>): { label: string; value: number }[] {
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

/** Product, brand, facings and units metrics for the selected rows. */
export function shelfMetrics(facts: ShelfFact[]): ShelfMetrics {
  const brands = new Map<string, number>();
  const categories = new Map<string, number>();
  const productFacings = new Map<string, number>();
  const productUnits = new Map<string, number>();
  let facings = 0;
  let units = 0;
  let hasUnits = false;
  for (const f of facts) {
    const n = f.facings ?? 0;
    facings += n;
    brands.set(f.facets.brand, (brands.get(f.facets.brand) ?? 0) + n);
    if (f.facets.category) categories.set(f.facets.category, (categories.get(f.facets.category) ?? 0) + n);
    productFacings.set(f.product, (productFacings.get(f.product) ?? 0) + n);
    if (f.units != null) {
      units += f.units;
      hasUnits = true;
      productUnits.set(f.product, (productUnits.get(f.product) ?? 0) + f.units);
    }
  }
  return {
    audits: new Set(facts.map((f) => f.scanId)).size,
    products: new Set(facts.map((f) => f.product.toLowerCase())).size,
    brands: [...brands.keys()].filter((b) => b !== UNKNOWN_BRAND).length,
    facings,
    units: hasUnits ? units : null,
    brandShare: share(brands),
    categoryShare: share(categories),
    topProductsByFacings: top(productFacings),
    topProductsByUnits: top(productUnits),
  };
}
