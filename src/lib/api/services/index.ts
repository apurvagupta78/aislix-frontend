/**
 * Domain service modules.
 *
 * Each file below owns the endpoints for one area of the product and calls the
 * centralized client in `../client`. Pages import these namespaces (or the
 * existing module paths, which re-export from them) and never call `fetch()`.
 */

export * as authService from "./auth";
export * as dashboardService from "./dashboard";
export * as auditsService from "./audits";
export * as scanHistoryService from "./audit-history";
export * as reportsService from "./reports";
export * as storesService from "./stores";
export * as organizationService from "./organization";
export * as usersService from "./users";
export * as billingService from "./billing";
export * as contactService from "./contact";
export * as profileService from "./profile";
export * as settingsService from "./settings";
