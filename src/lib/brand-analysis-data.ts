/**
 * Brand & competition section — display/export helpers (no KPI recalculation).
 */

import type { CompetitorShareRow, CompetitorSnapshot } from "@/lib/brand-intel";
import { isUnclassifiedBrand } from "@/lib/brand-intel";

function brandsMatch(a: string, b: string): boolean {
  const na = a.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const nb = b.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}
import { DEMO_ORAL_CARE_META } from "@/lib/demo-oral-care-planogram";
import { scoringFromResult } from "@/lib/kpi-results-display";
import type { ScanResult } from "@/lib/scan-results";

export type BrandShelfSegment = {
  brand: string;
  share: number;
  linear_units: number;
  is_primary: boolean;
  is_other_bucket?: boolean;
  bar_class: string;
};

export type ProductMixRow = {
  brand: string;
  product: string;
  sku?: string;
  variant?: string;
  facings: number;
  shelf?: string;
  location?: string;
  confidence?: string;
  is_primary_brand: boolean;
  is_unknown: boolean;
  bar_class: string;
};

export type BrandAnalysisMeta = {
  audit_id: string;
  audit_date: string;
  store: string;
  fixture: string;
  category: string;
  sub_category: string;
  planogram_version: string;
  target_brand: string;
  planned_share: number | null;
  actual_share: number;
  variance_pts: number | null;
  total_linear: number;
  measurement_basis: "Linear shelf space";
};

const COMPETITOR_BAR = [
  "bg-brand/75",
  "bg-brand/60",
  "bg-brand/45",
  "bg-brand/35",
  "bg-brand/25",
] as const;

const PRODUCT_BAR = [
  "bg-brand",
  "bg-brand/70",
  "bg-brand/55",
  "bg-brand/45",
  "bg-brand/35",
  "bg-brand/28",
  "bg-brand/22",
] as const;

function totalCategoryLinear(result: ScanResult): number {
  const meta = result.planogram?.summary as { fixture_width?: number } | undefined;
  const width = meta?.fixture_width ?? DEMO_ORAL_CARE_META.fixture_width;
  if (width != null && Number.isFinite(Number(width))) return Number(width);
  return 100;
}

export function buildBrandAnalysisMeta(
  result: ScanResult,
  snapshot: CompetitorSnapshot | null | undefined,
): BrandAnalysisMeta {
  const primary = snapshot?.primary_brand ?? "";
  const actual = snapshot?.own_brand_share_percent ?? 0;
  const planned = scoringFromResult(result).share_of_shelf_target ?? null;
  const variance =
    planned != null && Number.isFinite(planned) ? Math.round(actual - planned) : null;
  return {
    audit_id: result.location ?? result.scan_id ?? "",
    audit_date: result.created_at ?? "",
    store: result.store ?? "Demo Supermarket",
    fixture: result.inventory?.[0]?.location ?? DEMO_ORAL_CARE_META.fixture_id ?? "G01",
    category: result.scan_category ?? DEMO_ORAL_CARE_META.category ?? "—",
    sub_category: result.scan_sub_category ?? DEMO_ORAL_CARE_META.sub_category ?? "—",
    planogram_version: DEMO_ORAL_CARE_META.version ?? "—",
    target_brand: primary,
    planned_share: planned,
    actual_share: actual,
    variance_pts: variance,
    total_linear: totalCategoryLinear(result),
    measurement_basis: "Linear shelf space",
  };
}

export function buildShareOfShelfSegments(
  snapshot: CompetitorSnapshot | null | undefined,
  totalLinear: number,
  maxVisible = 6,
): BrandShelfSegment[] {
  const rows: CompetitorShareRow[] = snapshot?.competitor_shares ?? [];
  if (!rows.length) return [];

  const sorted = [...rows].sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
  const primaryBrand = snapshot?.primary_brand ?? sorted.find((r) => r.is_primary)?.brand ?? "";
  const head = sorted.slice(0, maxVisible);
  const tail = sorted.slice(maxVisible);
  const othersShare = tail.reduce((s, r) => s + (r.share ?? 0), 0);

  const segments: BrandShelfSegment[] = head.map((row, i) => ({
    brand: row.brand,
    share: row.share ?? 0,
    linear_units: Math.round(((row.share ?? 0) / 100) * totalLinear * 10) / 10,
    is_primary: Boolean(row.is_primary) || row.brand === primaryBrand,
    bar_class: row.is_primary || row.brand === primaryBrand ? "bg-brand" : (COMPETITOR_BAR[i % COMPETITOR_BAR.length] ?? "bg-muted"),
  }));

  if (othersShare > 0.05) {
    segments.push({
      brand: "Others",
      share: Math.round(othersShare * 10) / 10,
      linear_units: Math.round((othersShare / 100) * totalLinear * 10) / 10,
      is_primary: false,
      is_other_bucket: true,
      bar_class: "bg-brand/15",
    });
  }

  return segments;
}

export function buildProductMixRows(
  inventory: NonNullable<ScanResult["inventory"]>,
  primaryBrand: string,
): ProductMixRow[] {
  const map = new Map<string, ProductMixRow>();
  for (const item of inventory) {
    const brand = String(item.brand ?? "Unknown");
    const product = String(item.product ?? (item as { name?: string }).name ?? "Product");
    const key = `${brand}::${product}::${item.sku ?? ""}`;
    const unknown = isUnclassifiedBrand(brand);
    const isPrimary = !unknown && primaryBrand.trim() !== "" && brandsMatch(brand, primaryBrand);
    const prev = map.get(key);
    const qty = item.quantity ?? (item as { facings?: number }).facings ?? 1;
    const facings = (prev?.facings ?? 0) + qty;
    map.set(key, {
      brand,
      product,
      sku: (item as { sku?: string }).sku ?? undefined,
      variant: item.variant ?? undefined,
      facings,
      shelf: item.shelf_position?.split("-")[0],
      location: item.shelf_position,
      confidence:
        item.confidence != null
          ? `${Math.round(Number(item.confidence) <= 1 ? Number(item.confidence) * 100 : Number(item.confidence))}%`
          : undefined,
      is_primary_brand: isPrimary,
      is_unknown: unknown,
      bar_class: "bg-brand/40",
    });
  }

  const sorted = [...map.values()].sort((a, b) => b.facings - a.facings);
  let competitorIdx = 0;
  return sorted.map((row) => {
    let bar_class: string;
    if (row.is_unknown) bar_class = "bg-muted-foreground/35";
    else if (row.is_primary_brand) bar_class = "bg-brand";
    else {
      bar_class = PRODUCT_BAR[Math.min(competitorIdx + 1, PRODUCT_BAR.length - 1)] ?? "bg-muted";
      competitorIdx += 1;
    }
    return { ...row, bar_class };
  });
}

export function formatPlannedActualLine(meta: BrandAnalysisMeta): string {
  if (meta.planned_share == null) return "Planned allocation not configured";
  const sign = (meta.variance_pts ?? 0) >= 0 ? "+" : "";
  return `Planned ${Math.round(meta.planned_share)}% · Actual ${Math.round(meta.actual_share)}% · ${sign}${meta.variance_pts} pts`;
}
