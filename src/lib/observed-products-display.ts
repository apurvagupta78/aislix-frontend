/**
 * Observed shelf products — display helpers (no detection/calculation changes).
 */

import {
  comparePlanogramToInventory,
  type InventoryFacing,
  type PlanogramMatchLine,
  type PlanogramMatchResult,
} from "@/lib/demo-planogram-match";
import {
  compareDemoOralCarePlanogram,
  isDemoOralCareResult,
} from "@/lib/demo-oral-care-planogram";
import { DEMO_ORAL_CARE_META } from "@/lib/demo-oral-care-planogram";
import { planogramRowsFromResult } from "@/lib/execution-metrics";
import type { InventoryItem, ScanResult } from "@/lib/scan-results";
import { normalizeConfidence } from "@/lib/scan-results";

export type ObservedProductStatus =
  | "Observed"
  | "Matched"
  | "Needs Review"
  | "Unknown"
  | "Not Assessed";

export type ObservedProductsSummary = {
  product_count: number;
  brand_count: number;
  visible_facings: number;
};

export type ConfidenceDistribution = {
  high: number;
  needs_review: number;
  unknown: number;
};

export type BrandPresenceRow = {
  brand: string;
  facings: number;
  sku_count: number;
  is_primary: boolean;
  is_unknown: boolean;
  bar_class: string;
};

export type ObservedProductRow = InventoryItem & {
  status: ObservedProductStatus;
  shelf_label: string;
  location_label: string;
  match_line?: PlanogramMatchLine;
};

const COMPETITOR_BAR = [
  "bg-brand/75",
  "bg-brand/60",
  "bg-brand/45",
  "bg-brand/35",
  "bg-brand/25",
] as const;

function normKey(brand: string, product: string): string {
  return `${brand.trim().toLowerCase()}|${product.trim().toLowerCase()}`;
}

function brandsMatch(a: string, b: string): boolean {
  const na = a.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const nb = b.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function resolveMatch(result: ScanResult): PlanogramMatchResult | null {
  const rows = planogramRowsFromResult(result);
  if (!rows.length) return null;
  const demoMode =
    isDemoOralCareResult(result) || result.retail_intelligence?.demo_oral_care === true;
  if (demoMode) return compareDemoOralCarePlanogram(rows);
  const inventory = result.inventory ?? [];
  if (!inventory.length) return null;
  return comparePlanogramToInventory(inventory as InventoryFacing[], rows);
}

function buildMatchIndex(match: PlanogramMatchResult | null) {
  const byExpected = new Map<string, PlanogramMatchLine>();
  const byMatched = new Map<string, PlanogramMatchLine>();
  for (const line of match?.lines ?? []) {
    byExpected.set(normKey(line.expected.brand, line.expected.product_name), line);
    if (line.matched_brand && line.matched_product) {
      byMatched.set(normKey(line.matched_brand, line.matched_product), line);
    }
  }
  return { byExpected, byMatched };
}

function findMatchLine(
  item: InventoryItem,
  index: ReturnType<typeof buildMatchIndex>,
): PlanogramMatchLine | undefined {
  const key = normKey(item.brand, item.product);
  return index.byExpected.get(key) ?? index.byMatched.get(key);
}

export function formatObservedShelfLabel(position?: string | null): string {
  if (!position?.trim()) return "—";
  const match = position.trim().match(/^S(\d+)/i);
  if (match) return `Shelf ${match[1]}`;
  return position.trim();
}

export function formatObservedLocation(position?: string | null): string {
  if (!position?.trim()) return "—";
  return position.trim();
}

export function resolveObservedStatus(
  item: InventoryItem,
  matchLine: PlanogramMatchLine | undefined,
  planogramRequested: boolean,
): ObservedProductStatus {
  const conf = normalizeConfidence(item.confidence);
  const brandUnknown = item.brand.trim().toLowerCase() === "unknown";
  const productUnknown = item.product.trim().toLowerCase().includes("unknown");

  if (brandUnknown || productUnknown || conf < 50) return "Unknown";
  if (item.compliance_status === "category_mismatch") return "Needs Review";

  if (matchLine) {
    if (matchLine.issue_type === "correct" && matchLine.present && matchLine.qty_ok) {
      return "Matched";
    }
    if (matchLine.present) return "Needs Review";
  }

  if (conf < 75) return "Needs Review";
  if (planogramRequested && !matchLine) return "Not Assessed";
  return "Observed";
}

export function buildObservedProductsSummary(items: InventoryItem[]): ObservedProductsSummary {
  const brands = new Set(items.map((r) => r.brand.trim() || "Unknown"));
  return {
    product_count: items.length,
    brand_count: brands.size,
    visible_facings: items.reduce((n, r) => n + (r.quantity ?? 0), 0),
  };
}

export function buildConfidenceDistribution(items: InventoryItem[]): ConfidenceDistribution {
  const dist: ConfidenceDistribution = { high: 0, needs_review: 0, unknown: 0 };
  for (const item of items) {
    const conf = normalizeConfidence(item.confidence);
    const brandUnknown = item.brand.trim().toLowerCase() === "unknown";
    const productUnknown = item.product.trim().toLowerCase().includes("unknown");
    if (brandUnknown || productUnknown || conf < 50) {
      dist.unknown++;
    } else if (conf < 90 || item.compliance_status === "category_mismatch") {
      dist.needs_review++;
    } else {
      dist.high++;
    }
  }
  return dist;
}

export function resolvePrimaryBrand(result: ScanResult): string {
  if (result.competitor_intel?.primary_brand) return result.competitor_intel.primary_brand;
  const rows = planogramRowsFromResult(result);
  return rows[0]?.brand ?? "";
}

export function buildBrandPresenceRows(
  items: InventoryItem[],
  primaryBrand: string,
): BrandPresenceRow[] {
  const map = new Map<string, { facings: number; skus: Set<string> }>();
  for (const item of items) {
    const brand = item.brand.trim() || "Unknown";
    const cur = map.get(brand) ?? { facings: 0, skus: new Set<string>() };
    cur.facings += item.quantity ?? 0;
    cur.skus.add(`${item.product}|${item.variant ?? ""}`);
    map.set(brand, cur);
  }

  let competitorIdx = 0;
  return [...map.entries()]
    .map(([brand, data]) => {
      const is_unknown = brand.toLowerCase() === "unknown";
      const is_primary = !is_unknown && primaryBrand.trim() !== "" && brandsMatch(brand, primaryBrand);
      let bar_class = "bg-brand/40";
      if (is_unknown) bar_class = "bg-muted-foreground/35";
      else if (is_primary) bar_class = "bg-brand";
      else {
        bar_class = COMPETITOR_BAR[competitorIdx % COMPETITOR_BAR.length]!;
        competitorIdx++;
      }
      return {
        brand,
        facings: data.facings,
        sku_count: data.skus.size,
        is_primary,
        is_unknown,
        bar_class,
      };
    })
    .sort((a, b) => b.facings - a.facings);
}

export function enrichObservedProductRows(
  result: ScanResult,
  items: InventoryItem[],
): ObservedProductRow[] {
  const match = resolveMatch(result);
  const index = buildMatchIndex(match);
  const planogramRequested = Boolean(result.planogram?.requested || match);
  return items.map((item) => {
    const matchLine = findMatchLine(item, index);
    return {
      ...item,
      status: resolveObservedStatus(item, matchLine, planogramRequested),
      shelf_label: formatObservedShelfLabel(item.shelf_position),
      location_label: formatObservedLocation(item.shelf_position),
      match_line: matchLine,
    };
  });
}

export function observedProductsMeta(result: ScanResult) {
  const rows = planogramRowsFromResult(result);
  return {
    audit_id: result.location ?? result.scan_id ?? "",
    audit_date: result.created_at ?? "",
    store: result.store ?? "Demo Supermarket",
    fixture: rows[0]?.location ?? DEMO_ORAL_CARE_META.fixture_id ?? "",
    role: result.retail_intelligence?.audit_kpi_dashboard?.role_id ?? "",
    category: result.scan_category ?? DEMO_ORAL_CARE_META.category,
    sub_category: result.scan_sub_category ?? DEMO_ORAL_CARE_META.sub_category,
    planogram_version: DEMO_ORAL_CARE_META.version,
    image_id: result.scan_id ?? "",
  };
}
