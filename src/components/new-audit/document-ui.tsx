import { Check, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { requireOrgId } from "@/lib/db/context";
import { AISLIX_PALETTE, ACCENT_TINT } from "@/lib/ai-audit/kpi-palette";
import type { ReferenceDocumentState } from "@/lib/ai-audit/reference-document";
import { REFERENCE_DOCUMENT_BUCKET } from "@/lib/reference-document.functions";

export const DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const DOCUMENT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf,.csv,.xlsx,.xls,text/csv";
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2400;
const MIN_IMAGE_EDGE = 1600;

export const CELL_INPUT =
  "w-full rounded-md border px-1.5 py-1 text-xs text-[#102A43] outline-none transition-shadow focus:bg-white focus:shadow-[0_0_0_2px_#7DB7D6]";

export function isSpreadsheet(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls") || file.type === "text/csv";
}

/**
 * Phone photos are downsized before upload. Small scans and screenshots are enlarged so
 * the vision model gets enough detail on small printed digits.
 */
export async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const longEdge = Math.max(bitmap.width, bitmap.height);
  const scale =
    longEdge < MIN_IMAGE_EDGE ? MIN_IMAGE_EDGE / longEdge : Math.min(1, MAX_IMAGE_EDGE / longEdge);
  if (scale === 1 && file.size <= 3 * 1024 * 1024) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

type ReadDocumentFn = (args: {
  data: {
    storagePath: string;
    mimeType: string;
    filename: string;
    category?: string | null;
    subCategories?: string[];
  };
}) => Promise<ReferenceDocumentState>;

/** Upload a photo or PDF to storage and let AI read its lines. */
export async function uploadAndReadDocument(
  file: File,
  readDocument: ReadDocumentFn,
  opts: {
    category?: string | null;
    subCategory?: string | null;
    onStage?: (stage: "upload" | "read") => void;
  } = {},
): Promise<ReferenceDocumentState> {
  if (!DOCUMENT_TYPES.includes(file.type)) {
    throw new Error("Upload a photo (JPG, PNG, WebP), a PDF, or a CSV / Excel file.");
  }
  opts.onStage?.("upload");
  const prepared = await prepareImage(file);
  if (prepared.size > MAX_UPLOAD_BYTES) throw new Error("File is larger than 12 MB.");
  const orgId = await requireOrgId();
  const ext = prepared.name.includes(".") ? prepared.name.split(".").pop() : "jpg";
  const storagePath = `${orgId}/reference-documents/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(REFERENCE_DOCUMENT_BUCKET)
    .upload(storagePath, prepared, { contentType: prepared.type, upsert: false });
  if (uploadError) throw new Error("Could not upload the document. Please try again.");

  opts.onStage?.("read");
  return readDocument({
    data: {
      storagePath,
      mimeType: prepared.type,
      filename: file.name,
      category: opts.category,
      subCategories: opts.subCategory ? [opts.subCategory] : [],
    },
  });
}

export function DocumentBusyBanner({ stage }: { stage: "upload" | "read" | "csv" }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-[#102A43]"
      style={{ background: ACCENT_TINT.blue, borderColor: AISLIX_PALETTE.blue }}
      role="status"
    >
      <Loader2 className="size-4 animate-spin" />
      {stage === "upload"
        ? "Uploading document…"
        : stage === "read"
          ? "AI is reading every line of your document — this can take up to a minute."
          : "Reading your file…"}
    </div>
  );
}

export function DocumentErrorBanner({ message }: { message: string }) {
  return (
    <p
      className="rounded-xl border px-4 py-3 text-sm text-[#102A43]"
      style={{ background: AISLIX_PALETTE.pink, borderColor: "#F6CFDC" }}
      role="alert"
    >
      {message}
    </p>
  );
}

export function DocumentSaveBar({
  unsaved,
  unsavedText,
  savedText,
  onSave,
}: {
  unsaved: boolean;
  unsavedText: string;
  savedText: string;
  onSave: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
      style={
        unsaved
          ? { background: ACCENT_TINT.blue, borderColor: AISLIX_PALETTE.blue }
          : { background: "#F4F7F9", borderColor: AISLIX_PALETTE.border }
      }
    >
      <p className="text-xs text-[#102A43]">{unsaved ? unsavedText : savedText}</p>
      <Button type="button" variant={unsaved ? "brand" : "outline"} size="sm" disabled={!unsaved} onClick={onSave}>
        {unsaved ? <Save className="size-3.5" /> : <Check className="size-3.5" />}
        {unsaved ? "Save changes" : "Saved"}
      </Button>
    </div>
  );
}
