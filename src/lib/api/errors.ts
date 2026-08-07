/**
 * Global API error handling.
 *
 * Every request funnels failures through {@link ApiError} so the UI can render
 * one consistent, user-friendly message per status code instead of raw
 * transport errors.
 */

import { apiConfig } from "./config";

export type ApiErrorKind =
  | "not_configured"
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "rate_limited"
  | "server"
  | "network"
  | "timeout"
  | "cancelled"
  | "unknown";

const STATUS_MESSAGES: Record<number, string> = {
  400: "That request wasn't valid. Please check the details and try again.",
  401: "Your session has expired. Please sign in again to continue.",
  403: "You don't have permission to do this. Ask an owner or admin for access.",
  404: "We couldn't find what you were looking for. It may have been moved or deleted.",
  409: "This conflicts with existing data. Refresh and try again.",
  422: "Some of the information provided isn't valid. Please review the highlighted fields.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "Something went wrong on our side. Please try again in a moment.",
  502: "The Aislix service is unreachable right now. Please try again shortly.",
  503: "The Aislix service is temporarily unavailable. Please try again shortly.",
  504: "The request took too long to complete. Please try again.",
};

function kindForStatus(status: number): ApiErrorKind {
  switch (status) {
    case 400:
      return "bad_request";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 422:
      return "validation";
    case 429:
      return "rate_limited";
    default:
      return status >= 500 ? "server" : "unknown";
  }
}

/** Message shown for a given HTTP status when the backend sends no detail. */
export function messageForStatus(status: number): string {
  return (
    STATUS_MESSAGES[status] ??
    (status >= 500
      ? STATUS_MESSAGES[500]!
      : "We couldn't complete that request. Please try again.")
  );
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly path: string | undefined;
  /** Raw payload returned by the backend, when it was JSON. */
  readonly body: unknown;
  /** Field-level messages, when the backend sends a validation payload. */
  readonly fieldErrors: Record<string, string> | undefined;

  constructor(options: {
    message: string;
    kind: ApiErrorKind;
    status?: number | null;
    path?: string;
    body?: unknown;
    fieldErrors?: Record<string, string>;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.kind = options.kind;
    this.status = options.status ?? null;
    this.path = options.path;
    this.body = options.body;
    this.fieldErrors = options.fieldErrors;
  }

  /** True when retrying the same request could reasonably succeed. */
  get retryable(): boolean {
    return (
      this.kind === "network" ||
      this.kind === "timeout" ||
      this.kind === "server" ||
      this.kind === "rate_limited"
    );
  }

  /** True when the user needs to authenticate again. */
  get requiresAuth(): boolean {
    return this.kind === "unauthorized";
  }
}

/** Raised before any transport happens when no backend URL is configured. */
export class ApiNotConfiguredError extends ApiError {
  constructor() {
    super({
      message:
        "Backend not connected yet. Set VITE_API_BASE_URL to your Aislix API URL to load live data.",
      kind: "not_configured",
    });
    this.name = "ApiNotConfiguredError";
  }
}

export function assertApiConfigured(): void {
  if (!apiConfig.configured) throw new ApiNotConfiguredError();
}

export function networkError(path?: string): ApiError {
  return new ApiError({
    message: "Network error. Check your connection and try again.",
    kind: "network",
    path,
  });
}

export function timeoutError(path?: string): ApiError {
  return new ApiError({
    message: "The request took too long to respond. Please try again.",
    kind: "timeout",
    path,
  });
}

export function cancelledError(path?: string): ApiError {
  return new ApiError({ message: "Request cancelled.", kind: "cancelled", path });
}

function extractFieldErrors(body: unknown): Record<string, string> | undefined {
  if (!body || typeof body !== "object") return undefined;
  const detail = (body as { detail?: unknown }).detail;
  if (!Array.isArray(detail)) return undefined;
  const fields: Record<string, string> = {};
  for (const entry of detail) {
    if (!entry || typeof entry !== "object") continue;
    const loc = (entry as { loc?: unknown }).loc;
    const msg = (entry as { msg?: unknown }).msg;
    const field = Array.isArray(loc) ? String(loc[loc.length - 1]) : undefined;
    if (field && typeof msg === "string") fields[field] = msg;
  }
  return Object.keys(fields).length ? fields : undefined;
}

function extractMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const candidate =
    (body as { detail?: unknown }).detail ??
    (body as { message?: unknown }).message ??
    (body as { error?: unknown }).error;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}

/** Builds an {@link ApiError} from a failed HTTP response body. */
export function httpError(status: number, body: unknown, path?: string): ApiError {
  return new ApiError({
    message: extractMessage(body) ?? messageForStatus(status),
    kind: kindForStatus(status),
    status,
    path,
    body,
    ...(extractFieldErrors(body) ? { fieldErrors: extractFieldErrors(body)! } : {}),
  });
}

/** Normalizes any thrown value into an {@link ApiError}. */
export function toApiError(error: unknown, path?: string): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof DOMException && error.name === "AbortError") return cancelledError(path);
  if (error instanceof TypeError) return networkError(path);
  const message = error instanceof Error ? error.message : String(error);
  return new ApiError({ message, kind: "unknown", path });
}

/** Message safe to show in toasts, inline alerts and error states. */
export function toUserMessage(error: unknown): string {
  if (error === null || error === undefined) return "Something went wrong. Please try again.";
  return toApiError(error).message;
}
