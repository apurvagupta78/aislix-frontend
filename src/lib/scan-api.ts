// Live Supabase-backed scan submission and status polling.

export const SCAN_ENDPOINT = "/scan";

export const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png"] as const;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const SCAN_STAGES = [
  "Uploading Image",
  "Detecting Products",
  "Identifying Brands & Variants",
  "Counting Inventory",
  "Generating AI Recommendations",
  "Creating PDF Report",
] as const;

export type ScanStage = (typeof SCAN_STAGES)[number];

export type ScanResponse = {
  scan_id: string;
  status: string;
  report_url?: string;
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

import { supabase } from "@/integrations/supabase/client";
import { dbError, notFound, requireOrgId, requireUserId } from "@/lib/db/context";

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
 * Creates a shelf_scans row, uploads the image to storage and records it as a
 * scan_images row. `onUploadProgress` reports 0-100 for the upload phase only.
 */
export async function submitScan(
  file: File,
  options: {
    signal?: AbortSignal;
    onUploadProgress?: (percent: number) => void;
    storeId?: string;
  } = {},
): Promise<ScanResponse> {
  const invalid = validateScanFile(file);
  if (invalid) throw new Error(invalid);

  const userId = await requireUserId();
  const orgId = await requireOrgId();

  const { data: scan, error: insertError } = await supabase
    .from("shelf_scans")
    .insert({
      org_id: orgId,
      store_id: options.storeId ?? null,
      created_by: userId,
      status: "queued",
    })
    .select("id, status")
    .single();
  if (insertError || !scan) return dbError(insertError, "Could not start the scan.");

  options.onUploadProgress?.(0);

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const filename = `${Date.now()}.${ext}`;
  const storagePath = `${orgId}/${scan.id}/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from("scan-images")
    .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });

  if (uploadError) {
    await supabase.from("shelf_scans").update({ status: "failed", error_message: uploadError.message }).eq("id", scan.id);
    return dbError(uploadError, "Could not upload the shelf image.");
  }

  options.onUploadProgress?.(100);

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
  if (imageError) return dbError(imageError, "Could not record the uploaded image.");

  return { scan_id: scan.id as string, status: scan.status as string };
}

/** Polls the current status of a shelf scan. */
export async function fetchScanStatus(scanId: string, _signal?: AbortSignal): Promise<ScanResponse> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("shelf_scans")
    .select("id, status")
    .eq("org_id", orgId)
    .eq("id", scanId)
    .maybeSingle();
  if (error) return dbError(error, "Could not load scan status.");
  if (!data) notFound("Scan not found.");
  return { scan_id: data.id as string, status: data.status as string };
}
