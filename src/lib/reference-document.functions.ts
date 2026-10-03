/**
 * Luna reads a customer reference document (image or PDF) into structured line items.
 * The file is uploaded to the org's scan-images folder first; it is read here under the
 * caller's own storage policy.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ReferenceDocumentState } from "@/lib/ai-audit/reference-document";
import { lunaReadDocument } from "@/lib/reference-document-luna.server";

export const REFERENCE_DOCUMENT_BUCKET = "scan-images";

export type ReadReferenceDocumentInput = {
  storagePath: string;
  mimeType: string;
  filename: string;
  category?: string | null;
  subCategories?: string[];
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateReferenceDocumentInput<T extends { storagePath: string; mimeType: string }>(input: T): T {
  if (!input?.storagePath || !input?.mimeType) throw new Error("Attach a document to read.");
  const mime = input.mimeType.toLowerCase();
  if (!IMAGE_TYPES.has(mime) && mime !== "application/pdf") {
    throw new Error("Upload a JPG, PNG, WebP image or a PDF.");
  }
  if (!input.storagePath.includes("/reference-documents/")) {
    throw new Error("Unexpected document location.");
  }
  return { ...input, mimeType: mime };
}

export const readReferenceDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ReadReferenceDocumentInput) => validateReferenceDocumentInput(input))
  .handler(async ({ data, context }): Promise<ReferenceDocumentState> => {
    const { data: blob, error } = await context.supabase.storage
      .from(REFERENCE_DOCUMENT_BUCKET)
      .download(data.storagePath);
    if (error || !blob) throw new Error("Could not open the uploaded document. Upload it again.");
    const state = await lunaReadDocument({
      bytes: Buffer.from(await blob.arrayBuffer()),
      mimeType: data.mimeType,
      filename: data.filename,
      category: data.category,
      subCategories: data.subCategories,
    });
    return {
      ...state,
      meta: { ...state.meta, storage_path: data.storagePath, mime_type: data.mimeType },
    };
  });
