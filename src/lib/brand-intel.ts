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
};

export type CompetitorSnapshot = {
  primary_brand: string;
  own_brand_share_percent: number;
  competitor_shares: CompetitorShareRow[];
  competitors_detected: number;
  competitors_configured: number;
};

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

/** Build competitor intel from brand share rows + org config (works on old scans). */
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
