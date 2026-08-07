/**
 * The single API client for the whole app.
 *
 * Every backend call in Aislix goes through this module — no page, component or
 * service file calls `fetch()` directly. Swapping in Railway FastAPI or routing
 * requests through Supabase later only touches this file.
 */

import { apiConfig, apiUrl, buildQuery } from "./config";
import {
  ApiError,
  assertApiConfigured,
  cancelledError,
  httpError,
  timeoutError,
  toApiError,
} from "./errors";

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export type RequestOptions = {
  query?: QueryParams;
  signal?: AbortSignal | undefined;
  headers?: Record<string, string>;
  /** Overrides {@link ApiConfig.timeoutMs} for this request. */
  timeoutMs?: number;
  /** Skips the Authorization header (used by public endpoints). */
  anonymous?: boolean;
};

/* ------------------------------ auth token ------------------------------- */

type TokenProvider = () => string | null | Promise<string | null>;

let tokenProvider: TokenProvider | null = null;
let unauthorizedHandler: (() => void) | null = null;

/**
 * Registers the access-token source. Supabase will provide this later:
 * `setAuthTokenProvider(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null)`
 */
export function setAuthTokenProvider(provider: TokenProvider | null): void {
  tokenProvider = provider;
}

/** Called once whenever the backend answers 401, so the app can sign out. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

async function authHeader(): Promise<Record<string, string>> {
  if (!tokenProvider) return {};
  const token = await tokenProvider();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ------------------------------- transport ------------------------------- */

function mergeSignals(
  external: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; done: () => void; timedOut: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  external?.addEventListener("abort", onAbort, { once: true });
  if (external?.aborted) controller.abort();
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", onAbort);
    },
    timedOut: () => timedOut,
  };
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined;
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return response.json().catch(() => null);
  const text = await response.text().catch(() => "");
  return text || undefined;
}

async function send<T>(
  path: string,
  init: RequestInit,
  options: RequestOptions = {},
): Promise<T> {
  assertApiConfigured();
  const url = apiUrl(path) + buildQuery(options.query ?? {});
  const timeout = mergeSignals(options.signal, options.timeoutMs ?? apiConfig.timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: timeout.signal,
      headers: {
        Accept: "application/json",
        ...(options.anonymous ? {} : await authHeader()),
        ...(init.headers as Record<string, string> | undefined),
        ...(options.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await parseBody(response);
      const error = httpError(response.status, body, path);
      if (error.requiresAuth) unauthorizedHandler?.();
      throw error;
    }

    return (await parseBody(response)) as T;
  } catch (error) {
    if (timeout.timedOut()) throw timeoutError(path);
    if (options.signal?.aborted) throw cancelledError(path);
    const normalized = toApiError(error, path);
    if (apiConfig.debug && normalized.kind !== "cancelled") {
      console.warn(`[api] ${init.method ?? "GET"} ${path} failed: ${normalized.message}`);
    }
    throw normalized;
  } finally {
    timeout.done();
  }
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
  };
}

/* --------------------------------- api ---------------------------------- */

export const api = {
  config: apiConfig,

  get: <T>(path: string, options?: RequestOptions) => send<T>(path, { method: "GET" }, options),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    send<T>(path, jsonInit("POST", body), options),

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    send<T>(path, jsonInit("PUT", body), options),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    send<T>(path, jsonInit("PATCH", body), options),

  delete: <T = void>(path: string, options?: RequestOptions) =>
    send<T>(path, { method: "DELETE" }, options),

  /** Multipart POST without progress reporting. */
  postForm: <T>(path: string, form: FormData, options?: RequestOptions) =>
    send<T>(path, { method: "POST", body: form }, { timeoutMs: apiConfig.uploadTimeoutMs, ...options }),

  /**
   * Multipart POST with upload progress (0-100). Uses XHR because `fetch` has
   * no upload-progress events.
   */
  upload<T>(
    path: string,
    form: FormData,
    options: {
      signal?: AbortSignal | undefined;
      onProgress?: ((percent: number) => void) | undefined;
      timeoutMs?: number;
      method?: "POST" | "PUT";
    } = {},
  ): Promise<T> {
    assertApiConfigured();
    const url = apiUrl(path);
    const { signal, onProgress, method = "POST" } = options;

    return new Promise<T>((resolve, reject) => {
      void (async () => {
        const headers = await authHeader();
        const xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.responseType = "json";
        xhr.timeout = options.timeoutMs ?? apiConfig.uploadTimeoutMs;
        xhr.setRequestHeader("Accept", "application/json");
        for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve((xhr.response ?? undefined) as T);
            return;
          }
          const error = httpError(xhr.status, xhr.response, path);
          if (error.requiresAuth) unauthorizedHandler?.();
          reject(error);
        };
        xhr.onerror = () =>
          reject(new ApiError({ message: "Network error. Check your connection and try again.", kind: "network", path }));
        xhr.ontimeout = () => reject(timeoutError(path));
        xhr.onabort = () => reject(cancelledError(path));

        signal?.addEventListener("abort", () => xhr.abort(), { once: true });
        xhr.send(form);
      })();
    });
  },
};

export type ApiClient = typeof api;
