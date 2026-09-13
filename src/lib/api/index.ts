/**
 * Centralized API layer.
 *
 * Import from here (or from a specific service module) — never call `fetch()`
 * from a page or component.
 *
 *   import { api, toUserMessage, asyncStateOf } from "@/lib/api";
 *   import { usersService } from "@/lib/api/services";
 */

export { api, setAuthTokenProvider, setUnauthorizedHandler } from "./client";
export type { ApiClient, RequestOptions, QueryParams } from "./client";

export { apiConfig, apiUrl, buildQuery } from "./config";
export type { ApiConfig, AppEnvironment } from "./config";

export {
  ApiError,
  ApiNotConfiguredError,
  assertApiConfigured,
  messageForStatus,
  toApiError,
  toUserMessage,
} from "./errors";
export type { ApiErrorKind } from "./errors";

export { asyncStateOf, mutationErrorMessage } from "./async-state";
export type { AsyncState, AsyncStatus } from "./async-state";

export * from "./uploads";
export * from "./integrations";

export * as authService from "./auth";
export {
  billingService,
  contactService,
  dashboardService,
  organizationService,
  profileService,
  reportsService,
  scanHistoryService,
  auditsService,
  settingsService,
  storesService,
  usersService,
} from "./services";
