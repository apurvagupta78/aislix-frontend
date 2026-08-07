/**
 * Async state helpers.
 *
 * Every API-backed view renders four states: loading, empty, error, success.
 * These helpers derive that state from a TanStack Query result so pages keep
 * using the existing `Loading` / `EmptyState` / `ErrorState` components.
 */

import { toApiError, toUserMessage } from "./errors";

export type AsyncStatus = "loading" | "empty" | "error" | "success";

export type AsyncState<T> = {
  status: AsyncStatus;
  data: T | undefined;
  /** User-friendly message, present when `status === "error"`. */
  error: string | null;
  isLoading: boolean;
  isEmpty: boolean;
  isError: boolean;
  isSuccess: boolean;
  /** True when a retry button should be offered. */
  retryable: boolean;
};

type QueryLike<T> = {
  data: T | undefined;
  error: unknown;
  isPending: boolean;
  isFetching?: boolean;
};

function defaultIsEmpty(data: unknown): boolean {
  if (data === undefined || data === null) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === "object") return Object.keys(data as object).length === 0;
  return false;
}

/** Derives the four-state view model from a query result. */
export function asyncStateOf<T>(
  query: QueryLike<T>,
  isEmpty: (data: T) => boolean = defaultIsEmpty,
): AsyncState<T> {
  const base = {
    data: query.data,
    isLoading: false,
    isEmpty: false,
    isError: false,
    isSuccess: false,
    retryable: false,
  };

  if (query.error) {
    const apiError = toApiError(query.error);
    return {
      ...base,
      status: "error",
      error: apiError.message,
      isError: true,
      retryable: apiError.retryable,
    };
  }
  if (query.isPending) {
    return { ...base, status: "loading", error: null, isLoading: true };
  }
  if (query.data === undefined || isEmpty(query.data)) {
    return { ...base, status: "empty", error: null, isEmpty: true };
  }
  return { ...base, status: "success", error: null, isSuccess: true };
}

/** Same message pipeline for mutations, which have no empty state. */
export function mutationErrorMessage(error: unknown): string | null {
  return error ? toUserMessage(error) : null;
}
