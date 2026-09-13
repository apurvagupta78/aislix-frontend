// Live Supabase-backed scan submission and status polling.

export const SCAN_ENDPOINT = "/scan";

export const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png"] as const;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Maximum shelf images allowed in a single audit. */
export const MAX_SCAN_IMAGES = 5;

export type ScanAnalysisResult = {
  scan_id: string;
  status: "completed";
  total_products: number;
  out_of_stock_count: number;
  low_stock_count: number;
  misplaced_count: number;
  shelf_health_score: number | null;
  learned_saved?: number;
  learned_error?: string | null;
};

export const SCAN_STAGES = [
  "Uploading Image",
  "Detecting Products",
  "Identifying Brands & SKUs",
  "Measuring Availability & Facings",
  "Analyzing Placement & Compliance",
  "Generating Retail Insights",
  "Preparing Your Results",
] as const;

export type ScanStage = (typeof SCAN_STAGES)[number];

export type ScanResponse = {
  scan_id: string;
  status: string;
  report_url?: string;
  error_message?: string;
};

export function validateScanFile(file: File): string | null {
  const type = file.type?.toLowerCase() ?? "";
  const name = file.name.toLowerCase();
  const extOk = /\.(jpe?g|png)$/.test(name);
  if (!(ACCEPTED_TYPES as readonly string[]).includes(type) && !extOk) {
    return "Unsupported file type. Upload a JPG, JPEG or PNG image.";
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `Image is ${mb} MB. Maximum allowed size is 10 MB.`;
  }
  if (file.size === 0) return "This file appears to be empty. Try capturing again.";
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import type { CategorySelection } from "@/lib/category-selections";
import { dbError, notFound, requireOrgId, requireUserId } from "@/lib/db/context";
import { GENERIC_TIMEOUT, sanitizeUserMessage } from "@/lib/api-errors";


function readImageDimensions(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || typeof Image === "undefined") {
      resolve({});
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({});
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/**
/**
 * Step 1 + 2 of the pipeline: creates one `shelf_scans` row, uploads every
 * image to the `audit-images` bucket and records each as a `scan_images` row.
 * `onUploadProgress` reports 0-100 across all files.
 */
export async function submitScanImages(
  files: File[],
  options: {
    signal?: AbortSignal;
    onUploadProgress?: (percent: number) => void;
    storeId?: string;
    shelfLabel?: string;
    category?: string;
    /** Subcategory id from GET /categories, e.g. "soap". */
    subCategory?: string;
    /** Human label for the subcategory, e.g. "Soap". */
    subCategoryLabel?: string;
    /** Free text shelf description when the user picks "Others". */
    subCategoryCustom?: string;
    /** Every "Category · Subcategory" shelf type visible on this rack. */
    categorySelections?: CategorySelection[];

    notes?: string;
    /** Set when the audit was launched from an assigned task (/my-scans). */
    assignmentId?: string;

    /**
     * Workspace to record the audit in. Assigned audits pass the assignment's
     * org so an invited member never depends on workspace bootstrap.
     */
    orgId?: string;
    /**
     * Optional expected products entered inline on the New Scan page. Stored on
     * the audit and forwarded to the vision backend as `planogram_items`.
     */
    planogramItems?: Array<Record<string, string | number | null>>;
    /** Role + audit package wrapper (preferred over bare planogramItems). */
    planogramPayload?: Record<string, unknown>;
    auditRole?: string;
    /** Follow-up scan linked to a prior audit (fix → rescan → verify). */
    parentScanId?: string;
  } = {},
): Promise<ScanResponse> {
  if (!files.length) throw new Error("Add at least one shelf image to audit.");
  if (files.length > MAX_SCAN_IMAGES) {
    throw new Error(`You can audit up to ${MAX_SCAN_IMAGES} images at a time.`);
  }
  for (const file of files) {
    const invalid = validateScanFile(file);
    if (invalid) throw new Error(invalid);
  }

  const userId = await requireUserId();
  const orgId = options.orgId ?? (await requireOrgId());

  // Plan limits: Free = 5 audits per rolling 24h, paid plans metered monthly.
  // The audits_used counter is incremented by a DB trigger on completion.
  const { assertCanStartScan, hasPlatformBypass, mapLimitError } =
    await import("@/lib/subscription-limits");
  try {
    await assertCanStartScan(orgId);
  } catch (error) {
    const { data } = await supabase.auth.getUser();
    if (!hasPlatformBypass(data.user?.email)) throw error;
  }

  const { data: scan, error: insertError } = await supabase
    .from("shelf_scans")
    .insert({
      org_id: orgId,
      store_id: options.storeId ?? null,
      created_by: userId,
      status: "processing",
      shelf_label: options.shelfLabel ?? null,
      category: options.category ?? null,
      sub_category: options.subCategory ?? null,
      sub_category_label: options.subCategoryLabel ?? null,
      sub_category_custom: options.subCategoryCustom?.trim() || null,
      category_selections: (options.categorySelections ?? []) as unknown as Json,

      notes:
        options.notes?.trim() ||
        options.subCategoryCustom?.trim() ||
        options.subCategoryLabel ||
        null,

      assignment_id: options.assignmentId ?? null,
      adhoc_planogram: options.planogramPayload
        ? (options.planogramPayload as unknown as Json)
        : options.planogramItems?.length
          ? (options.planogramItems as unknown as Json)
          : null,
      parent_scan_id: options.parentScanId ?? null,
      photo_count: files.length,

      processing_started_at: new Date().toISOString(),
    })
    .select("id, status")
    .single();
  if (insertError || !scan) {
    if (insertError) {
      const mapped = await mapLimitError(insertError, orgId);
      if (mapped !== insertError) throw mapped;
    }
    return dbError(insertError, "Could not start the audit.");
  }

  options.onUploadProgress?.(0);

  for (let index = 0; index < files.length; index++) {
    const file = files[index]!;
    if (options.signal?.aborted) {
      await supabase
        .from("shelf_scans")
        .update({ status: "failed", error_message: "Audit cancelled before analysis." })
        .eq("id", scan.id);
      throw new DOMException("Audit cancelled", "AbortError");
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const storagePath = `${orgId}/${scan.id}/${Date.now()}-${index}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("scan-images")
      .upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      await supabase
        .from("shelf_scans")
        .update({ status: "failed", error_message: sanitizeUserMessage(uploadError.message) })
        .eq("id", scan.id);
      return dbError(uploadError, "Could not upload the shelf image.");
    }

    const dimensions = await readImageDimensions(file);
    const { error: imageError } = await supabase.from("scan_images").insert({
      scan_id: scan.id,
      kind: "original",
      storage_bucket: "scan-images",
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size_bytes: file.size,
      width: dimensions.width ?? null,
      height: dimensions.height ?? null,
    });
    if (imageError) {
      await supabase
        .from("shelf_scans")
        .update({ status: "failed", error_message: sanitizeUserMessage(imageError.message) })
        .eq("id", scan.id);
      return dbError(imageError, "Could not record the uploaded image.");
    }

    options.onUploadProgress?.(Math.round(((index + 1) / files.length) * 100));
  }

  // No manual usage increment: the database trigger counts the audit once it
  // reaches "completed".

  return { scan_id: scan.id as string, status: scan.status as string };
}

/** Single-image convenience wrapper kept for existing callers. */
export async function submitScan(
  file: File,
  options: {
    signal?: AbortSignal;
    onUploadProgress?: (percent: number) => void;
    storeId?: string;
  } = {},
): Promise<ScanResponse> {
  return submitScanImages([file], options);
}

/**
 * Steps 3-6: submits the uploaded images to the Railway FastAPI vision backend
 * and then polls with short requests (every 5s, up to 10 minutes) so no single
 * server request blocks for minutes. Resolves once the audit is `completed`.
 */
const ANALYSIS_POLL_INTERVAL_MS = 5_000;
const ANALYSIS_MAX_WAIT_MS = 600_000;

function reportLearnedCatalogIssue(result: ScanAnalysisResult): ScanAnalysisResult {
  if (result?.learned_error) {
    void import("sonner").then(({ toast }) =>
      toast.error(`Failed to save learned products: ${result.learned_error}`),
    );
  }
  return result;
}

export async function runScanAnalysis(scanId: string): Promise<ScanAnalysisResult> {
  const { startScanPipeline, pollScanPipeline } = await import("@/lib/scan-pipeline.functions");
  try {
    const started = (await startScanPipeline({ data: { scanId } })) as any;
    if (started?.status === "completed")
      return reportLearnedCatalogIssue(started as ScanAnalysisResult);

    const jobId: string | null = started?.job_id ?? null;
    const deadline = Date.now() + ANALYSIS_MAX_WAIT_MS;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, ANALYSIS_POLL_INTERVAL_MS));
      const poll = (await pollScanPipeline({ data: { scanId, jobId } })) as any;
      if (poll?.status === "completed")
        return reportLearnedCatalogIssue(poll as ScanAnalysisResult);
    }

    throw new Error(GENERIC_TIMEOUT);
  } catch (error) {
    throw new Error(cleanPipelineMessage(error));
  }
}

/** Re-runs the pipeline for an audit that previously failed. */
export async function retryScanAnalysis(scanId: string): Promise<ScanAnalysisResult> {
  return runScanAnalysis(scanId);
}

function cleanPipelineMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "The audit could not be completed.";
  const message = raw.replace(/^Error:\s*/i, "").trim();
  if (/unauthorized/i.test(message)) return "Your session expired. Please sign in again.";
  return sanitizeUserMessage(message);
}

/** Polls the current status of a shelf audit. */
export async function fetchScanStatus(
  scanId: string,
  _signal?: AbortSignal,
): Promise<ScanResponse> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("shelf_scans")
    .select("id, status, error_message")
    .eq("org_id", orgId)
    .eq("id", scanId)
    .maybeSingle();
  if (error) return dbError(error, "Could not load audit status.");
  if (!data) notFound("Audit not found.");
  return {
    scan_id: data.id as string,
    status: data.status as string,
    ...(data.error_message
      ? { error_message: sanitizeUserMessage(data.error_message as string) }
      : {}),
  };
}
