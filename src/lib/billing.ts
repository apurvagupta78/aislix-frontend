// Live billing contract backed by Supabase. No payment provider is connected
// yet, so checkout/promo/payment-method actions surface a clear error instead
// of faking a result, and invoices always return an empty list.

import { ApiError } from "@/lib/api/errors";
import { dbError, requireOrgId } from "@/lib/db/context";
import type { BillingCycle, PlanId } from "@/lib/pricing";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "cancelled" | "paused";

export type PaymentMethod = {
  id: string;
  brand?: string; // e.g. "HDFC Visa", "UPI"
  label?: string; // masked identifier, e.g. "•••• 4218"
  expiry?: string; // MM / YYYY
  type?: "card" | "upi" | "netbanking" | "mandate";
};

export type UsageSummary = {
  /** "rolling_24h" for the Free plan (5 scans / 24h), "month" for paid quotas. */
  quota_period?: "rolling_24h" | "month";
  period_start?: string;
  period_end?: string;
  scans_used: number;
  scans_included: number | null; // null = unlimited
  /** Free plan only: when the rolling window frees up the next scan. */
  cooldown_until?: string | null;
  can_scan?: boolean;
  stores_used?: number;
  stores_included?: number | null;
  seats_used?: number;
  seats_included?: number | null;
  seat_limit_label?: string;
  history_days?: number | null;
  products_detected?: number;
  average_confidence?: number; // 0-1 or 0-100
  average_shelf_health?: number; // 0-100
  pdf_reports?: number;
  csv_reports?: number;
  /** Internal tester accounts: plan limits are not enforced. */
  platform_bypass?: boolean;
  platform_bypass_note?: string | null;
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

function mapStatus(status: string): SubscriptionStatus {
  if (status === "canceled") return "cancelled";
  if (
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    status === "cancelled" ||
    status === "paused"
  ) {
    return status;
  }
  return "active";
}

function notConnected(action: string): never {
  throw new ApiError({
    message: `${action} isn't available yet — a payment provider hasn't been connected to Aislix.`,
    kind: "not_configured",
    status: 501,
  });
}

async function getSubscriptionRow(orgId: string) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "id, status, cycle, current_period_start, current_period_end, cancel_at_period_end, scans_used, plan_id, subscription_plans(id, code, name, scan_quota, store_limit, seat_limit, price_monthly_inr, price_annual_inr)",
    )
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) dbError(error, "Could not load your subscription.");
  return data;
}


/** Free-plan daily commercial cap (Asia/Kolkata). Monthly cap is 30. */
export const FREE_SCAN_LIMIT_24H = 5;
export const FREE_SCAN_LIMIT_MONTH = 30;

/**
 * Live plan allowance check used before a scan is created. Delegates to the
 * `get_org_usage_summary` RPC so Free (rolling 24h) and paid (monthly) plans
 * share one source of truth. Usage counters are maintained by a DB trigger.
 */
export async function assertScanAllowance(): Promise<void> {
  const { assertCanStartScan } = await import("@/lib/subscription-limits");
  await assertCanStartScan();
}

/** The org's subscription, plan and real usage from get_org_usage_summary. */
export async function fetchBillingOverview(signal?: AbortSignal): Promise<BillingOverview> {
  void signal;
  const orgId = await requireOrgId();
  const sub = await getSubscriptionRow(orgId);
  if (!sub) {
    throw new ApiError({ message: "No subscription found for your workspace.", kind: "not_found", status: 404 });
  }
  const plan = sub.subscription_plans as {
    id: string;
    code: string;
    name: string;
    scan_quota: number | null;
    store_limit: number | null;
    seat_limit: number | null;
    price_monthly_inr: number;
    price_annual_inr: number;
  } | null;

  const { fetchUsageSummary } = await import("@/lib/subscription-limits");
  const live = await fetchUsageSummary();


  // Billing email + GSTIN are owner/admin-only and come from a guarded RPC.
  const { data: billingProfile } = await supabase.rpc("get_org_billing_profile", {
    p_org_id: orgId,
  });
  const org = (Array.isArray(billingProfile) ? billingProfile[0] : null) ?? null;

  const amount = plan
    ? sub.cycle === "annual"
      ? plan.price_annual_inr
      : plan.price_monthly_inr
    : undefined;

  const address = org?.address as Record<string, unknown> | null;
  const addressLabel = address
    ? [address.line1, address.city, address.state].filter(Boolean).join(", ") || undefined
    : undefined;

  return {
    plan_id: (plan?.code as PlanId) ?? "free",
    plan_name: plan?.name,
    status: mapStatus(sub.status),
    billing_cycle: sub.cycle as BillingCycle,
    amount_due: amount,
    next_billing_date: sub.current_period_end ?? undefined,
    auto_renew: !sub.cancel_at_period_end,
    cancel_at_period_end: sub.cancel_at_period_end,
    currency: "INR",
    usage: {
      quota_period: live.quota_period,
      period_start: live.period_start ?? sub.current_period_start,
      period_end: live.period_end ?? sub.current_period_end ?? undefined,
      // Counted by the database: rolling 24h for Free, calendar month otherwise.
      scans_used: live.scans_used,
      scans_included: live.scan_quota,
      cooldown_until: live.cooldown_until ?? null,
      can_scan: live.can_scan,
      stores_used: live.stores_used,
      stores_included: live.store_limit,
      seats_used: live.seats_used,
      seats_included: live.seats_included,
      seat_limit_label: live.seat_limit_label,
      history_days: live.history_days,
      ...(live.platform_bypass
        ? { platform_bypass: true, platform_bypass_note: live.platform_bypass_note ?? null }
        : {}),
    },

    payment_method: undefined,
    billing_contact: {
      email: org?.billing_email ?? undefined,
      company: org?.name,
      gstin: org?.gstin ?? undefined,
      address: addressLabel,
    },
    promo: null,
    credits: undefined,
  };
}

/** No invoices table exists yet; always returns an empty, correctly-shaped page. */
export async function fetchInvoices(
  params: { page?: number; page_size?: number } = {},
  signal?: AbortSignal,
): Promise<InvoiceListResponse> {
  void signal;
  await requireOrgId();
  return { items: [], total: 0, page: params.page ?? 1, page_size: params.page_size ?? 10 };
}

/** No payment provider is connected — checkout cannot be started yet. */
export function createCheckoutSession(_input: {
  plan_id: PlanId;
  billing_cycle: BillingCycle;
  promo_code?: string;
}): Promise<{ payment_session_id?: string; checkout_url?: string; order_id?: string }> {
  notConnected("Checkout");
}

/** Sets cancel_at_period_end on the org's live subscription row. */
export async function cancelSubscription(): Promise<BillingOverview> {
  const orgId = await requireOrgId();
  const { error } = await supabase
    .from("subscriptions")
    .update({ cancel_at_period_end: true })
    .eq("org_id", orgId);
  if (error) dbError(error, "Could not cancel your subscription.");
  return fetchBillingOverview();
}

/** Clears cancel_at_period_end on the org's live subscription row. */
export async function resumeSubscription(): Promise<BillingOverview> {
  const orgId = await requireOrgId();
  const { error } = await supabase
    .from("subscriptions")
    .update({ cancel_at_period_end: false })
    .eq("org_id", orgId);
  if (error) dbError(error, "Could not resume your subscription.");
  return fetchBillingOverview();
}

/** Updates auto-renew (mapped to cancel_at_period_end) on the subscription row. */
export async function updateSubscription(input: { auto_renew?: boolean }): Promise<BillingOverview> {
  const orgId = await requireOrgId();
  if (typeof input.auto_renew === "boolean") {
    const { error } = await supabase
      .from("subscriptions")
      .update({ cancel_at_period_end: !input.auto_renew })
      .eq("org_id", orgId);
    if (error) dbError(error, "Could not update your subscription.");
  }
  return fetchBillingOverview();
}

/** No payment provider is connected — promo codes cannot be validated yet. */
export function applyPromoCode(
  _code: string,
): Promise<{ code: string; discount_label?: string; description?: string }> {
  notConnected("Promo codes");
}

/** No payment provider is connected — there is no payment method to update. */
export function startPaymentMethodUpdate(): Promise<{ redirect_url?: string }> {
  notConnected("Updating your payment method");
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
  if (usage.platform_bypass) return null;
  if (!usage.scans_included) return null;
  return Math.min(100, Math.round((usage.scans_used / usage.scans_included) * 100));
}

export function remainingScans(usage: UsageSummary): number | null {
  if (usage.platform_bypass) return null;
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
