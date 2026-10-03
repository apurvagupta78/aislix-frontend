/**
 * Page-by-page reading of large reference documents on the Aislix backend: free text-layer
 * tables for digital PDF pages, OCR for scanned pages, Luna only for pages that need it.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { backendAuthHeaders } from "@/lib/backend-auth.server";
import type { ReferenceDocumentState, ReferenceField } from "@/lib/ai-audit/reference-document";
import type { DocumentJobStatus } from "@/lib/document-pipeline";
import { lunaMapColumns, lunaReadDocument } from "@/lib/reference-document-luna.server";
import {
  REFERENCE_DOCUMENT_BUCKET,
  validateReferenceDocumentInput,
  type ReadReferenceDocumentInput,
} from "@/lib/reference-document.functions";

const JOB_ID = /^[a-f0-9]{32}$/;

function backend(): { baseUrl: string; headers: Record<string, string> } | null {
  const baseUrl = (
    process.env["AISLIX_AI_API_URL"] ??
    process.env["RAILWAY_API_URL"] ??
    process.env["SCAN_API_URL"] ??
    ""
  )
    .trim()
    .replace(/\/+$/, "");
  if (!baseUrl) return null;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    ...backendAuthHeaders(),
  };
  return { baseUrl, headers };
}

async function backendDetail(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    return typeof body.detail === "string" && body.detail ? body.detail : fallback;
  } catch {
    return fallback;
  }
}

export const startDocumentPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ReadReferenceDocumentInput) => validateReferenceDocumentInput(input))
  .handler(async ({ data, context }): Promise<{ available: false } | { available: true; jobId: string }> => {
    const api = backend();
    if (!api) return { available: false };
    const { data: signed } = await context.supabase.storage
      .from(REFERENCE_DOCUMENT_BUCKET)
      .createSignedUrl(data.storagePath, 3600);
    if (!signed?.signedUrl) throw new Error("Could not open the uploaded document. Upload it again.");
    let response: Response;
    try {
      response = await fetch(`${api.baseUrl}/documents/read`, {
        method: "POST",
        headers: api.headers,
        body: JSON.stringify({ file_url: signed.signedUrl, mime_type: data.mimeType, filename: data.filename }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      return { available: false };
    }
    if (response.status === 404 || response.status === 405) return { available: false };
    if (!response.ok) throw new Error(await backendDetail(response, "Could not start reading this document."));
    const body = (await response.json()) as { job_id?: string };
    if (!body.job_id || !JOB_ID.test(body.job_id)) return { available: false };
    return { available: true, jobId: body.job_id };
  });

export const getDocumentPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { jobId: string }) => {
    if (!JOB_ID.test(input?.jobId ?? "")) throw new Error("Unknown document job.");
    return input;
  })
  .handler(async ({ data }): Promise<DocumentJobStatus> => {
    const api = backend();
    if (!api) throw new Error("Document reading is not available right now.");
    const response = await fetch(`${api.baseUrl}/documents/read/${data.jobId}`, {
      headers: api.headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 404) throw new Error("Reading was interrupted. Please upload the document again.");
    if (!response.ok) throw new Error(await backendDetail(response, "Could not check reading progress."));
    return (await response.json()) as DocumentJobStatus;
  });

export const readDocumentPageWithLuna = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { jobId: string; page: number; filename: string; category?: string | null; subCategories?: string[] }) => {
      if (!JOB_ID.test(input?.jobId ?? "")) throw new Error("Unknown document job.");
      if (!Number.isInteger(input.page) || input.page < 1) throw new Error("Unknown page.");
      return input;
    },
  )
  .handler(async ({ data }): Promise<ReferenceDocumentState> => {
    const api = backend();
    if (!api) throw new Error("Document reading is not available right now.");
    const response = await fetch(`${api.baseUrl}/documents/read/${data.jobId}/page/${data.page}.jpg`, {
      headers: { ...api.headers, accept: "image/jpeg" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`Could not open page ${data.page}.`);
    return lunaReadDocument({
      bytes: Buffer.from(await response.arrayBuffer()),
      mimeType: "image/jpeg",
      filename: `${data.filename || "document"} (page ${data.page})`,
      category: data.category,
      subCategories: data.subCategories,
    });
  });

export const mapDocumentColumns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { headers: string[]; sample: string[][] }) => {
    if (!Array.isArray(input?.headers) || !input.headers.length || input.headers.length > 60) {
      throw new Error("Unexpected table headers.");
    }
    return {
      headers: input.headers.map((h) => String(h).slice(0, 120)),
      sample: (input.sample ?? []).slice(0, 8).map((row) => row.slice(0, 60).map((c) => String(c).slice(0, 200))),
    };
  })
  .handler(async ({ data }): Promise<Partial<Record<ReferenceField, string>>> =>
    lunaMapColumns(data.headers, data.sample),
  );
