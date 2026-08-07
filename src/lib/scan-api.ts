// Thin client for the future FastAPI backend. Only the transport lives here —
// the UI owns upload/progress/success/error state so wiring the real endpoint
// requires no redesign.

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

import { API_BASE, assertApiConfigured } from "./api-config";

/**
 * POST /scan — multipart upload of a single shelf image.
 * `onUploadProgress` reports 0-100 for the upload phase only.
 */
export function submitScan(
  file: File,
  options: {
    signal?: AbortSignal;
    onUploadProgress?: (percent: number) => void;
  } = {},
): Promise<ScanResponse> {
  const { signal, onUploadProgress } = options;
  const url = `${API_BASE}${SCAN_ENDPOINT}`;

  return new Promise<ScanResponse>((resolve, reject) => {
    const form = new FormData();
    form.append("image", file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onUploadProgress) {
        onUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve((xhr.response ?? { scan_id: "", status: "completed" }) as ScanResponse);
      } else {
        reject(new Error(readError(xhr) ?? `Scan failed (HTTP ${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error. Check your connection and try again."));
    xhr.ontimeout = () => reject(new Error("The scan request timed out. Please try again."));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));

    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

function readError(xhr: XMLHttpRequest): string | null {
  const body = xhr.response as { detail?: unknown; message?: unknown } | null;
  const detail = body?.detail ?? body?.message;
  return typeof detail === "string" ? detail : null;
}
