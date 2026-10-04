import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/integrations/supabase/types";
import { GENERIC_SCAN, parseApiDetail } from "@/lib/api-errors";
import { parseAiAnalysisRequest, type AiAnalysisRequest } from "@/lib/ai-audit/ai-analysis";
import { runLunaAnalysis } from "@/lib/ai-audit/luna-analysis.server";
import { buildLunaEvidence, shelfProductsFromRows } from "@/lib/ai-audit/luna-evidence";
import { findReferenceMatch } from "@/lib/ai-audit/reference-match";
import {
  hashForBucket,
  requestClientIp,
  tooManyRequests,
  withinRateLimits,
} from "@/lib/rate-limit.server";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_LENGTH = 500;
const MAX_VISION_PROMPT_CHARS = 60_000;
const MAX_PLANOGRAM_CHARS = 400_000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const CONTEXT_FIELDS = ["category", "sub_category", "sub_category_label", "shelf_label"] as const;
const ASTRA_FIELDS = [
  "customer_type",
  "analysis_mode",
  "operating_model",
  "vision_prompt",
  "planogram_items",
  "comparison_basis",
  "reference_items",
  "reference_document",
] as const;
const UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const LONG_FIELD_CAPS: Record<string, number> = {
  vision_prompt: MAX_VISION_PROMPT_CHARS,
  planogram_items: MAX_PLANOGRAM_CHARS,
  reference_items: MAX_PLANOGRAM_CHARS,
  reference_document: 20_000,
  ai_analysis: 4_000,
};

function aiAnalysisFromForm(form: FormData): AiAnalysisRequest | null {
  const raw = longTextField(form, "ai_analysis");
  if (!raw) return null;
  try {
    return parseAiAnalysisRequest(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Luna answers the visitor's checks / question from the finished demo scan. Never throws. */
async function attachLunaAnalysis(payload: Record<string, unknown>, request: AiAnalysisRequest) {
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
    }),
  );
  payload.metrics = { ...metrics, luna_analysis: analysis };
}

function longTextField(form: FormData, field: string): string | null {
  const value = form.get(field);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function appendForwardedFields(form: FormData, incoming: FormData, fields: readonly string[]) {
  for (const field of fields) {
    const value = field in LONG_FIELD_CAPS ? longTextField(incoming, field) : textField(incoming, field);
    if (value) form.append(field, value);
  }
}

function textField(form: FormData, field: string): string | null {
  const value = form.get(field);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_TEXT_LENGTH) : null;
}

function safeResult(payload: unknown): Json | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const { annotated_image_base64: _annotated, original_image_base64: _original, csv_base64: _csv, ...rest } =
    payload as Record<string, unknown>;
  return JSON.parse(JSON.stringify(rest)) as Json;
}

export const Route = createFileRoute("/api/public/landing/scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (Number(request.headers.get("content-length") ?? 0) > MAX_FILE_BYTES + 1024 * 1024) {
          return Response.json({ detail: "Upload a JPEG or PNG shelf image up to 10MB." }, { status: 413 });
        }

        const clientIp = requestClientIp(request);
        const ipHash = await hashForBucket(clientIp);
        const allowed = await withinRateLimits([
          [`landing_scan:ip:${ipHash}`, 10, 3600],
          ["landing_scan:global", 300, 86400],
        ]);
        if (!allowed) {
          return tooManyRequests("The free demo is busy right now. Sign up free to run your own AI audits.");
        }

        let incoming: FormData;
        try {
          incoming = await request.formData();
        } catch {
          return Response.json({ detail: "Expected a shelf image or sample." }, { status: 400 });
        }

        const fileValue = incoming.get("file");
        const file = fileValue instanceof File ? fileValue : null;
        const sampleId = textField(incoming, "sample_id");
        if ((!file && !sampleId) || (file && sampleId)) {
          return Response.json({ detail: "Choose either a sample or one shelf image." }, { status: 400 });
        }
        if (file && (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_FILE_BYTES)) {
          return Response.json({ detail: "Upload a JPEG or PNG shelf image up to 10MB." }, { status: 400 });
        }
        for (const [field, cap] of Object.entries(LONG_FIELD_CAPS)) {
          if ((longTextField(incoming, field)?.length ?? 0) > cap) {
            return Response.json({ detail: "Audit setup is too large for the free demo." }, { status: 413 });
          }
        }

        const backendUrl = process.env["AISLIX_AI_API_URL"];
        if (!backendUrl) {
          return Response.json({ detail: "Shelf analysis is temporarily unavailable." }, { status: 503 });
        }

        const attemptToken = crypto.randomUUID().replaceAll("-", "");
        const userAgent = request.headers.get("user-agent")?.slice(0, 1000) ?? null;
        const referrer = request.headers.get("referer")?.slice(0, 2048) ?? null;
        const utm = Object.fromEntries(UTM_FIELDS.map((field) => [field, textField(incoming, field)]));

        const forward = new FormData();
        if (file) forward.append("file", file, file.name);
        if (sampleId) forward.append("sample_id", sampleId);
        forward.append("landing_session_id", attemptToken);
        appendForwardedFields(forward, incoming, CONTEXT_FIELDS);
        appendForwardedFields(forward, incoming, ASTRA_FIELDS);
        for (const field of UTM_FIELDS) {
          const value = utm[field];
          if (value) forward.append(field, value);
        }

        try {
          const upstream = await fetch(`${backendUrl.replace(/\/+$/, "")}/landing/scan`, {
            method: "POST",
            body: forward,
            headers: clientIp !== "unknown" ? { "x-forwarded-for": clientIp } : {},
          });
          const bodyText = await upstream.text();
          let payload: unknown = null;
          try {
            payload = bodyText ? JSON.parse(bodyText) : null;
          } catch {
            payload = null;
          }

          const aiRequest = aiAnalysisFromForm(incoming);
          if (upstream.ok && aiRequest && payload && typeof payload === "object" && !Array.isArray(payload)) {
            await attachLunaAnalysis(payload as Record<string, unknown>, aiRequest);
          }

          if (upstream.ok || upstream.status === 422) {
            try {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              const payloadRecord =
                payload && typeof payload === "object" && !Array.isArray(payload)
                  ? (payload as Record<string, unknown>)
                  : null;
              const detail =
                payloadRecord && typeof payloadRecord.detail === "string" ? payloadRecord.detail : null;
              const scanId =
                payloadRecord && typeof payloadRecord.scan_id === "string" ? payloadRecord.scan_id : null;
              const { error } = await supabaseAdmin.from("landing_demo_sessions").upsert(
                {
                  session_token: attemptToken,
                  scan_status: upstream.ok ? "completed" : "failed",
                  scan_error: upstream.ok ? null : detail ?? `AI service returned ${upstream.status}`,
                  scan_id: scanId,
                  scan_result: upstream.ok ? safeResult(payload) : null,
                  sample_id: sampleId,
                  category: file ? "uploaded_shelf" : "sample_shelf",
                  ip_hash: ipHash,
                  user_agent: userAgent,
                  referrer,
                  ...utm,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "session_token" },
              );
              if (error) console.error("Landing scan record finalize failed:", error.message);
            } catch (error) {
              console.error("Landing scan record finalize failed:", error);
            }
          }

          if (payload && typeof payload === "object" && !Array.isArray(payload)) {
            (payload as Record<string, unknown>).landing_session_id = attemptToken;
          }
          const responseBody = upstream.ok
            ? (payload ?? {})
            : { detail: parseApiDetail(payload ?? {}, GENERIC_SCAN) };
          return Response.json(responseBody, {
            status: upstream.status,
            headers: { "Cache-Control": "no-store" },
          });
        } catch {
          return Response.json(
            { detail: "Shelf analysis is temporarily unavailable. Please try again." },
            { status: 502 },
          );
        }
      },
    },
  },
});
