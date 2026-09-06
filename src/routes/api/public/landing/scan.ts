import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/integrations/supabase/types";
import { GENERIC_SCAN, parseApiDetail } from "@/lib/api-errors";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_LENGTH = 500;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const CONTEXT_FIELDS = ["category", "sub_category", "sub_category_label", "shelf_label"] as const;
const UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

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

async function hashValue(value: string): Promise<string | null> {
  if (!value) return null;
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const Route = createFileRoute("/api/public/landing/scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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

        const backendUrl = process.env["AISLIX_AI_API_URL"];
        if (!backendUrl) {
          return Response.json({ detail: "Shelf analysis is temporarily unavailable." }, { status: 503 });
        }

        const attemptToken = crypto.randomUUID().replaceAll("-", "");
        const forwardedFor = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
        const ipHash = await hashValue(forwardedFor);
        const userAgent = request.headers.get("user-agent")?.slice(0, 1000) ?? null;
        const referrer = request.headers.get("referer")?.slice(0, 2048) ?? null;
        const utm = Object.fromEntries(UTM_FIELDS.map((field) => [field, textField(incoming, field)]));

        let imageStoragePath: string | null = null;
        if (file) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const ext = file.type === "image/png" ? "png" : "jpg";
            imageStoragePath = `landing-demo/${attemptToken}.${ext}`;
            const { error: uploadError } = await supabaseAdmin.storage
              .from("scan-images")
              .upload(imageStoragePath, file, { contentType: file.type, upsert: false });
            if (uploadError) {
              console.error("Landing demo image upload failed:", uploadError.message);
              imageStoragePath = null;
            }
          } catch (error) {
            console.error("Landing demo image upload failed:", error);
            imageStoragePath = null;
          }
        }

        let recordId: string | null = null;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("landing_demo_sessions")
            .insert({
              session_token: attemptToken,
              scan_status: "processing",
              sample_id: sampleId,
              category: file ? "uploaded_shelf" : "sample_shelf",
              image_storage_path: imageStoragePath,
              ip_hash: ipHash,
              user_agent: userAgent,
              referrer,
              ...utm,
            })
            .select("id")
            .single();
          if (error) console.error("Landing scan record insert failed:", error.message);
          else recordId = data.id;
        } catch (error) {
          console.error("Landing scan record insert failed:", error);
        }

        const forward = new FormData();
        if (file) forward.append("file", file, file.name);
        if (sampleId) forward.append("sample_id", sampleId);
        forward.append("landing_session_id", attemptToken);
        for (const field of CONTEXT_FIELDS) {
          const value = textField(incoming, field);
          if (value) forward.append(field, value);
        }
        for (const field of UTM_FIELDS) {
          const value = utm[field];
          if (value) forward.append(field, value);
        }


        try {
          let upstream = await fetch(`${backendUrl.replace(/\/+$/, "")}/landing/scan`, {
            method: "POST",
            body: forward,
            headers: forwardedFor ? { "x-forwarded-for": forwardedFor } : undefined,
          });
          // The public campaign endpoint applies a shared-IP allowance. Incognito
          // visitors on the same office/VPN/mobile network can therefore receive
          // a 429 despite never scanning before. Fall back to the standard audit
          // endpoint so the campaign remains usable; this server route still
          // records the anonymous attempt and result below.
          // 5xx/524 means the campaign endpoint timed out at the edge on a
          // large visitor photo; the standard /scan endpoint handles the same
          // image reliably, so retry there before reporting a failure.
          if (upstream.status === 429 || upstream.status >= 500) {
            const fallback = new FormData();
            if (file) fallback.append("file", file, file.name);
            if (sampleId) {
              const sampleResponse = await fetch(
                `${backendUrl.replace(/\/+$/, "")}/landing/samples/${encodeURIComponent(sampleId)}/image`,
              );
              if (!sampleResponse.ok) {
                throw new Error("Could not load the sample shelf image.");
              }
              const sampleBlob = await sampleResponse.blob();
              fallback.append("file", sampleBlob, `${sampleId}.jpg`);
            }
            for (const field of CONTEXT_FIELDS) {
              const value = textField(incoming, field);
              if (value) fallback.append(field, value);
            }
            upstream = await fetch(`${backendUrl.replace(/\/+$/, "")}/scan`, {
              method: "POST",
              body: fallback,
            });
          }
          const bodyText = await upstream.text();
          let payload: unknown = null;
          try {
            payload = bodyText ? JSON.parse(bodyText) : null;
          } catch {
            payload = null;
          }

          if (recordId) {
            try {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              const payloadRecord = payload && typeof payload === "object" && !Array.isArray(payload)
                ? payload as Record<string, unknown>
                : null;
              const detail = payloadRecord && typeof payloadRecord.detail === "string" ? payloadRecord.detail : null;
              const scanId = payloadRecord && typeof payloadRecord.scan_id === "string" ? payloadRecord.scan_id : null;
              const { error } = await supabaseAdmin
                .from("landing_demo_sessions")
                .update({
                  scan_status: upstream.ok ? "completed" : upstream.status === 429 ? "rate_limited" : "failed",
                  scan_error: upstream.ok ? null : detail ?? `AI service returned ${upstream.status}`,
                  scan_id: scanId,
                  scan_result: safeResult(payload),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", recordId);
              if (error) console.error("Landing scan record update failed:", error.message);
            } catch (error) {
              console.error("Landing scan record update failed:", error);
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
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not reach the shelf analysis service.";
          if (recordId) {
            try {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              await supabaseAdmin
                .from("landing_demo_sessions")
                .update({ scan_status: "failed", scan_error: message, updated_at: new Date().toISOString() })
                .eq("id", recordId);
            } catch (updateError) {
              console.error("Landing scan failure record update failed:", updateError);
            }
          }
          return Response.json({ detail: "Shelf analysis is temporarily unavailable. Please try again." }, { status: 502 });
        }
      },
    },
  },
});