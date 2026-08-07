/**
 * Backwards-compatible shim.
 *
 * The real configuration now lives in `src/lib/api/config.ts` and all requests
 * go through `src/lib/api/client.ts`. This file only re-exports so existing
 * imports keep working.
 */
export { apiConfig } from "./api/config";
export { ApiError, ApiNotConfiguredError, assertApiConfigured, toUserMessage } from "./api/errors";

import { apiConfig } from "./api/config";

/** @deprecated use `apiConfig.baseUrl` */
export const API_BASE = apiConfig.baseUrl;
/** @deprecated use `apiConfig.configured` */
export const apiConfigured = apiConfig.configured;
