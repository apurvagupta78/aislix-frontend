/**
 * Luna reads a customer reference document (image or PDF) into structured line items.
 * The file is uploaded to the org's scan-images folder first; it is read here under the
 * caller's own storage policy.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildDocumentReaderPrompt } from "@/lib/ai-audit/prompts/document-reader.prompt";
import { parseLunaDocument, type ReferenceDocumentState } from "@/lib/ai-audit/reference-document";

export const REFERENCE_DOCUMENT_BUCKET = "scan-images";

export type ReadReferenceDocumentInput = {
  storagePath: string;
  mimeType: string;
  filename: string;
  category?: string | null;
  subCategories?: string[];
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const readReferenceDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ReadReferenceDocumentInput) => {
    if (!input?.storagePath || !input?.mimeType) throw new Error("Attach a document to read.");
    const mime = input.mimeType.toLowerCase();
    if (!IMAGE_TYPES.has(mime) && mime !== "application/pdf") {
      throw new Error("Upload a JPG, PNG, WebP image or a PDF.");
    }
    if (!input.storagePath.includes("/reference-documents/")) {
      throw new Error("Unexpected document location.");
    }
    return { ...input, mimeType: mime };
  })
  .handler(async ({ data, context }): Promise<ReferenceDocumentState> => {
    const { data: blob, error } = await context.supabase.storage
      .from(REFERENCE_DOCUMENT_BUCKET)
      .download(data.storagePath);
    if (error || !blob) throw new Error("Could not open the uploaded document. Upload it again.");
    const bytes = Buffer.from(await blob.arrayBuffer());

    const OpenAI = (await import("openai")).default;
    const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
    if (!apiKey) throw new Error("Document reading is not configured (OPENAI_API_KEY missing).");
    const model =
      (process.env.OPENAI_DOC_MODEL ?? "").trim() ||
      (process.env.OPENAI_MODEL ?? "").trim() ||
      "gpt-5.6-luna";

    const prompt = buildDocumentReaderPrompt({
      category: data.category,
      subCategories: data.subCategories,
    });
    const dataUrl = `data:${data.mimeType};base64,${bytes.toString("base64")}`;
    const attachment =
      data.mimeType === "application/pdf"
        ? { type: "input_file" as const, filename: data.filename || "document.pdf", file_data: dataUrl }
        : { type: "input_image" as const, image_url: dataUrl, detail: "high" as const };

    const client = new OpenAI({ apiKey, timeout: 120_000 });
    const response = await client.responses.create({
      model,
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }, attachment] }],
      text: { format: { type: "json_object" } },
      max_output_tokens: 8192,
    });

    const text = String(response.output_text ?? "").trim();
    if (!text) throw new Error("Luna returned an empty reading. Try a clearer photo of the document.");
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error("Luna's reading was cut off or malformed. Try again or upload fewer pages.");
    }
    const state = parseLunaDocument(payload, data.filename || null);
    return {
      ...state,
      meta: { ...state.meta, storage_path: data.storagePath, mime_type: data.mimeType },
    };
  });
