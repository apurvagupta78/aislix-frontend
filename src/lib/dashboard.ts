// Admin dashboard contract.
//
// Every number rendered on the dashboard comes from live Supabase queries
// scoped to the signed-in user's organization — there is no local dummy data
// and no client-side business logic beyond aggregation of real rows.

import { supabase } from "@/integrations/supabase/client";
import { dbError, getUser, requireOrgId } from "@/lib/db/context";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/format-date";
import { sanitizeUserMessage } from "@/lib/api-errors";

// ---------- KPIs / account ----------

export type DashboardKpis = {
  total_scans?: number;
  products_detected?: number;
  stores?: number;
  shelf_health_score?: number; // 0-100
  low_stock_alerts?: number;
  out_of_stock_alerts?: number;
  average_confidence?: number; // 0-1 or 0-100
  scans_remaining?: number | null; // null = unlimited
};

export type AccountSummary = {
  plan_name?: string;
  plan_id?: string;
  status?: string;
  scans_used?: number;
  scans_included?: number | null; // null = unlimited
  scans_remaining?: number | null;
  renewal_date?: string | null; // ISO
};

export type ActivityKind =
  | "scan_completed"
  | "pdf_downloaded"
  | "store_added"
  | "user_invited"
  | "subscription_upgraded";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  description?: string;
  created_at: string; // ISO
  actor?: string;
  href?: string;
};

export type DashboardResponse = {
  greeting_name?: string;
  kpis: DashboardKpis;
  account?: AccountSummary;
  activity?: ActivityItem[];
};

/** Aggregated dashboard data for the signed-in user's active organization. */
export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardResponse> {
  void signal;
  const orgId = await requireOrgId();
  const user = await getUser();

  const [
    profileRes,
    scansRes,
    storesCountRes,
    membersCountRes,
    subscriptionRes,
    recentStoresRes,
    recentMembersRes,
  ] = await Promise.all([
    user
      ? supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
    supabase
      .from("shelf_scans")
      .select(
        "id, status, shelf_health_score, out_of_stock_count, low_stock_count, total_products, created_at, shelf_label",
        { count: "exact" },
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase.from("stores").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "active"),
    supabase
      .from("subscriptions")
      .select("scans_used, current_period_end, status, subscription_plans(name, code, scan_quota)")
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("stores")
      .select("id, name, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("organization_members")
      .select("id, created_at, invited_email, status, profiles(full_name, email)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  if (scansRes.error) dbError(scansRes.error, "Could not load scan data.");
  if (storesCountRes.error) dbError(storesCountRes.error, "Could not load stores.");
  if (membersCountRes.error) dbError(membersCountRes.error, "Could not load team data.");

  const scans = scansRes.data ?? [];
  const completedScans = scans.filter((s) => s.status === "completed");
  const totalProducts = scans.reduce((sum, s) => sum + (s.total_products ?? 0), 0);
  const avgHealth = completedScans.length
    ? completedScans.reduce((sum, s) => sum + (s.shelf_health_score ?? 0), 0) / completedScans.length
    : undefined;
  const lowStock = scans.reduce((sum, s) => sum + (s.low_stock_count ?? 0), 0);
  const outOfStock = scans.reduce((sum, s) => sum + (s.out_of_stock_count ?? 0), 0);

  const scanIds = scans.map((s) => s.id);
  let averageConfidence: number | undefined;
  if (scanIds.length) {
    const { data: results } = await supabase
      .from("scan_results")
      .select("confidence_avg")
      .in("scan_id", scanIds.slice(0, 200));
    const withConfidence = (results ?? []).filter((r) => typeof r.confidence_avg === "number");
    if (withConfidence.length) {
      averageConfidence =
        withConfidence.reduce((sum, r) => sum + (r.confidence_avg ?? 0), 0) / withConfidence.length;
    }
  }

  const sub = subscriptionRes.data as
    | {
        scans_used: number;
        current_period_end: string | null;
        status: string;
        subscription_plans: { name: string; code: string; scan_quota: number | null } | null;
      }
    | null;
  const scanQuota = sub?.subscription_plans?.scan_quota ?? null;
  const scansUsed = sub?.scans_used ?? 0;
  const scansRemaining = scanQuota === null ? null : Math.max(0, scanQuota - scansUsed);

  const activity: ActivityItem[] = [];
  for (const scan of scans.slice(0, 5)) {
    if (scan.status === "completed") {
      activity.push({
        id: `scan-${scan.id}`,
        kind: "scan_completed",
        title: scan.shelf_label ? `Scan completed — ${scan.shelf_label}` : "Scan completed",
        created_at: scan.created_at,
        href: `/dashboard/scans/${scan.id}`,
      });
    }
  }
  for (const store of recentStoresRes.data ?? []) {
    activity.push({
      id: `store-${store.id}`,
      kind: "store_added",
      title: `Store added — ${store.name}`,
      created_at: store.created_at,
    });
  }
  for (const member of (recentMembersRes.data ?? []) as Array<{
    id: string;
    created_at: string;
    invited_email: string | null;
    status: string;
    profiles: { full_name: string | null; email: string | null } | null;
  }>) {
    activity.push({
      id: `member-${member.id}`,
      kind: "user_invited",
      title: `Team member ${member.status === "invited" ? "invited" : "joined"} — ${
        member.profiles?.full_name || member.profiles?.email || member.invited_email || "member"
      }`,
      created_at: member.created_at,
    });
  }
  activity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    greeting_name: (profileRes.data as { full_name?: string } | null)?.full_name ?? undefined,
    kpis: {
      total_scans: scansRes.count ?? scans.length,
      products_detected: totalProducts,
      stores: storesCountRes.count ?? 0,
      shelf_health_score: avgHealth,
      low_stock_alerts: lowStock,
      out_of_stock_alerts: outOfStock,
      average_confidence: averageConfidence,
      scans_remaining: scansRemaining,
    },
    account: sub
      ? {
          plan_name: sub.subscription_plans?.name,
          plan_id: sub.subscription_plans?.code,
          status: sub.status,
          scans_used: scansUsed,
          scans_included: scanQuota,
          scans_remaining: scansRemaining,
          renewal_date: sub.current_period_end,
        }
      : undefined,
    activity: activity.slice(0, 8),
  };
}

// ---------- recent scans ----------

export type RecentScanStatus = "completed" | "processing" | "queued" | "failed";

export type RecentScan = {
  scan_id: string;
  store?: string;
  created_at?: string; // ISO
  shelf_health_score?: number; // 0-100
  average_confidence?: number; // 0-1 or 0-100
  products_detected?: number;
  status: RecentScanStatus;
};

export type RecentScansQuery = {
  q?: string;
  store?: string;
  status?: RecentScanStatus | "all";
  sort?: "newest" | "oldest" | "health" | "confidence" | "products";
  page?: number;
  page_size?: number;
};

export type RecentScansResponse = {
  items: RecentScan[];
  total: number;
  page: number;
  page_size: number;
  stores?: string[];
};

/** Paginated, searchable, sortable shelf-scan history for the active org. */
export async function fetchRecentScans(
  params: RecentScansQuery,
  signal?: AbortSignal,
): Promise<RecentScansResponse> {
  void signal;
  const orgId = await requireOrgId();
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 8;

  // Free plan only shows the last 7 days. Data is never deleted, just filtered.
  const { fetchHistoryCutoffIso } = await import("@/lib/subscription-limits");
  const cutoff = await fetchHistoryCutoffIso();

  let query = supabase
    .from("shelf_scans")
    .select("id, status, shelf_health_score, total_products, created_at, shelf_label, stores(name)", {
      count: "exact",
    })
    .eq("org_id", orgId);

  if (cutoff) query = query.gte("created_at", cutoff);


  if (params.status && params.status !== "all") query = query.eq("status", params.status);
  if (params.q) query = query.ilike("shelf_label", `%${params.q}%`);
  if (params.store && params.store !== "all") {
    query = query.eq("stores.name", params.store);
  }

  switch (params.sort) {
    case "oldest":
      query = query.order("created_at", { ascending: true });
      break;
    case "health":
      query = query.order("shelf_health_score", { ascending: false, nullsFirst: false });
      break;
    case "products":
      query = query.order("total_products", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) dbError(error, "Could not load recent scans.");

  const scanIds = (data ?? []).map((s) => s.id);
  const confidenceByScan = new Map<string, number>();
  if (scanIds.length) {
    const { data: results } = await supabase
      .from("scan_results")
      .select("scan_id, confidence_avg")
      .in("scan_id", scanIds);
    for (const r of results ?? []) {
      if (typeof r.confidence_avg === "number") confidenceByScan.set(r.scan_id, r.confidence_avg);
    }
  }

  const { data: storesData } = await supabase.from("stores").select("name").eq("org_id", orgId);

  const items: RecentScan[] = (data ?? []).map((row) => ({
    scan_id: row.id,
    store: (row.stores as { name: string } | null)?.name ?? undefined,
    created_at: row.created_at,
    shelf_health_score: row.shelf_health_score ?? undefined,
    average_confidence: confidenceByScan.get(row.id),
    products_detected: row.total_products ?? undefined,
    status: row.status as RecentScanStatus,
  }));

  return {
    items,
    total: count ?? items.length,
    page,
    page_size: pageSize,
    stores: (storesData ?? []).map((s) => s.name).filter(Boolean) as string[],
  };
}

// ---------- notifications ----------

export type NotificationKind =
  | "low_stock"
  | "confidence_warning"
  | "subscription"
  | "announcement";

export type NotificationSeverity = "critical" | "warning" | "info";

export type DashboardNotification = {
  id: string;
  kind: NotificationKind;
  severity?: NotificationSeverity;
  title: string;
  message?: string;
  created_at?: string;
  read?: boolean;
  href?: string;
};

export type NotificationsResponse = {
  items: DashboardNotification[];
  unread?: number;
};

/** Notifications derived from real signals: failures, alerts, quota, coverage. */
export async function fetchNotifications(signal?: AbortSignal): Promise<NotificationsResponse> {
  void signal;
  const orgId = await requireOrgId();

  const [failedScansRes, recentScansRes, subscriptionRes, storesRes] = await Promise.all([
    supabase
      .from("shelf_scans")
      .select("id, shelf_label, error_message, created_at")
      .eq("org_id", orgId)
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("shelf_scans")
      .select("id, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("subscriptions")
      .select("scans_used, subscription_plans(scan_quota)")
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase.from("stores").select("id, name").eq("org_id", orgId),
  ]);

  const items: DashboardNotification[] = [];

  for (const scan of failedScansRes.data ?? []) {
    items.push({
      id: `failed-${scan.id}`,
      kind: "confidence_warning",
      severity: "critical",
      title: scan.shelf_label ? `Scan failed — ${scan.shelf_label}` : "A scan failed to process",
      message: scan.error_message ? sanitizeUserMessage(scan.error_message) : undefined,
      created_at: scan.created_at,
      href: `/dashboard/scans/${scan.id}`,
    });
  }

  const recentScanIds = (recentScansRes.data ?? []).map((s) => s.id);
  if (recentScanIds.length) {
    const { data: results } = await supabase
      .from("scan_results")
      .select("scan_id, alerts")
      .in("scan_id", recentScanIds);
    for (const r of results ?? []) {
      const alerts = Array.isArray(r.alerts) ? (r.alerts as Array<Record<string, unknown>>) : [];
      for (const alert of alerts) {
        const severity = String(alert.severity ?? "").toLowerCase();
        if (severity === "critical" || severity === "high") {
          items.push({
            id: `alert-${r.scan_id}-${items.length}`,
            kind: "low_stock",
            severity: severity === "critical" ? "critical" : "warning",
            title: String(alert.title ?? alert.message ?? "Shelf alert"),
            message: typeof alert.description === "string" ? alert.description : undefined,
            href: `/dashboard/scans/${r.scan_id}`,
          });
        }
      }
    }
  }

  const sub = subscriptionRes.data as
    | { scans_used: number; subscription_plans: { scan_quota: number | null } | null }
    | null;
  const quota = sub?.subscription_plans?.scan_quota ?? null;
  if (sub && quota) {
    const pct = quota > 0 ? sub.scans_used / quota : 0;
    if (pct >= 1) {
      items.push({
        id: "quota-exceeded",
        kind: "subscription",
        severity: "critical",
        title: "You've used all of your included scans",
        message: "Upgrade your plan to keep scanning without interruption.",
        href: "/dashboard/billing",
      });
    } else if (pct >= 0.8) {
      items.push({
        id: "quota-nearing",
        kind: "subscription",
        severity: "warning",
        title: "You're nearing your monthly scan quota",
        message: `${sub.scans_used} of ${quota} scans used.`,
        href: "/dashboard/billing",
      });
    }
  }

  const storesWithScans = new Set<string>();
  const { data: storeScans } = await supabase
    .from("shelf_scans")
    .select("store_id")
    .eq("org_id", orgId)
    .not("store_id", "is", null);
  for (const row of storeScans ?? []) {
    if (row.store_id) storesWithScans.add(row.store_id);
  }
  for (const store of storesRes.data ?? []) {
    if (!storesWithScans.has(store.id)) {
      items.push({
        id: `no-scans-${store.id}`,
        kind: "announcement",
        severity: "info",
        title: `${store.name} has no scans yet`,
        message: "Run your first shelf scan for this store.",
        href: "/dashboard/scan",
      });
    }
  }

  return { items, unread: items.filter((i) => i.severity === "critical").length };
}

// ---------- analytics ----------

export type SeriesPoint = { label: string; value: number };

export type AnalyticsRange = "7d" | "30d" | "90d" | "12m";

export type AnalyticsResponse = {
  shelf_health_trend?: SeriesPoint[];
  daily_scans?: SeriesPoint[];
  weekly_scans?: SeriesPoint[];
  monthly_scans?: SeriesPoint[];
  brand_distribution?: SeriesPoint[];
  low_stock_trend?: SeriesPoint[];
};

function rangeToDays(range: AnalyticsRange): number {
  switch (range) {
    case "7d":
      return 7;
    case "90d":
      return 90;
    case "12m":
      return 365;
    default:
      return 30;
  }
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Chart series aggregated from shelf_scans/shelf_analytics and detected_products. */
export async function fetchAnalytics(
  range: AnalyticsRange = "30d",
  signal?: AbortSignal,
): Promise<AnalyticsResponse> {
  void signal;
  const orgId = await requireOrgId();
  const days = rangeToDays(range);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  const { data: scans, error } = await supabase
    .from("shelf_scans")
    .select("id, created_at, shelf_health_score, low_stock_count")
    .eq("org_id", orgId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true });
  if (error) dbError(error, "Could not load analytics.");

  const byDay = new Map<string, { scans: number; healthSum: number; healthCount: number; lowStock: number }>();
  for (const scan of scans ?? []) {
    const key = dayKey(scan.created_at);
    const bucket = byDay.get(key) ?? { scans: 0, healthSum: 0, healthCount: 0, lowStock: 0 };
    bucket.scans += 1;
    if (typeof scan.shelf_health_score === "number") {
      bucket.healthSum += scan.shelf_health_score;
      bucket.healthCount += 1;
    }
    bucket.lowStock += scan.low_stock_count ?? 0;
    byDay.set(key, bucket);
  }

  const sortedDays = Array.from(byDay.keys()).sort();
  const daily_scans: SeriesPoint[] = sortedDays.map((label) => ({ label, value: byDay.get(label)!.scans }));
  const shelf_health_trend: SeriesPoint[] = sortedDays.map((label) => {
    const bucket = byDay.get(label)!;
    return { label, value: bucket.healthCount ? Math.round(bucket.healthSum / bucket.healthCount) : 0 };
  });
  const low_stock_trend: SeriesPoint[] = sortedDays.map((label) => ({ label, value: byDay.get(label)!.lowStock }));

  const scanIds = (scans ?? []).map((s) => s.id);
  let brand_distribution: SeriesPoint[] = [];
  if (scanIds.length) {
    const { data: products } = await supabase
      .from("detected_products")
      .select("brand, stock_status")
      .in("scan_id", scanIds);
    const brandCounts = new Map<string, number>();
    for (const p of products ?? []) {
      const brand = p.brand?.trim();
      if (!brand) continue;
      brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1);
    }
    brand_distribution = Array.from(brandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label, value }));
  }

  return {
    shelf_health_trend,
    daily_scans,
    weekly_scans: undefined,
    monthly_scans: undefined,
    brand_distribution,
    low_stock_trend,
  };
}

// ---------- formatters (presentation only) ----------

export function formatNumber(value?: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "—";
}

export function formatQuota(value?: number | null): string {
  if (value === null) return "Unlimited";
  return formatNumber(value);
}

export function normalizePercent(value?: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value <= 1 ? value * 100 : value;
}

export function formatPercent(value?: number): string {
  const pct = normalizePercent(value);
  return pct === undefined ? "—" : `${Math.round(pct)}%`;
}

export function formatScore(value?: number): string {
  return typeof value === "number" && Number.isFinite(value) ? String(Math.round(value)) : "—";
}

export function formatDateTime(iso?: string | null): string {
  return formatDisplayDateTime(iso);
}

export function formatDate(iso?: string | null): string {
  return formatDisplayDate(iso);
}

export function healthTone(score?: number): "good" | "warn" | "bad" | "unknown" {
  if (typeof score !== "number" || !Number.isFinite(score)) return "unknown";
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  return "bad";
}
