// Aislix subscription limit enforcement.
//
// The single source of truth is the `get_org_usage_summary` RPC: it resolves the
// org's plan, monthly / rolling-24h scan usage, store usage, the history window
// and (for Free workspaces that hit the cap) the exact cooldown timestamp.
//
// Usage counters are maintained by a database trigger when a scan completes —
// never increment them from the client.

import { supabase } from "@/integrations/supabase/client";
import { ApiError } from "@/lib/api/errors";
import { requireOrgId } from "@/lib/db/context";

export type QuotaPeriod = "month" | "rolling_24h";

export type UsageSummary = {
  plan_code: string;
  plan_name: string;
  quota_period: QuotaPeriod;
  is_contact_sales: boolean;
  price_monthly_inr: number;
  scan_quota: number | null; // null = unlimited
  store_limit: number | null; // null = unlimited
  seat_limit: number | null;
  history_days: number | null; // null = unlimited history
  scans_used: number;
  scans_remaining: number | null;
  stores_used: number;
  stores_remaining: number | null;
  period_start?: string | null;
  period_end?: string | null;
  cooldown_until?: string | null;
  can_scan: boolean;
  can_add_store: boolean;
  status: string;
  cycle: "monthly" | "annual";
  cancel_at_period_end: boolean;
  platform_bypass?: boolean;
  platform_bypass_note?: string | null;
};

export const PLATFORM_BYPASS_EMAILS = ["apurv@aislix.com"];

/** Internal tester allowlist — plan limits are not enforced for these accounts. */
export function hasPlatformBypass(email?: string | null): boolean {
  if (!email) return false;
  return PLATFORM_BYPASS_EMAILS.includes(email.trim().toLowerCase());
}

async function currentUserEmail(): Promise<string | undefined> {
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? undefined;
}

export type LimitKind = "scan_quota" | "scan_cooldown" | "store_limit";

/** Thrown when a plan limit blocks an action. Carries data for the limit modal. */
export class LimitReachedError extends ApiError {
  limit: LimitKind;
  usage: UsageSummary;
  cooldownUntil?: string;

  constructor(input: { limit: LimitKind; usage: UsageSummary; message: string; cooldownUntil?: string }) {
    super({ message: input.message, kind: "validation", status: 429 });
    this.name = "LimitReachedError";
    this.limit = input.limit;
    this.usage = input.usage;
    if (input.cooldownUntil) this.cooldownUntil = input.cooldownUntil;
  }
}

export function isLimitReachedError(error: unknown): error is LimitReachedError {
  return error instanceof LimitReachedError;
}

/** Live usage + plan limits for the active organization. */
export async function fetchUsageSummary(signal?: AbortSignal): Promise<UsageSummary> {
  void signal;
  const orgId = await requireOrgId();
  const { data, error } = await supabase.rpc("get_org_usage_summary", { p_org_id: orgId });
  if (error) {
    throw new ApiError({
      message: error.message || "Could not load your plan usage.",
      kind: "server",
      status: 500,
    });
  }
  const usage = data as unknown as UsageSummary;
  const email = await currentUserEmail();
  if (usage.platform_bypass || hasPlatformBypass(email)) {
    return {
      ...usage,
      platform_bypass: true,
      platform_bypass_note: usage.platform_bypass_note ?? "Internal tester — plan limits not enforced",
      can_scan: true,
      can_add_store: true,
      cooldown_until: null,
      history_days: null,
    };
  }
  return usage;
}

// ---------- enforcement ----------

/** Blocks a new scan when the plan's scan allowance is exhausted. */
export async function assertCanStartScan(): Promise<UsageSummary> {
  const usage = await fetchUsageSummary();
  if (usage.can_scan || usage.platform_bypass) return usage;

  if (usage.quota_period === "rolling_24h") {
    throw new LimitReachedError({
      limit: "scan_cooldown",
      usage,
      ...(usage.cooldown_until ? { cooldownUntil: usage.cooldown_until } : {}),
      message: `You've used all ${usage.scan_quota} scans on the ${usage.plan_name} plan. Scanning unlocks again ${formatCooldown(usage.cooldown_until)}.`,
    });
  }

  throw new LimitReachedError({
    limit: "scan_quota",
    usage,
    message: `You've used all ${usage.scan_quota} scans included in your ${usage.plan_name} plan this month. Upgrade to keep scanning.`,
  });
}

/** Blocks a new store when the plan's store allowance is exhausted. */
export async function assertCanAddStore(): Promise<UsageSummary> {
  const usage = await fetchUsageSummary();
  if (usage.can_add_store || usage.platform_bypass) return usage;
  throw new LimitReachedError({
    limit: "store_limit",
    usage,
    message: `The ${usage.plan_name} plan includes ${usage.store_limit} ${
      usage.store_limit === 1 ? "store" : "stores"
    }. Upgrade to add more.`,
  });
}

// ---------- history window ----------

/**
 * ISO cutoff for scan history visibility, or `null` when the plan keeps full
 * history. Data is never deleted — older scans are filtered out of listings.
 */
export function historyCutoffIso(
  usage: Pick<UsageSummary, "history_days" | "platform_bypass"> | null | undefined,
): string | null {
  if (usage?.platform_bypass) return null;
  const days = usage?.history_days;
  if (!days || days <= 0) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Convenience for data modules: resolves the cutoff without a usage object. */
/** Full history for testers; otherwise the plan's rolling window. */
export function historyCutoffForPlan(historyDays: number | null | undefined, email?: string | null): string | null {
  if (hasPlatformBypass(email)) return null;
  return historyCutoffIso({ history_days: historyDays ?? null });
}

export async function fetchHistoryCutoffIso(): Promise<string | null> {
  try {
    const usage = await fetchUsageSummary();
    return historyCutoffIso(usage);
  } catch {
    return null;
  }
}

// ---------- formatting ----------

export function formatCooldown(iso?: string | null): string {
  if (!iso) return "in a few hours";
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return "in a few hours";
  const ms = target - Date.now();
  if (ms <= 0) return "now";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 1) return `in ${hours}h ${minutes}m`;
  return `in ${Math.max(1, minutes)}m`;
}

/** Countdown string for the Free-plan cooldown timer, e.g. "05:42:11". */
export function cooldownClock(iso?: string | null, now: number = Date.now()): string {
  if (!iso) return "00:00:00";
  const ms = new Date(iso).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/** "127 / 300 scans used this month" · "2 / 3 scans used in the last 24 hours". */
export function scanUsageLabel(usage: UsageSummary): string {
  const window = usage.quota_period === "rolling_24h" ? "in the last 24 hours" : "this month";
  if (usage.scan_quota === null) {
    return `${usage.scans_used.toLocaleString("en-IN")} scans used ${window} · Unlimited`;
  }
  return `${usage.scans_used.toLocaleString("en-IN")} / ${usage.scan_quota.toLocaleString(
    "en-IN",
  )} scans used ${window}`;
}

/** "1 / 3 stores used" or "4 stores · Unlimited". */
export function storeUsageLabel(usage: UsageSummary): string {
  if (usage.store_limit === null) return `${usage.stores_used} stores · Unlimited`;
  return `${usage.stores_used} / ${usage.store_limit} stores used`;
}
