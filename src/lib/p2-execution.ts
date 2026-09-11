/**
 * P2 execution intelligence — audit scope, multi-photo merge, price compliance helpers.
 */

import type { MetricValue } from "@/lib/retail-intelligence";
import type { ScanResult } from "@/lib/scan-results";

export type AuditScopeSummary = {
  audited_sub_category?: string | null;
  in_scope_facings?: number;
  adjacent_bay_facings?: number;
  background_facings?: number;
  total_facings?: number;
  state?: string;
};

export type AdjacentCategoryFinding = {
  brand?: string;
  product_name?: string;
  reason?: string;
  zone?: string;
};

export type MultiPhotoSummary = {
  photo_count?: number;
  merged_facings?: number;
  facings_per_photo?: number[];
};

export type PriceComplianceLine = {
  brand?: string;
  product?: string;
  expected_price_inr?: number;
  detected_price_inr?: number | null;
  variance_inr?: number | null;
  status?: string;
};

export type PriceCompliancePayload = {
  state?: string;
  compliance_percent?: MetricValue;
  checked_tags?: MetricValue;
  compliant_tags?: MetricValue;
  lines?: PriceComplianceLine[];
  methodology?: string;
};

function metricsBlock(result?: ScanResult | null): Record<string, unknown> {
  const raw = result as ScanResult & { metrics?: Record<string, unknown> };
  return (raw?.metrics as Record<string, unknown>) ?? {};
}

export function auditScopeFromResult(result?: ScanResult | null): AuditScopeSummary | null {
  const intel = result?.retail_intelligence as Record<string, unknown> | undefined;
  const fromIntel = intel?.audit_scope;
  if (fromIntel && typeof fromIntel === "object") return fromIntel as AuditScopeSummary;
  const fromMetrics = metricsBlock(result).audit_scope;
  if (fromMetrics && typeof fromMetrics === "object") return fromMetrics as AuditScopeSummary;
  return null;
}

export function adjacentFindingsFromResult(result?: ScanResult | null): AdjacentCategoryFinding[] {
  const intel = result?.retail_intelligence as Record<string, unknown> | undefined;
  const fromIntel = intel?.adjacent_category_findings;
  if (Array.isArray(fromIntel)) return fromIntel as AdjacentCategoryFinding[];
  const fromMetrics = metricsBlock(result).adjacent_category_findings;
  if (Array.isArray(fromMetrics)) return fromMetrics as AdjacentCategoryFinding[];
  return [];
}

export function multiPhotoFromResult(result?: ScanResult | null): MultiPhotoSummary | null {
  const intel = result?.retail_intelligence as Record<string, unknown> | undefined;
  const fromIntel = intel?.multi_photo;
  if (fromIntel && typeof fromIntel === "object") return fromIntel as MultiPhotoSummary;
  const fromMetrics = metricsBlock(result).multi_photo;
  if (fromMetrics && typeof fromMetrics === "object") return fromMetrics as MultiPhotoSummary;
  if ((result?.summary?.total_facings ?? 0) > 0 && (result as ScanResult & { photo_count?: number })?.photo_count) {
    return {
      photo_count: (result as ScanResult & { photo_count?: number }).photo_count,
      merged_facings: result?.summary?.total_facings,
    };
  }
  return null;
}

export function pricingFromResult(result?: ScanResult | null): PriceCompliancePayload | null {
  const pricing = result?.retail_intelligence?.pricing;
  if (!pricing || typeof pricing !== "object") return null;
  if ("state" in pricing || "compliance_percent" in pricing || "lines" in pricing) {
    return pricing as PriceCompliancePayload;
  }
  return null;
}

export function formatScopeReason(reason?: string): string {
  if (reason === "frame_edge_adjacent_category") {
    return "Neighboring category at frame edge";
  }
  if (reason === "category_mismatch") {
    return "Category mismatch (in bay)";
  }
  return reason?.replace(/_/g, " ") ?? "Adjacent category";
}
