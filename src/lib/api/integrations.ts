/**
 * Future integration surfaces — interfaces only, nothing implemented.
 *
 * Each block documents where the real client will live so the wiring is a
 * single-file change per provider.
 */

import { apiConfig } from "./config";

/* -------------------------------- Supabase -------------------------------- */

/**
 * Supabase (auth, storage, Postgres).
 *
 * When Lovable Cloud / Supabase is enabled, the generated client goes here and
 * `setAuthTokenProvider` in `./client` is pointed at the live session. Nothing
 * else in the app changes.
 */
export type SupabaseIntegration = {
  /** Returns the current access token, or null when signed out. */
  getAccessToken(): Promise<string | null>;
  /** Uploads a file to a storage bucket and returns its public URL. */
  uploadToBucket(bucket: string, path: string, file: File): Promise<{ url: string }>;
  /** Subscribes to auth-state changes; returns an unsubscribe function. */
  onAuthStateChange(listener: (signedIn: boolean) => void): () => void;
};

export const supabaseIntegration: SupabaseIntegration | null = null;

/* ----------------------------- Railway FastAPI ---------------------------- */

/**
 * Railway FastAPI is the primary data backend and is reached through the
 * centralized client (`./client`) using {@link apiConfig.baseUrl}. This type
 * only documents the service-level contract.
 */
export type RailwayIntegration = {
  baseUrl: string;
  environment: typeof apiConfig.environment;
  /** GET /health — readiness probe used by status indicators. */
  healthPath: "/health";
};

export const railwayIntegration: RailwayIntegration = {
  baseUrl: apiConfig.baseUrl,
  environment: apiConfig.environment,
  healthPath: "/health",
};

/* -------------------------------- Cashfree -------------------------------- */

/**
 * Cashfree checkout. Orders are always created server-side (FastAPI) — the
 * frontend only receives a session id and opens the hosted checkout, so no keys
 * ever reach the browser.
 */
export type CashfreeIntegration = {
  /** POST /billing/checkout — server creates the order, returns a session. */
  createCheckoutSession(input: {
    plan_id: string;
    billing_cycle: "monthly" | "annual";
  }): Promise<{ payment_session_id: string; order_id: string; checkout_url?: string }>;
  /** Opens the hosted checkout for a session id. */
  openCheckout(paymentSessionId: string): Promise<void>;
  /** POST /api/public/webhooks/cashfree — verified server-side, not here. */
  webhookPath: "/webhooks/cashfree";
};

export const cashfreeIntegration: CashfreeIntegration | null = null;

/* ------------------------------ Email service ----------------------------- */

/**
 * Transactional email (contact form, invites, invoices, password resets).
 * Sending always happens server-side; the frontend only submits payloads.
 */
export type EmailIntegration = {
  /** POST /contact/enquiries — routed to the sales inbox. */
  sendEnquiry(input: { email: string; subject: string; message: string }): Promise<{ id: string }>;
  /** POST /users/invite — server sends the invitation email. */
  sendInvite(input: { email: string; role: string }): Promise<{ id: string }>;
  fromAddress: string;
};

export const emailIntegration: EmailIntegration | null = null;

/** True when a provider is wired; UI can use this to disable actions cleanly. */
export const integrationStatus = {
  supabase: supabaseIntegration !== null,
  railway: apiConfig.configured,
  cashfree: cashfreeIntegration !== null,
  email: emailIntegration !== null,
} as const;
