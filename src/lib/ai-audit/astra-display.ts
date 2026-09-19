/** Resolve Astra analysis + extras for the AI audit results page. */

import {
  astraAnalysisFromScanResult,
  type AstraImageQuality,
  type AstraShelfIssue,
  type AstraVisiblePrice,
  type AstraVisiblePromotion,
  type NormalizedAstraAnalysis,
} from "@/lib/ai-audit/astra-response";
import { operatingModelLabel } from "@/lib/ai-audit/astra-analysis";
import type { ScanResult } from "@/lib/scan-results";

export type AiAuditViewKind = "planogram" | "shelf_only" | "incomplete";

export type AstraOutputExtras = {
  operating_model?: string;
  operating_model_label?: string;
  image_quality?: AstraImageQuality;
  visible_prices: AstraVisiblePrice[];
  visible_promotions: AstraVisiblePromotion[];
  shelf_issues: AstraShelfIssue[];
  raw_mode?: string;
  location?: string;
};

export type AiAuditDisplayContext = {
  analysis: NormalizedAstraAnalysis;
  viewKind: AiAuditViewKind;
  intendedViewKind: "planogram" | "shelf_only";
  extras: AstraOutputExtras;
  isComplete: boolean;
  incompleteReason?: string;
  compliancePercent: number | null;
};

function pickRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function resolveViewKind(result: ScanResult): AiAuditViewKind {
  const mode = (result.analysis_mode ?? "").toLowerCase();
  // Explicit shelf-only wins — do not treat facing_compliance / null planogram % as planogram mode.
  if (mode === "shelf_only" || mode === "no_planogram" || mode === "image_only_shelf_analysis") {
    return "shelf_only";
  }
  if (mode === "planogram_comparison" || mode === "with_planogram" || result.planogram?.requested) {
    return "planogram";
  }
  return "shelf_only";
}

function extractExtras(
  analysis: NormalizedAstraAnalysis,
  result: ScanResult,
): AstraOutputExtras {
  const rawBlocks = [
    pickRecord(result.astra_planogram_analysis),
    pickRecord(result.astra_shelf_analysis),
    pickRecord((result.retail_intelligence as Record<string, unknown> | undefined)?.astra_analysis),
  ].filter(Boolean) as Record<string, unknown>[];

  const merged: AstraOutputExtras = {
    visible_prices: pickArray(result.astra_visible_prices),
    visible_promotions: pickArray(result.astra_visible_promotions),
    shelf_issues: pickArray(result.astra_shelf_issues),
  };

  for (const block of rawBlocks) {
    if (typeof block.operating_model === "string") merged.operating_model = block.operating_model;
    if (typeof block.location === "string") merged.location = block.location;
    if (typeof block.mode === "string") merged.raw_mode = block.mode;
    const iq = block.image_quality;
    if (iq && typeof iq === "object" && !Array.isArray(iq)) {
      merged.image_quality = {
        status: String((iq as Record<string, unknown>).status ?? ""),
        reason:
          typeof (iq as Record<string, unknown>).reason === "string"
            ? ((iq as Record<string, unknown>).reason as string)
            : undefined,
      };
    }
    if (pickArray(block.visible_prices).length) merged.visible_prices = pickArray(block.visible_prices);
    if (pickArray(block.visible_promotions).length) {
      merged.visible_promotions = pickArray(block.visible_promotions);
    }
    if (pickArray(block.shelf_issues).length) merged.shelf_issues = pickArray(block.shelf_issues);
  }

  if (analysis.mode === "planogram" || analysis.mode === "shelf_only") {
    if (!merged.operating_model && analysis.operating_model) {
      merged.operating_model = analysis.operating_model;
    }
    if (!merged.location && analysis.location) merged.location = analysis.location;
    if (!merged.image_quality && analysis.image_quality) merged.image_quality = analysis.image_quality;
    if (analysis.mode === "shelf_only") {
      if (!merged.visible_prices.length) merged.visible_prices = analysis.visible_prices;
      if (!merged.visible_promotions.length) merged.visible_promotions = analysis.visible_promotions;
      if (!merged.shelf_issues.length) merged.shelf_issues = analysis.shelf_issues;
    }
  }

  if (merged.operating_model) {
    merged.operating_model_label = operatingModelLabel(merged.operating_model);
  }
  return merged;
}

function compliancePercent(analysis: NormalizedAstraAnalysis): number | null {
  if (analysis.mode === "planogram") {
    return analysis.summary.overall_planogram_compliance_percent ?? null;
  }
  return null;
}

export function buildAiAuditDisplayContext(result: ScanResult): AiAuditDisplayContext {
  const intendedViewKind = resolveViewKind(result);
  const analysis = astraAnalysisFromScanResult(result);
  const extras = extractExtras(analysis, result);

  if (analysis.mode === "incomplete") {
    return {
      analysis,
      viewKind: "incomplete",
      intendedViewKind,
      extras,
      isComplete: false,
      incompleteReason: analysis.reason,
      compliancePercent: null,
    };
  }

  const modeMatches =
    (intendedViewKind === "planogram" && analysis.mode === "planogram") ||
    (intendedViewKind === "shelf_only" && analysis.mode === "shelf_only");

  if (!modeMatches) {
    return {
      analysis,
      viewKind: "incomplete",
      intendedViewKind,
      extras,
      isComplete: false,
      incompleteReason:
        intendedViewKind === "planogram"
          ? "This planogram scan did not return structured Astra planogram comparison data. Please re-run the scan."
          : "This shelf-only scan did not return structured Astra shelf analysis data. Please re-run the scan.",
      compliancePercent: null,
    };
  }

  return {
    analysis,
    viewKind: intendedViewKind,
    intendedViewKind,
    extras,
    isComplete: true,
    compliancePercent: compliancePercent(analysis),
  };
}

export function enrichScanResultWithAstra(result: ScanResult): ScanResult {
  const ctx = buildAiAuditDisplayContext(result);
  if (!ctx.isComplete) return result;
  return {
    ...result,
    retail_intelligence: {
      ...(result.retail_intelligence ?? {}),
      astra_analysis: ctx.analysis,
    },
  };
}
