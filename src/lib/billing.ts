// Backend contract for billing. Bindings target the future FastAPI service on
// Railway (subscription + usage) with Cashfree for checkout and Supabase for
// auth/profiles. No dummy data and no payment processing is implemented here.

import type { BillingCycle, PlanId } from "@/lib/pricing";

import { api } from "./api/client";

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "cancelled" | "paused";

export type PaymentMethod = {
  id: string;
  brand?: string; // e.g. "HDFC Visa", "UPI"
  label?: string; // masked identifier, e.g. "•••• 4218"
  expiry?: string; // MM / YYYY
  type?: "card" | "upi" | "netbanking" | "mandate";
};

export type UsageSummary = {
  period_start?: string;
  period_end?: string;
  scans_used: number;
  scans_included: number | null; // null = unlimited
  products_detected?: number;
  average_confidence?: number; // 0-1 or 0-100
  average_shelf_health?: number; // 0-100
  pdf_reports?: number;
  csv_reports?: number;
};

export type BillingOverview = {
  plan_id: PlanId;
  plan_name?: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  amount_due?: number; // INR
  next_billing_date?: string; // ISO
  auto_renew: boolean;
  cancel_at_period_end?: boolean;
  currency?: string;
  usage: UsageSummary;
  payment_method?: PaymentMethod;
  billing_contact?: { email?: string; company?: string; gstin?: string; address?: string };
  promo?: { code: string; description?: string; discount_label?: string } | null;
  credits?: { referral?: number; ai?: number };
};

export type Invoice = {
  id: string;
  number?: string;
  issued_at?: string; // ISO
  amount: number; // INR
  tax_amount?: number;
  plan?: string;
  status: "paid" | "due" | "failed" | "refunded";
  gst_invoice?: boolean;
  pdf_url?: string;
};

export type InvoiceListResponse = { items: Invoice[]; total: number; page: number; page_size: number };

function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
  const options = { signal: init?.signal ?? undefined };
  if (method === "GET") return api.get<T>(path, options);
  if (method === "DELETE") return api.delete<T>(path, options);
  if (method === "POST") return api.post<T>(path, body, options);
  if (method === "PUT") return api.put<T>(path, body, options);
  return api.patch<T>(path, body, options);
}

/** GET /billing/overview — subscription, usage and payment method. */
export function fetchBillingOverview(signal?: AbortSignal): Promise<BillingOverview> {
  return request<BillingOverview>("/billing/overview", { signal: signal ?? null });
}

/** GET /billing/invoices */
export function fetchInvoices(
  params: { page?: number; page_size?: number } = {},
  signal?: AbortSignal,
): Promise<InvoiceListResponse> {
  const search = new URLSearchParams({
    page: String(params.page ?? 1),
    page_size: String(params.page_size ?? 10),
  });
  return request<InvoiceListResponse>(`/billing/invoices?${search.toString()}`, { signal: signal ?? null });
}

/** POST /billing/checkout — returns a Cashfree hosted checkout session. */
export function createCheckoutSession(input: {
  plan_id: PlanId;
  billing_cycle: BillingCycle;
  promo_code?: string;
}): Promise<{ payment_session_id?: string; checkout_url?: string; order_id?: string }> {
  return request("/billing/checkout", { method: "POST", body: JSON.stringify(input) });
}

/** POST /billing/subscription/cancel */
export function cancelSubscription(): Promise<BillingOverview> {
  return request("/billing/subscription/cancel", { method: "POST" });
}

/** POST /billing/subscription/resume */
export function resumeSubscription(): Promise<BillingOverview> {
  return request("/billing/subscription/resume", { method: "POST" });
}

/** PATCH /billing/subscription — auto-renew and other toggles. */
export function updateSubscription(input: { auto_renew?: boolean }): Promise<BillingOverview> {
  return request("/billing/subscription", { method: "PATCH", body: JSON.stringify(input) });
}

/** POST /billing/promo — validate and apply a coupon. */
export function applyPromoCode(code: string): Promise<{ code: string; discount_label?: string; description?: string }> {
  return request("/billing/promo", { method: "POST", body: JSON.stringify({ code }) });
}

/** POST /billing/payment-method — starts a Cashfree mandate/card update flow. */
export function startPaymentMethodUpdate(): Promise<{ redirect_url?: string }> {
  return request("/billing/payment-method", { method: "POST" });
}

// ---------- formatting helpers ----------

export function formatMoney(amount?: number, currency = "INR"): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
  return currency === "INR"
    ? `₹${amount.toLocaleString("en-IN")}`
    : `${currency} ${amount.toLocaleString()}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function normalizePercent(value?: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value <= 1 ? value * 100 : value;
}

export function formatPercent(value?: number): string {
  const pct = normalizePercent(value);
  return pct === undefined ? "—" : `${pct.toFixed(1)}%`;
}

export function formatNumber(value?: number): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-IN") : "—";
}

export function usagePercent(usage: UsageSummary): number | null {
  if (!usage.scans_included) return null;
  return Math.min(100, Math.round((usage.scans_used / usage.scans_included) * 100));
}

export function remainingScans(usage: UsageSummary): number | null {
  if (!usage.scans_included) return null;
  return Math.max(0, usage.scans_included - usage.scans_used);
}

export const statusLabels: Record<SubscriptionStatus, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment due",
  cancelled: "Cancelled",
  paused: "Paused",
};
