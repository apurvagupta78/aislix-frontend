/**
 * Org-level brand / competitor configuration for share-of-shelf intelligence.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId } from "@/lib/db/context";

export type BrandConfig = {
  primary_brand: string;
  competitor_brands: string[];
};

export type CompetitorShareRow = {
  brand: string;
  share: number;
  facings?: number;
  is_primary?: boolean;
  is_competitor?: boolean;
  /** True when the brand was detected outside the audited sub-category. */
  different_category?: boolean;
};

export type CompetitorUpperHand = {
  brand: string;
  share: number;
  note: string;
  different_category?: boolean;
};

export function formatCompetitorBrandLabel(brand: string, differentCategory?: boolean): string {
  return differentCategory ? `${brand} (different category)` : brand;
}

export type CompetitorSnapshot = {
  primary_brand: string;
  own_brand_share_percent: number;
  /** Share for a specific planogram SKU (e.g. Colgate Max Fresh only — not all Colgate). */
  product_share_percent?: number;
  product_label?: string;
  competitor_shares: CompetitorShareRow[];
  competitors_detected: number;
  competitors_configured: number;
  /** True when competitor list comes from org/planogram config, not shelf heuristics. */
  competitors_tracked_configured?: boolean;
  /** Facings that could not be classified to a known brand. */
  unclassified_facings?: number;
  unclassified_share_percent?: number;
  /** Competitors leading shelf share vs the primary brand. */
  upper_hand?: CompetitorUpperHand[];
};

const UNCLASSIFIED_BRANDS = new Set(["", "unknown", "unidentified", "unclassified"]);

export function isUnclassifiedBrand(brand: string): boolean {
  return UNCLASSIFIED_BRANDS.has(brand.trim().toLowerCase());
}

const emptyConfig = (): BrandConfig => ({ primary_brand: "", competitor_brands: [] });

function parseBrandConfig(raw: unknown): BrandConfig {
  if (!raw || typeof raw !== "object") return emptyConfig();
  const obj = raw as Record<string, unknown>;
  const primary = typeof obj.primary_brand === "string" ? obj.primary_brand.trim() : "";
  const competitors = Array.isArray(obj.competitor_brands)
    ? obj.competitor_brands
        .map((b) => (typeof b === "string" ? b.trim() : ""))
        .filter(Boolean)
    : [];
  return { primary_brand: primary, competitor_brands: [...new Set(competitors)] };
}

export async function fetchBrandConfig(): Promise<BrandConfig> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("organizations")
    .select("brand_config")
    .eq("id", orgId)
    .maybeSingle();
  if (error) {
    // Column-level GRANT may omit brand_config until migration 20260909210000 is applied.
    if (/permission denied/i.test(error.message)) return emptyConfig();
    dbError(error, "Could not load brand settings.");
  }
  return parseBrandConfig(data?.brand_config);
}

export async function saveBrandConfig(input: BrandConfig): Promise<BrandConfig> {
  const orgId = await requireOrgId();
  const payload = {
    primary_brand: input.primary_brand.trim(),
    competitor_brands: input.competitor_brands.map((b) => b.trim()).filter(Boolean),
  };
  const { error } = await supabase
    .from("organizations")
    .update({ brand_config: payload } as never)
    .eq("id", orgId);
  if (error) dbError(error, "Could not save brand settings.");
  return payload;
}

function brandKey(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeBrandKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function brandsMatch(a: string, b: string): boolean {
  const na = normalizeBrandKey(a);
  const nb = normalizeBrandKey(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function subCategoriesAlign(expected: string, detected: string): boolean {
  const e = expected.trim().toLowerCase();
  const d = detected.trim().toLowerCase();
  if (!e || !d) return true;
  if (e === d || e.includes(d) || d.includes(e)) return true;
  const tokenize = (value: string) =>
    value.split(/[\s/,-]+/).filter((token) => token.length > 2);
  const eTokens = tokenize(e);
  const dTokens = tokenize(d);
  return eTokens.some((token) => dTokens.includes(token));
}

type CategoryInventoryRow = {
  brand: string;
  category?: string;
  detected_sub_category_label?: string;
  compliance_status?: "ok" | "category_mismatch";
};

/** True when facings for this brand sit outside the audited sub-category. */
export function brandIsDifferentCategory(
  inventory: CategoryInventoryRow[],
  brandName: string,
  auditSubCategory: string,
): boolean {
  if (!auditSubCategory.trim()) return false;
  const items = inventory.filter((row) => brandsMatch(row.brand, brandName));
  if (!items.length) return false;
  if (items.some((row) => row.compliance_status === "category_mismatch")) return true;
  return items.some((row) => {
    const detected = row.detected_sub_category_label?.trim() || row.category?.trim() || "";
    if (!detected) return false;
    return !subCategoriesAlign(auditSubCategory, detected);
  });
}

/** Flag cross-category competitors on an existing snapshot. */
export function annotateCompetitorCategories(
  snapshot: CompetitorSnapshot | null,
  inventory: CategoryInventoryRow[],
  auditSubCategory?: string,
): CompetitorSnapshot | null {
  if (!snapshot || !auditSubCategory?.trim()) return snapshot;

  const isDifferent = (brand: string) => brandIsDifferentCategory(inventory, brand, auditSubCategory);

  return {
    ...snapshot,
    competitor_shares: snapshot.competitor_shares.map((row) => ({
      ...row,
      different_category: row.is_primary ? undefined : isDifferent(row.brand),
    })),
    upper_hand: snapshot.upper_hand?.map((edge) => {
      const different = isDifferent(edge.brand);
      return {
        ...edge,
        different_category: different,
        note: different
          ? edge.note.replace(
              new RegExp(`\\b${edge.brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`),
              formatCompetitorBrandLabel(edge.brand, true),
            )
          : edge.note,
      };
    }),
  };
}

/** Build competitor intel from brand share rows + org config (works on old audits). */
export function buildCompetitorSnapshot(
  brandRows: { brand: string; share: number }[] | undefined,
  config: BrandConfig,
  metricsSnapshot?: Partial<CompetitorSnapshot>,
): CompetitorSnapshot | null {
  if (metricsSnapshot?.primary_brand) {
    return {
      primary_brand: metricsSnapshot.primary_brand,
      own_brand_share_percent: metricsSnapshot.own_brand_share_percent ?? 0,
      competitor_shares: metricsSnapshot.competitor_shares ?? [],
      competitors_detected: metricsSnapshot.competitors_detected ?? 0,
      competitors_configured: metricsSnapshot.competitors_configured ?? config.competitor_brands.length,
    };
  }

  const primary = config.primary_brand.trim();
  if (!primary || !brandRows?.length) return null;

  const byKey = new Map<string, { brand: string; share: number }>();
  for (const row of brandRows) {
    byKey.set(brandKey(row.brand), row);
  }

  const primaryRow = byKey.get(brandKey(primary));
  const ownShare = primaryRow?.share ?? 0;

  const competitorShares: CompetitorShareRow[] = config.competitor_brands.map((name) => {
    const row = byKey.get(brandKey(name));
    return {
      brand: name,
      share: row?.share ?? 0,
      is_competitor: true,
    };
  });

  const competitorsDetected = competitorShares.filter((r) => r.share > 0).length;

  return {
    primary_brand: primary,
    own_brand_share_percent: ownShare,
    competitor_shares: [
      { brand: primary, share: ownShare, is_primary: true },
      ...competitorShares,
    ],
    competitors_detected: competitorsDetected,
    competitors_configured: config.competitor_brands.length,
  };
}
