/** Resolve Astra analysis + extras for the AI audit results page. */

import {
  astraAnalysisFromScanResult,
  normalizeAstraAnalysis,
  type AstraImageQuality,
  type NormalizedAstraAnalysis,
} from "@/lib/ai-audit/astra-response";
import {
  resolveAiAuditViewKind,
  synthesizeExpectedProductsAnalysis,
  type AiAuditViewKind,
} from "@/lib/ai-audit/astra-expected-synthesis";
import { operatingModelLabel } from "@/lib/ai-audit/astra-analysis";
import type { ScanResult } from "@/lib/scan-results";

export type AstraVisiblePrice = {
  product_name?: string;
  price?: string;
  confidence?: number;
};

export type AstraVisiblePromotion = {
  product_or_brand?: string;
  promotion_text?: string;
  confidence?: number;
};

export type AstraShelfIssue = {
  issue_type?: string;
  description?: string;
  severity?: string;
  confidence?: number;
};

export type AstraOutputExtras = {
  operating_model?: string;
  operating_model_label?: string;
  image_quality?: AstraImageQuality;
  visible_prices: AstraVisiblePrice[];
  visible_promotions: AstraVisiblePromotion[];
  shelf_issues: AstraShelfIssue[];
  raw_mode?: string;
};

export type AiAuditDisplayContext = {
  analysis: NormalizedAstraAnalysis;
  viewKind: AiAuditViewKind;
  extras: AstraOutputExtras;
  comparisonSynthesized: boolean;
  matchRatePercent: number | null;
};

function pickRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function extractExtrasFromBlock(block: Record<string, unknown> | null): Partial<AstraOutputExtras> {
  if (!block) return {};
  const iq = block.image_quality;
  return {
    operating_model: typeof block.operating_model === "string" ? block.operating_model : undefined,
    image_quality:
      iq && typeof iq === "object" && !Array.isArray(iq)
        ? {
            status: String((iq as Record<string, unknown>).status ?? ""),
            reason:
              typeof (iq as Record<string, unknown>).reason === "string"
                ? ((iq as Record<string, unknown>).reason as string)
                : undefined,
          }
        : undefined,
    visible_prices: pickArray(block.visible_prices),
    visible_promotions: pickArray(block.visible_promotions),
    shelf_issues: pickArray(block.shelf_issues),
    raw_mode: typeof block.mode === "string" ? block.mode : undefined,
  };
}

function mergeExtras(...parts: Partial<AstraOutputExtras>[]): AstraOutputExtras {
  const merged: AstraOutputExtras = {
    visible_prices: [],
    visible_promotions: [],
    shelf_issues: [],
  };
  for (const part of parts) {
    if (part.operating_model) merged.operating_model = part.operating_model;
    if (part.image_quality) merged.image_quality = part.image_quality;
    if (part.raw_mode) merged.raw_mode = part.raw_mode;
    if (part.visible_prices?.length) merged.visible_prices = part.visible_prices;
    if (part.visible_promotions?.length) merged.visible_promotions = part.visible_promotions;
    if (part.shelf_issues?.length) merged.shelf_issues = part.shelf_issues;
  }
  if (merged.operating_model) {
    merged.operating_model_label = operatingModelLabel(merged.operating_model);
  }
  return merged;
}

function matchRateFromAnalysis(analysis: NormalizedAstraAnalysis): number | null {
  if (analysis.mode === "expected_products") {
    const total = analysis.summary.total_products ?? analysis.products.length;
    if (!total) return null;
    const matched = analysis.summary.matched_products ?? 0;
    return Math.round((matched / total) * 100);
  }
  if (analysis.mode === "planogram") {
    const total = analysis.summary.total_planogram_rows ?? analysis.rows.length;
    if (!total) return null;
    const matched = analysis.summary.matched_rows ?? 0;
    return Math.round((matched / total) * 100);
  }
  return null;
}

/** Full Astra context for rendering — synthesizes comparison when Railway omitted it. */
export function buildAiAuditDisplayContext(result: ScanResult): AiAuditDisplayContext {
  let comparisonSynthesized = false;
  let analysis = astraAnalysisFromScanResult(result);

  const rawBlocks = [
    pickRecord(result.astra_planogram_analysis),
    pickRecord(result.astra_expected_products_analysis),
    pickRecord(
      (result.retail_intelligence as Record<string, unknown> | undefined)?.astra_analysis,
    ),
  ].filter(Boolean) as Record<string, unknown>[];

  const extras = mergeExtras(
    ...rawBlocks.map((b) => extractExtrasFromBlock(b)),
    {
      visible_prices: pickArray(result.astra_visible_prices),
      visible_promotions: pickArray(result.astra_visible_promotions),
      shelf_issues: pickArray(result.astra_shelf_issues),
    },
  );

  if (
    analysis.mode === "shelf_only" &&
    (result.expected_products?.length ?? 0) > 0 &&
    (result.inventory?.length ?? 0) > 0
  ) {
    const synthesized = synthesizeExpectedProductsAnalysis({
      expectedProducts: result.expected_products ?? [],
      inventory: result.inventory ?? [],
      operatingModel:
        extras.operating_model ??
        (result.retail_intelligence as { audit_role?: string } | undefined)?.audit_role,
    });
    if (synthesized) {
      analysis = synthesized;
      comparisonSynthesized = true;
    }
  }

  if (analysis.mode !== "shelf_only" && !extras.image_quality && analysis.image_quality) {
    extras.image_quality = analysis.image_quality;
  }
  if (analysis.mode !== "shelf_only" && !extras.operating_model && analysis.operating_model) {
    extras.operating_model = analysis.operating_model;
    extras.operating_model_label = operatingModelLabel(analysis.operating_model);
  }

  const viewKind = resolveAiAuditViewKind({
    astra: analysis,
    submittedAnalysisMode: result.analysis_mode,
    expectedProductCount: result.expected_products?.length ?? 0,
    planogramRequested: result.planogram?.requested,
  });

  return {
    analysis,
    viewKind,
    extras,
    comparisonSynthesized,
    matchRatePercent: matchRateFromAnalysis(analysis),
  };
}

/** Re-attach synthesized analysis onto a scan result for downstream consumers. */
export function enrichScanResultWithAstra(result: ScanResult): ScanResult {
  const ctx = buildAiAuditDisplayContext(result);
  if (ctx.comparisonSynthesized && ctx.analysis.mode === "expected_products") {
    return {
      ...result,
      astra_expected_products_analysis: {
        operating_model: ctx.analysis.operating_model,
        image_quality: ctx.analysis.image_quality,
        products: ctx.analysis.products,
        summary: ctx.analysis.summary,
        _synthesized: true,
      },
      retail_intelligence: {
        ...(result.retail_intelligence ?? {}),
        astra_analysis: ctx.analysis,
      },
    };
  }
  if (ctx.analysis.mode !== "shelf_only") {
    return {
      ...result,
      retail_intelligence: {
        ...(result.retail_intelligence ?? {}),
        astra_analysis: ctx.analysis,
      },
    };
  }
  return result;
}

export function normalizeAstraFromPayload(payload: unknown): NormalizedAstraAnalysis {
  return normalizeAstraAnalysis(payload);
}
