import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { requireOrgId } from "@/lib/db/context";
import { AISLIX_PALETTE, ACCENT_TINT } from "@/lib/ai-audit/kpi-palette";
import type { ReferenceDocumentState } from "@/lib/ai-audit/reference-document";
import {
  buildPipelineState,
  headerKey,
  readPipelinePages,
  tablesNeedingColumnHelp,
  type ColumnHint,
  type DocumentJobStatus,
  type PipelineResult,
} from "@/lib/document-pipeline";
import {
  getDocumentPipeline,
  mapDocumentColumns,
  readDocumentPageWithLuna,
  startDocumentPipeline,
} from "@/lib/document-pipeline.functions";
import { readReferenceDocument, REFERENCE_DOCUMENT_BUCKET } from "@/lib/reference-document.functions";

export const DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const DOCUMENT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf,.csv,.xlsx,.xls,text/csv";
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const MAX_PDF_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_LUNA_PAGES = 60;
const LUNA_CONCURRENCY = 3;
const POLL_MS = 1500;
const MAX_WAIT_MS = 30 * 60 * 1000;
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

export type DocumentReader = {
  readDocument: ReturnType<typeof useServerFn<typeof readReferenceDocument>>;
  start: ReturnType<typeof useServerFn<typeof startDocumentPipeline>>;
  status: ReturnType<typeof useServerFn<typeof getDocumentPipeline>>;
  readPage: ReturnType<typeof useServerFn<typeof readDocumentPageWithLuna>>;
  mapColumns: ReturnType<typeof useServerFn<typeof mapDocumentColumns>>;
};

export function useDocumentReader(): DocumentReader {
  return {
    readDocument: useServerFn(readReferenceDocument),
    start: useServerFn(startDocumentPipeline),
    status: useServerFn(getDocumentPipeline),
    readPage: useServerFn(readDocumentPageWithLuna),
    mapColumns: useServerFn(mapDocumentColumns),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function progressText(job: DocumentJobStatus): string {
  if (job.stage === "text" && job.pages_total) return `Reading page ${job.pages_done} of ${job.pages_total}…`;
  if (job.stage === "ocr") return `Reading ${job.ocr_pages || "the"} scanned page${job.ocr_pages === 1 ? "" : "s"}…`;
  return "Opening your document…";
}

async function waitForPipeline(
  reader: DocumentReader,
  jobId: string,
  onProgress?: (text: string | null) => void,
): Promise<PipelineResult> {
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const job = await reader.status({ data: { jobId } });
    if (job.status === "failed") throw new Error(job.error || "Could not read this document.");
    if (job.status === "completed" && job.result) return job.result;
    onProgress?.(progressText(job));
    await sleep(POLL_MS);
  }
  throw new Error("Reading this document took too long. Try splitting it into smaller files.");
}

async function readWithPipeline(
  reader: DocumentReader,
  jobId: string,
  file: { name: string; category?: string | null; subCategory?: string | null },
  onProgress?: (text: string | null) => void,
): Promise<ReferenceDocumentState> {
  const result = await waitForPipeline(reader, jobId, onProgress);

  const hints: Record<string, ColumnHint> = {};
  for (const table of tablesNeedingColumnHelp(result)) {
    onProgress?.("Matching document columns…");
    const hint = await reader.mapColumns({ data: table }).catch(() => ({}));
    hints[headerKey(table.headers)] = hint;
  }

  const pages = readPipelinePages(result, hints);
  const flagged = pages.filter((p) => p.flag).map((p) => p.page);
  const toRead = flagged.slice(0, MAX_LUNA_PAGES);
  const unreadPages = flagged.slice(MAX_LUNA_PAGES);
  const lunaPages = new Map<number, ReferenceDocumentState>();
  let done = 0;
  const queue = [...toRead];
  const worker = async () => {
    for (let page = queue.shift(); page !== undefined; page = queue.shift()) {
      onProgress?.(
        toRead.length === 1 && result.pages_total === 1
          ? "AI is reading every line of your document — this can take up to a minute."
          : `AI is double-checking ${toRead.length} page${toRead.length === 1 ? "" : "s"} (${done} done)…`,
      );
      try {
        const state = await reader.readPage({
          data: {
            jobId,
            page,
            filename: file.name,
            category: file.category,
            subCategories: file.subCategory ? [file.subCategory] : [],
          },
        });
        lunaPages.set(page, state);
      } catch {
        if (!pages.find((p) => p.page === page)?.rows.length) unreadPages.push(page);
      }
      done += 1;
    }
  };
  await Promise.all(Array.from({ length: Math.min(LUNA_CONCURRENCY, toRead.length) }, worker));

  return buildPipelineState({
    result,
    pages,
    lunaPages,
    unreadPages: unreadPages.sort((a, b) => a - b),
    filename: file.name,
  });
}

/**
 * Upload a photo or PDF to storage and read its lines page by page: digital pages from the
 * PDF text layer, scanned pages through OCR, and Luna only for pages that fail the checks.
 * Falls back to a single Luna reading when the page pipeline is not available.
 */
export async function uploadAndReadDocument(
  file: File,
  reader: DocumentReader,
  opts: {
    category?: string | null;
    subCategory?: string | null;
    onStage?: (stage: "upload" | "read") => void;
    onProgress?: (text: string | null) => void;
  } = {},
): Promise<ReferenceDocumentState> {
  if (!DOCUMENT_TYPES.includes(file.type)) {
    throw new Error("Upload a photo (JPG, PNG, WebP), a PDF, or a CSV / Excel file.");
  }
  opts.onStage?.("upload");
  opts.onProgress?.(null);
  const prepared = await prepareImage(file);
  const isPdf = prepared.type === "application/pdf";
  const limit = isPdf ? MAX_PDF_UPLOAD_BYTES : MAX_UPLOAD_BYTES;
  if (prepared.size > limit) throw new Error(`File is larger than ${limit / (1024 * 1024)} MB.`);
  const orgId = await requireOrgId();
  const ext = prepared.name.includes(".") ? prepared.name.split(".").pop() : "jpg";
  const storagePath = `${orgId}/reference-documents/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(REFERENCE_DOCUMENT_BUCKET)
    .upload(storagePath, prepared, { contentType: prepared.type, upsert: false });
  if (uploadError) throw new Error("Could not upload the document. Please try again.");

  opts.onStage?.("read");
  const request = {
    storagePath,
    mimeType: prepared.type,
    filename: file.name,
    category: opts.category,
    subCategories: opts.subCategory ? [opts.subCategory] : [],
  };
  opts.onProgress?.("Opening your document…");
  try {
    const started = await reader.start({ data: request }).catch(() => ({ available: false as const }));
    const state = started.available
      ? await readWithPipeline(
          reader,
          started.jobId,
          { name: file.name, category: opts.category, subCategory: opts.subCategory },
          opts.onProgress,
        )
      : await (async () => {
          if (prepared.size > MAX_UPLOAD_BYTES) {
            throw new Error("Large documents can't be read right now. Please try again in a few minutes.");
          }
          opts.onProgress?.(null);
          return reader.readDocument({ data: request });
        })();
    return { ...state, meta: { ...state.meta, storage_path: storagePath, mime_type: prepared.type } };
  } finally {
    opts.onProgress?.(null);
  }
}

export function DocumentBusyBanner({ stage, detail }: { stage: "upload" | "read" | "csv"; detail?: string | null }) {
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
          ? detail || "Reading every line of your document…"
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
