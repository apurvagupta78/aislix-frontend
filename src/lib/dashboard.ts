// Admin dashboard contract.
//
// Every number rendered on the dashboard comes from these endpoints — there is
// no local dummy data and no client-side business logic. Bindings target the
// future FastAPI service on Railway (Supabase Auth for identity, Cashfree for
// billing).
//
//   GET /dashboard        — KPI summary, account summary, recent activity
//   GET /recent-scans     — paginated, searchable, sortable scan table
//   GET /notifications    — alerts, warnings and announcements
//   GET /analytics        — chart series (health, scans, brands, low stock)

const API_BASE = import.meta.env['VITE_SCAN_API_BASE'] ?? "";

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
    signal: signal ?? null,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Request failed (HTTP ${response.status}).`);
  }
  return (await response.json()) as T;
}

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

/** GET /dashboard */
export function fetchDashboard(signal?: AbortSignal): Promise<DashboardResponse> {
  return get<DashboardResponse>("/dashboard", signal);
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

/** GET /recent-scans */
export function fetchRecentScans(
  params: RecentScansQuery,
  signal?: AbortSignal,
): Promise<RecentScansResponse> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.store && params.store !== "all") search.set("store", params.store);
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.sort) search.set("sort", params.sort);
  search.set("page", String(params.page ?? 1));
  search.set("page_size", String(params.page_size ?? 8));
  return get<RecentScansResponse>(`/recent-scans?${search.toString()}`, signal);
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

/** GET /notifications */
export function fetchNotifications(signal?: AbortSignal): Promise<NotificationsResponse> {
  return get<NotificationsResponse>("/notifications", signal);
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

/** GET /analytics */
export function fetchAnalytics(
  range: AnalyticsRange = "30d",
  signal?: AbortSignal,
): Promise<AnalyticsResponse> {
  return get<AnalyticsResponse>(`/analytics?range=${range}`, signal);
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
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function healthTone(score?: number): "good" | "warn" | "bad" | "unknown" {
  if (typeof score !== "number" || !Number.isFinite(score)) return "unknown";
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  return "bad";
}
