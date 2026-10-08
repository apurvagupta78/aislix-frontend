import type { Json } from "@/integrations/supabase/types";
import { parseAiAnalysisRequest, type AiAnalysisRequest } from "@/lib/ai-audit/ai-analysis";
import { runLunaAnalysis } from "@/lib/ai-audit/luna-analysis.server";
import { buildLunaEvidence, shelfProductsFromRows, shelfPromotionsFromAstra } from "@/lib/ai-audit/luna-evidence";
import { findReferenceMatch } from "@/lib/ai-audit/reference-match";

export const MAX_AI_ANALYSIS_CHARS = 4_000;

export function parseAiAnalysisText(raw: string | null | undefined): AiAnalysisRequest | null {
  const text = raw?.trim();
  if (!text || text.length > MAX_AI_ANALYSIS_CHARS) return null;
  try {
    return parseAiAnalysisRequest(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Luna answers the visitor's checks / question from the finished demo scan. Never throws. */
export async function attachLunaAnalysis(payload: Record<string, unknown>, request: AiAnalysisRequest) {
  const metrics =
    payload.metrics && typeof payload.metrics === "object" && !Array.isArray(payload.metrics)
      ? (payload.metrics as Record<string, unknown>)
      : {};
  const products = shelfProductsFromRows(payload.inventory);
  const brandShare = (Array.isArray(payload.brand_share) ? payload.brand_share : [])
    .filter((b): b is Record<string, unknown> => Boolean(b) && typeof b === "object")
    .map((b) => ({ brand: String(b.brand ?? "Unknown"), share: Number(b.share ?? b.percent ?? 0) || 0 }));
  const multiPhoto = metrics.multi_photo as Record<string, unknown> | undefined;
  const analysis = await runLunaAnalysis(
    request,
    buildLunaEvidence({
      referenceMatch: findReferenceMatch(metrics, payload),
      products,
      brandShare,
      totalFacings: products.reduce((sum, p) => sum + p.facings, 0),
      countPending: metrics.scan_complete === false,
      photoCount: typeof multiPhoto?.photo_count === "number" ? multiPhoto.photo_count : 1,
      promotions: shelfPromotionsFromAstra(metrics.astra_cv_analysis ?? payload.astra_cv_analysis),
    }),
  );
  payload.metrics = { ...metrics, luna_analysis: analysis };
}

/** Result row without the heavy base64 image / CSV blobs. */
export function safeLandingResult(payload: unknown): Json | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const { annotated_image_base64: _annotated, original_image_base64: _original, csv_base64: _csv, ...rest } =
    payload as Record<string, unknown>;
  return JSON.parse(JSON.stringify(rest)) as Json;
}

/** Upserts the anonymous demo session row; only the given columns change. Never throws. */
export async function recordLandingSession(sessionToken: string, fields: Record<string, unknown>) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("landing_demo_sessions")
      .upsert(
        { session_token: sessionToken, ...fields, updated_at: new Date().toISOString() } as never,
        { onConflict: "session_token" },
      );
    if (error) console.error("Landing scan record failed:", error.message);
  } catch (error) {
    console.error("Landing scan record failed:", error);
  }
}
