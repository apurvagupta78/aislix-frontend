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
import { getPlanDefinition } from "@/lib/plan-entitlements";

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
  /** Alias of `seat_limit` as returned by the RPC (null = unlimited). */
  seats_included: number | null;
  seats_used: number;
  /** e.g. "3 users" / "Unlimited users". */
  seat_limit_label: string;
  history_days: number | null; // null = unlimited history
  scans_used: number;
  scans_remaining: number | null;
  stores_used: number;
  stores_remaining: number | null;
  master_setups_used: number;
  master_setups_included: number | null;
  master_setups_remaining: number | null;
  price_per_audit_inr: number | null;
  period_start?: string | null;
  period_end?: string | null;
  cooldown_until?: string | null;
  can_scan: boolean;
  can_add_store: boolean;
  can_add_master_setup?: boolean;
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

async function bypassUsageFallback(orgId: string): Promise<UsageSummary> {
  const [{ data: subscription }, { count: storesUsed }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "status, cycle, current_period_start, current_period_end, scans_used, cancel_at_period_end, subscription_plans(code, name, scan_quota, store_limit, seat_limit, history_days, quota_period, is_contact_sales, price_monthly_inr)",
      )
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("stores")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "active"),
  ]);
  const plan = subscription?.subscription_plans as
    | {
        code: string;
        name: string;
        scan_quota: number | null;
        store_limit: number | null;
        seat_limit: number | null;
        history_days: number | null;
        quota_period: QuotaPeriod;
        is_contact_sales: boolean;
        price_monthly_inr: number;
      }
    | null
    | undefined;

  return {
    plan_code: plan?.code ?? "free",
    plan_name: plan?.name ?? "Free",
    quota_period: plan?.quota_period ?? "rolling_24h",
    is_contact_sales: plan?.is_contact_sales ?? false,
    price_monthly_inr: plan?.price_monthly_inr ?? 0,
    scan_quota: plan?.scan_quota ?? null,
    store_limit: plan?.store_limit ?? null,
    seat_limit: plan?.seat_limit ?? null,
    seats_included: plan?.seat_limit ?? null,
    seats_used: 0,
    seat_limit_label: seatLimitLabel(plan?.seat_limit ?? null),
    history_days: null,
    scans_used: subscription?.scans_used ?? 0,
    scans_remaining: null,
    stores_used: storesUsed ?? 0,
    stores_remaining: null,
    master_setups_used: 0,
    master_setups_included: null,
    master_setups_remaining: null,
    price_per_audit_inr: null,
    period_start: subscription?.current_period_start ?? null,
    period_end: subscription?.current_period_end ?? null,
    cooldown_until: null,
    can_scan: true,
    can_add_store: true,
    status: subscription?.status ?? "active",
    cycle: subscription?.cycle ?? "monthly",
    cancel_at_period_end: subscription?.cancel_at_period_end ?? false,
    platform_bypass: true,
    platform_bypass_note: "Internal tester — plan limits not enforced",
  };
}

export type LimitKind =
  | "scan_quota"
  | "scan_cooldown"
  | "store_limit"
  | "seat_limit"
  | "master_setup_limit";

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

/** Store allowance exhausted (client check or DB trigger `STORE_LIMIT_REACHED`). */
export class StoreLimitError extends LimitReachedError {
  constructor(input: { usage: UsageSummary; message: string }) {
    super({ limit: "store_limit", usage: input.usage, message: input.message });
    this.name = "StoreLimitError";
  }
}

/** Seat allowance exhausted (client check or DB trigger `SEAT_LIMIT_REACHED`). */
export class SeatLimitError extends LimitReachedError {
  constructor(input: { usage: UsageSummary; message: string }) {
    super({ limit: "seat_limit", usage: input.usage, message: input.message });
    this.name = "SeatLimitError";
  }
}

/** Scan allowance exhausted (client check or DB trigger `SCAN_LIMIT_REACHED`). */
export class ScanLimitError extends LimitReachedError {
  constructor(input: { usage: UsageSummary; message: string; cooldownUntil?: string; cooldown?: boolean }) {
    super({
      limit: input.cooldown ? "scan_cooldown" : "scan_quota",
      usage: input.usage,
      message: input.message,
      ...(input.cooldownUntil ? { cooldownUntil: input.cooldownUntil } : {}),
    });
    this.name = "ScanLimitError";
  }
}

/** Canonical seat allowance per plan, mirroring `subscription_plans.seat_limit`. */
export function defaultSeatLimit(planCode: string): number | null {
  return getPlanDefinition(planCode)?.controls.users.value ?? null;
}

export function defaultMasterSetupLimit(planCode: string): number | null {
  return getPlanDefinition(planCode)?.controls.masterSetups.value ?? null;
}

export function seatLimitLabel(seatLimit: number | null): string {
  if (seatLimit === null) return "Unlimited users";
  return seatLimit === 1 ? "1 user" : `${seatLimit} users`;
}

/**
 * The RPC returns a flatter shape (`scans_included`, `stores_included`, `blocked`)
 * than the client `UsageSummary`. Normalise it so limit messages never render
 * `undefined` and `can_add_store` / `can_scan` are always real booleans.
 */
export function normalizeUsageSummary(raw: Record<string, unknown> | null | undefined): UsageSummary {
  return normalizeUsage((raw ?? {}) as Record<string, unknown>);
}

function normalizeUsage(raw: Record<string, unknown>): UsageSummary {
  const num = (v: unknown): number | null =>
    v === null || v === undefined ? null : Number(v);
  const planCode = ((raw["plan_code"] as string) ?? "free").toLowerCase();
  const isFree = planCode === "free";
  const isEnterprise = planCode === "enterprise";
  // When the RPC omits limits, fall back to the published plan catalogue so paid
  // tiers never render as "Unlimited" (only Enterprise has no monthly cap).
  const catalogue = getPlanDefinition(planCode);
  const scanQuota =
    num(raw["scan_quota"] ?? raw["scans_included"]) ??
    (isEnterprise || planCode === "payg"
      ? null
      : (catalogue?.controls.audits.value ?? (isFree ? 5 : null)));
  const storeLimit =
    num(raw["store_limit"] ?? raw["stores_included"]) ??
    (isEnterprise ? null : (catalogue?.controls.stores.value ?? (isFree ? 1 : null)));
  const historyDays = num(raw["history_days"]) ?? catalogue?.historyDays ?? (isFree ? 7 : null);
  const seatLimit =
    num(raw["seat_limit"] ?? raw["seats_included"]) ?? defaultSeatLimit(planCode);
  const masterSetupLimit =
    num(raw["master_setups_included"]) ?? defaultMasterSetupLimit(planCode);
  const seatsUsed = num(raw["seats_used"]) ?? 1;
  const scansUsed = num(raw["scans_used"]) ?? 0;
  const storesUsed = num(raw["stores_used"]) ?? 0;
  const masterSetupsUsed = num(raw["master_setups_used"]) ?? 0;
  const blocked = Boolean(raw["blocked"]);

  return {
    plan_code: planCode,
    plan_name: (raw["plan_name"] as string) ?? "Free",
    quota_period: (raw["quota_period"] as QuotaPeriod) ?? (isFree ? "rolling_24h" : "month"),
    is_contact_sales: Boolean(raw["is_contact_sales"]) || isEnterprise,
    price_monthly_inr: num(raw["price_monthly_inr"]) ?? 0,
    scan_quota: scanQuota,
    store_limit: storeLimit,
    seat_limit: seatLimit,
    seats_included: seatLimit,
    seats_used: seatsUsed,
    seat_limit_label: (raw["seat_limit_label"] as string) || seatLimitLabel(seatLimit),
    history_days: historyDays,
    scans_used: scansUsed,
    scans_remaining: num(raw["scans_remaining"]),
    stores_used: storesUsed,
    stores_remaining: storeLimit === null ? null : Math.max(0, storeLimit - storesUsed),
    master_setups_used: masterSetupsUsed,
    master_setups_included: masterSetupLimit,
    master_setups_remaining:
      masterSetupLimit === null ? null : Math.max(0, masterSetupLimit - masterSetupsUsed),
    price_per_audit_inr: num(raw["price_per_audit_inr"]),
    period_start: (raw["period_start"] as string) ?? null,
    period_end: (raw["period_end"] as string) ?? null,
    cooldown_until: (raw["cooldown_until"] as string) ?? null,
    can_scan: raw["can_scan"] !== undefined ? Boolean(raw["can_scan"]) : !blocked,
    can_add_store:
      raw["can_add_store"] !== undefined
        ? Boolean(raw["can_add_store"])
        : storeLimit === null || storesUsed < storeLimit,
    can_add_master_setup:
      masterSetupLimit === null || masterSetupsUsed < masterSetupLimit,
    status: (raw["status"] as string) ?? "active",
    cycle: (raw["cycle"] as "monthly" | "annual") ?? "monthly",
    cancel_at_period_end: Boolean(raw["cancel_at_period_end"]),
    ...(raw["platform_bypass"] !== undefined ? { platform_bypass: Boolean(raw["platform_bypass"]) } : {}),
    platform_bypass_note: (raw["platform_bypass_note"] as string) ?? null,
  };
}

/** Live usage + plan limits for the active organization. */
export async function fetchUsageSummary(signal?: AbortSignal, orgIdOverride?: string): Promise<UsageSummary> {
  void signal;
  const orgId = orgIdOverride ?? (await requireOrgId());
  const email = await currentUserEmail();
  const { data, error } = await supabase.rpc("get_org_usage_summary", { p_org_id: orgId });
  if (error) {
    if (hasPlatformBypass(email)) return bypassUsageFallback(orgId);
    throw new ApiError({
      message: error.message || "Could not load your plan usage.",
      kind: "server",
      status: 500,
    });
  }
  const usage = normalizeUsageSummary(data as Record<string, unknown> | null);
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
export async function assertCanStartScan(orgId?: string): Promise<UsageSummary> {
  const email = await currentUserEmail();
  if (hasPlatformBypass(email)) return fetchUsageSummary(undefined, orgId);
  const usage = await fetchUsageSummary(undefined, orgId);
  if (usage.can_scan || usage.platform_bypass) return usage;
  throw scanLimitError(usage);
}

/** Blocks a new store when the plan's store allowance is exhausted. */
export async function assertCanAddStore(orgId?: string): Promise<UsageSummary> {
  const email = await currentUserEmail();
  const usage = await fetchUsageSummary(undefined, orgId);
  if (hasPlatformBypass(email)) return usage;
  // The very first store is always allowed, whatever the plan says.
  if (usage.stores_used === 0) return usage;
  if (usage.can_add_store || usage.platform_bypass) return usage;
  throw storeLimitError(usage);
}

/** Blocks a new master shelf setup when the plan limit is reached. */
export async function assertCanAddMasterSetup(orgId?: string): Promise<UsageSummary> {
  const email = await currentUserEmail();
  const usage = await fetchUsageSummary(undefined, orgId);
  if (hasPlatformBypass(email) || usage.platform_bypass) return usage;
  if (usage.can_add_master_setup !== false) return usage;
  throw new LimitReachedError({
    limit: "master_setup_limit",
    usage,
    message: `You've reached your Master Setup limit on the ${usage.plan_name} plan. Upgrade plan to add more.`,
  });
}

/** Blocks a new invite / member when the plan's seats are all taken. */
export async function assertCanInviteMember(orgId?: string): Promise<UsageSummary> {
  const email = await currentUserEmail();
  const usage = await fetchUsageSummary(undefined, orgId);
  if (hasPlatformBypass(email) || usage.platform_bypass) return usage;
  if (canInviteMember(usage)) return usage;
  throw seatLimitError(usage);
}

/** Pure check for UI gating (disabled invite forms, remaining-seat badges). */
export function canInviteMember(usage: UsageSummary | null | undefined): boolean {
  if (!usage) return false;
  if (usage.platform_bypass) return true;
  if (usage.seats_included === null) return true;
  return usage.seats_used < usage.seats_included;
}

/** Seats still available, or `null` when unlimited. */
export function remainingSeats(usage: UsageSummary | null | undefined): number | null {
  if (!usage || usage.seats_included === null) return null;
  return Math.max(0, usage.seats_included - usage.seats_used);
}

export function seatLimitError(usage: UsageSummary): SeatLimitError {
  const limit = usage.seats_included;
  if (limit === 1) {
    return new SeatLimitError({
      usage,
      message: `Your ${usage.plan_name} plan includes 1 user (you). Upgrade to Growth to invite team members.`,
    });
  }
  return new SeatLimitError({
    usage,
    message:
      limit === null
        ? `Your ${usage.plan_name} plan cannot add more users right now. Upgrade to add more.`
        : `The ${usage.plan_name} plan includes ${limit} users and all seats are in use. Upgrade to invite more people.`,
  });
}

function scanLimitError(usage: UsageSummary): ScanLimitError {
  const quota = usage.scan_quota ?? (usage.plan_code === "free" ? 5 : usage.scans_used);
  if (usage.quota_period === "rolling_24h") {
    return new ScanLimitError({
      usage,
      cooldown: true,
      ...(usage.cooldown_until ? { cooldownUntil: usage.cooldown_until } : {}),
      message: `You've used all ${quota} scans on the ${usage.plan_name} plan. Scanning unlocks again ${formatCooldown(usage.cooldown_until)}.`,
    });
  }
  return new ScanLimitError({
    usage,
    message: `You've used all ${quota} scans included in your ${usage.plan_name} plan this month. Upgrade to keep scanning.`,
  });
}

function storeLimitError(usage: UsageSummary): StoreLimitError {
  const limit = usage.store_limit;
  return new StoreLimitError({
    usage,
    message:
      limit === null
        ? `Your ${usage.plan_name} plan cannot add more stores right now. Upgrade to add more.`
        : `The ${usage.plan_name} plan includes ${limit} ${limit === 1 ? "store" : "stores"}. Upgrade to add more.`,
  });
}

/**
 * Maps a database trigger error (`STORE_LIMIT_REACHED` / `SCAN_LIMIT_REACHED`)
 * onto the typed limit errors so the upgrade modal shows instead of a raw
 * Postgres message. Anything else is returned untouched.
 */
export async function mapLimitError(error: unknown, orgId?: string): Promise<unknown> {
  if (isLimitReachedError(error)) return error;
  const text =
    typeof error === "object" && error !== null
      ? `${(error as { message?: string }).message ?? ""} ${(error as { details?: string }).details ?? ""}`
      : String(error ?? "");
  const isStore = text.includes("STORE_LIMIT_REACHED");
  const isScan = text.includes("SCAN_LIMIT_REACHED");
  const isSeat = text.includes("SEAT_LIMIT_REACHED");
  const isMaster = text.includes("MASTER_SETUP_LIMIT_REACHED");
  if (!isStore && !isScan && !isSeat && !isMaster) return error;
  let usage: UsageSummary;
  try {
    usage = await fetchUsageSummary(undefined, orgId);
  } catch {
    usage = normalizeUsageSummary(null);
  }
  if (isSeat) return seatLimitError(usage);
  if (isMaster) {
    return new LimitReachedError({
      limit: "master_setup_limit",
      usage,
      message: `You've reached your Master Setup limit on the ${usage.plan_name} plan. Upgrade plan to add more.`,
    });
  }
  return isStore ? storeLimitError(usage) : scanLimitError(usage);
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

/** "127 / 300 scans used this month" · "2 / 5 scans used in the last 24 hours". */
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

/** "2 / 3 users" or "4 users · Unlimited". */
export function seatUsageLabel(usage: UsageSummary): string {
  if (usage.seats_included === null) return `${usage.seats_used} users · Unlimited`;
  return `${usage.seats_used} / ${usage.seats_included} users`;
}

/** "2 / 5 master setups" or "4 master setups · Unlimited". */
export function masterSetupUsageLabel(usage: UsageSummary): string {
  if (usage.master_setups_included === null) {
    return `${usage.master_setups_used} master setups · Unlimited`;
  }
  return `${usage.master_setups_used} / ${usage.master_setups_included} master setups`;
}

/** Usage ratio 0–100 for limit meters; null when unlimited. */
export function usageRatio(used: number, limit: number | null | undefined): number | null {
  if (limit === null || limit === undefined || limit <= 0) return null;
  return Math.min(100, Math.round((used / limit) * 100));
}

export type UsageWarningLevel = "none" | "soft" | "strong" | "full";

export function usageWarningLevel(ratio: number | null): UsageWarningLevel {
  if (ratio === null) return "none";
  if (ratio >= 100) return "full";
  if (ratio >= 90) return "strong";
  if (ratio >= 80) return "soft";
  return "none";
}

/**
 * Single label helper for dashboard / billing widgets. Values always come from
 * the normalised usage summary, so `undefined` can never reach the UI.
 */
export function formatUsageLabel(
  usage: UsageSummary | Record<string, unknown> | null | undefined,
): {
  scans: string;
  stores: string;
  seats: string;
  masterSetups: string;
  cooldown: string | null;
} {
  const safe = normalizeUsageSummary((usage ?? null) as Record<string, unknown> | null);
  const cooldown =
    !safe.can_scan && safe.cooldown_until
      ? `Unlocks in ${cooldownClock(safe.cooldown_until)}`
      : null;
  const stores =
    safe.store_limit === null
      ? `${safe.stores_used} stores · Unlimited`
      : `${safe.stores_used} / ${safe.store_limit} stores`;
  return {
    scans: scanUsageLabel(safe),
    stores,
    seats: seatUsageLabel(safe),
    masterSetups: masterSetupUsageLabel(safe),
    cooldown,
  };
}
