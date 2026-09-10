/**
 * Upload service — single image, multiple images and mobile camera capture.
 *
 * The backend endpoints are placeholders; the state machine below is what the
 * UI binds to, so progress, processing, success and failure all render without
 * any redesign when the real endpoint lands.
 */

import { api } from "./client";
import { toUserMessage } from "./errors";

export const UPLOAD_ENDPOINTS = {
  /** POST /scan — single shelf image (multipart). */
  single: "/scan",
  /** POST /scan/batch — multiple shelf images in one request. */
  multiple: "/scan/batch",
  /** POST /uploads/images — generic image storage (avatars, store photos). */
  images: "/uploads/images",
} as const;

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_BATCH_FILES = 10;

export type UploadPhase = "idle" | "uploading" | "processing" | "success" | "error";

export type UploadState = {
  phase: UploadPhase;
  /** 0-100 for the transfer phase only. */
  progress: number;
  /** Human-readable status line, safe to render as-is. */
  status: string;
  error: string | null;
};

export const idleUpload: UploadState = {
  phase: "idle",
  progress: 0,
  status: "",
  error: null,
};

export const uploadingState = (progress: number): UploadState => ({
  phase: "uploading",
  progress,
  status: progress >= 100 ? "Upload complete — starting analysis…" : `Uploading… ${progress}%`,
  error: null,
});

export const processingState = (status = "Analyzing retail image…"): UploadState => ({
  phase: "processing",
  progress: 100,
  status,
  error: null,
});

export const successState = (status = "Upload complete."): UploadState => ({
  phase: "success",
  progress: 100,
  status,
  error: null,
});

export const failureState = (error: unknown): UploadState => ({
  phase: "error",
  progress: 0,
  status: "",
  error: toUserMessage(error),
});

/** Validates one image before it is sent. Returns an error message or null. */
export function validateImage(file: File): string | null {
  const type = file.type?.toLowerCase() ?? "";
  const extOk = /\.(jpe?g|png|webp)$/.test(file.name.toLowerCase());
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type) && !extOk) {
    return "Unsupported file type. Upload a JPG, JPEG or PNG image.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `Image is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maximum allowed size is 10 MB.`;
  }
  if (file.size === 0) return "This file appears to be empty. Try capturing again.";
  return null;
}

export function validateImages(files: File[]): string | null {
  if (!files.length) return "Select at least one image to upload.";
  if (files.length > MAX_BATCH_FILES) return `Upload up to ${MAX_BATCH_FILES} images at a time.`;
  for (const file of files) {
    const error = validateImage(file);
    if (error) return error;
  }
  return null;
}

export type UploadOptions = {
  signal?: AbortSignal | undefined;
  onProgress?: ((percent: number) => void) | undefined;
  /** Extra multipart fields, e.g. `{ store_id }`. */
  fields?: Record<string, string | number | undefined>;
};

function toForm(
  files: File | File[],
  field: string,
  fields?: Record<string, string | number | undefined>,
): FormData {
  const form = new FormData();
  const list = Array.isArray(files) ? files : [files];
  for (const file of list) form.append(field, file, file.name);
  for (const [key, value] of Object.entries(fields ?? {})) {
    if (value !== undefined) form.append(key, String(value));
  }
  return form;
}

/** POST /scan — one image, progress-reported. */
export function uploadSingleImage<T>(
  file: File,
  options: UploadOptions = {},
  endpoint: string = UPLOAD_ENDPOINTS.single,
): Promise<T> {
  return api.upload<T>(endpoint, toForm(file, "image", options.fields), options);
}

/** POST /scan/batch — several images in one request. */
export function uploadMultipleImages<T>(
  files: File[],
  options: UploadOptions = {},
  endpoint: string = UPLOAD_ENDPOINTS.multiple,
): Promise<T> {
  return api.upload<T>(endpoint, toForm(files, "images", options.fields), options);
}

/**
 * Mobile camera capture. The file already comes from `<input capture>`, so this
 * is the single-image path tagged with its source for backend analytics.
 */
export function uploadCameraCapture<T>(
  file: File,
  options: UploadOptions = {},
  endpoint: string = UPLOAD_ENDPOINTS.single,
): Promise<T> {
  return uploadSingleImage<T>(
    file,
    { ...options, fields: { ...(options.fields ?? {}), source: "camera" } },
    endpoint,
  );
}

/** Attributes for a camera-capture file input (rear camera on mobile). */
export const cameraInputProps = {
  type: "file" as const,
  accept: "image/*",
  capture: "environment" as const,
};
