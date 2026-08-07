// Organization & Store Management contract.
//
// Every value rendered by the organization module comes from these endpoints —
// there is no local dummy data. Bindings target the future FastAPI service on
// Railway (Supabase Auth for identity, Cashfree for billing).
//
//   GET    /organization
//   GET    /stores
//   POST   /stores
//   PUT    /stores/{id}
//   DELETE /stores/{id}
//   POST   /stores/{id}/archive        POST /stores/{id}/restore
//   GET    /stores/{id}                GET  /stores/{id}/metrics
//   GET    /stores/{id}/scans          GET  /stores/{id}/health-trend
//   GET    /stores/{id}/recommendations
//   GET    /stores/{id}/team           POST /stores/{id}/team
//   PUT    /stores/{id}/team/{memberId}   DELETE /stores/{id}/team/{memberId}
//   POST   /stores/bulk/import         GET  /stores/bulk/export
//   POST   /stores/bulk/archive        POST /stores/bulk/assign-users

import type { TeamRole } from "@/lib/account";

import { api } from "./api/client";

// ---------- types ----------

export type AccountStatus = "active" | "trialing" | "past_due" | "suspended" | "cancelled";

export type Organization = {
  id: string;
  name: string;
  logo_url?: string | null;
  plan_name?: string;
  plan_id?: string;
  account_status?: AccountStatus;
  total_stores?: number;
  active_stores?: number;
  archived_stores?: number;
  active_users?: number;
  scans_used?: number;
  scans_included?: number | null; // null = unlimited
  scans_remaining?: number | null;
  billing_period_end?: string | null;
  gst_number?: string | null;
};

export type StoreStatus = "active" | "archived";

export type StoreMetrics = {
  shelf_health_score?: number; // 0-100
  last_scan_at?: string | null;
  total_scans?: number;
  low_stock_alerts?: number;
  out_of_stock_alerts?: number;
  average_confidence?: number; // 0-1 or 0-100
};

export type OrgStore = {
  id: string;
  name: string;
  store_code?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  manager_name?: string;
  contact_number?: string;
  timezone?: string;
  status?: StoreStatus;
  created_at?: string;
  metrics?: StoreMetrics;
};

export type StoreInput = {
  name: string;
  store_code?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  manager_name?: string;
  contact_number?: string;
  timezone?: string;
};

export type StoreFilter = "all" | "active" | "archived" | "healthy" | "alerts";

export type StoreListQuery = {
  search?: string;
  filter?: StoreFilter;
  page?: number;
  page_size?: number;
};

export type StoreListResponse = {
  items: OrgStore[];
  total?: number;
  page?: number;
  page_size?: number;
};

export type StoreScan = {
  scan_id: string;
  captured_at?: string;
  status?: "completed" | "processing" | "queued" | "failed";
  shelf_health_score?: number;
  products_detected?: number;
  low_stock_products?: number;
  out_of_stock_products?: number;
  average_confidence?: number;
  report_url?: string | null;
};

export type HealthTrendPoint = {
  date: string;
  shelf_health_score?: number;
  average_confidence?: number;
};

export type StoreRecommendation = {
  id: string;
  title: string;
  detail?: string;
  impact?: "high" | "medium" | "low";
  category?: string;
};

export type StoreTeamMember = {
  id: string;
  name?: string;
  email: string;
  role: TeamRole;
  status?: "active" | "invited" | "suspended";
  added_at?: string;
};

export type StoreReport = {
  id: string;
  label: string;
  kind?: "pdf" | "csv" | "xlsx";
  period?: string;
  url?: string | null;
  generated_at?: string;
};

// ---------- transport ----------

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

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === "all") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

// ---------- organization ----------

/** GET /organization */
export const fetchOrganization = (signal?: AbortSignal) =>
  request<Organization>("/organization", { signal: signal ?? null });

// ---------- stores ----------

/** GET /stores */
export const fetchStoreList = (query: StoreListQuery = {}, signal?: AbortSignal) =>
  request<StoreListResponse>(
    `/stores${toQuery({
      search: query.search,
      filter: query.filter,
      page: query.page,
      page_size: query.page_size,
    })}`,
    { signal: signal ?? null },
  );

/** GET /stores/{id} */
export const fetchStore = (id: string, signal?: AbortSignal) =>
  request<OrgStore>(`/stores/${encodeURIComponent(id)}`, { signal: signal ?? null });

/** POST /stores */
export const createOrgStore = (input: StoreInput) =>
  request<OrgStore>("/stores", { method: "POST", body: JSON.stringify(input) });

/** PUT /stores/{id} */
export const updateOrgStore = (id: string, input: StoreInput) =>
  request<OrgStore>(`/stores/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

/** DELETE /stores/{id} */
export const deleteOrgStore = (id: string) =>
  request<void>(`/stores/${encodeURIComponent(id)}`, { method: "DELETE" });

/** POST /stores/{id}/archive */
export const archiveOrgStore = (id: string) =>
  request<OrgStore>(`/stores/${encodeURIComponent(id)}/archive`, { method: "POST" });

/** POST /stores/{id}/restore */
export const restoreOrgStore = (id: string) =>
  request<OrgStore>(`/stores/${encodeURIComponent(id)}/restore`, { method: "POST" });

// ---------- store dashboard ----------

/** GET /stores/{id}/metrics */
export const fetchStoreMetrics = (id: string, signal?: AbortSignal) =>
  request<StoreMetrics>(`/stores/${encodeURIComponent(id)}/metrics`, { signal: signal ?? null });

/** GET /stores/{id}/scans */
export const fetchStoreScans = (id: string, limit = 10, signal?: AbortSignal) =>
  request<{ items: StoreScan[]; total?: number }>(
    `/stores/${encodeURIComponent(id)}/scans${toQuery({ limit })}`,
    { signal: signal ?? null },
  );

/** GET /stores/{id}/health-trend */
export const fetchStoreHealthTrend = (id: string, days = 30, signal?: AbortSignal) =>
  request<{ points: HealthTrendPoint[] }>(
    `/stores/${encodeURIComponent(id)}/health-trend${toQuery({ days })}`,
    { signal: signal ?? null },
  );

/** GET /stores/{id}/recommendations */
export const fetchStoreRecommendations = (id: string, signal?: AbortSignal) =>
  request<{ items: StoreRecommendation[] }>(
    `/stores/${encodeURIComponent(id)}/recommendations`,
    { signal: signal ?? null },
  );

/** GET /stores/{id}/reports */
export const fetchStoreReports = (id: string, signal?: AbortSignal) =>
  request<{ items: StoreReport[] }>(`/stores/${encodeURIComponent(id)}/reports`, {
    signal: signal ?? null,
  });

// ---------- per-store team access ----------

/** GET /stores/{id}/team */
export const fetchStoreTeam = (id: string, signal?: AbortSignal) =>
  request<{ items: StoreTeamMember[] }>(`/stores/${encodeURIComponent(id)}/team`, {
    signal: signal ?? null,
  });

/** POST /stores/{id}/team */
export const addStoreMember = (id: string, input: { email: string; role: TeamRole }) =>
  request<StoreTeamMember>(`/stores/${encodeURIComponent(id)}/team`, {
    method: "POST",
    body: JSON.stringify(input),
  });

/** PUT /stores/{id}/team/{memberId} */
export const updateStoreMemberRole = (id: string, memberId: string, role: TeamRole) =>
  request<StoreTeamMember>(
    `/stores/${encodeURIComponent(id)}/team/${encodeURIComponent(memberId)}`,
    { method: "PUT", body: JSON.stringify({ role }) },
  );

/** DELETE /stores/{id}/team/{memberId} */
export const removeStoreMember = (id: string, memberId: string) =>
  request<void>(`/stores/${encodeURIComponent(id)}/team/${encodeURIComponent(memberId)}`, {
    method: "DELETE",
  });

// ---------- bulk operations (backend-bound, surfaced as coming soon in UI) ----------

/** POST /stores/bulk/import — multipart CSV of stores. */
export function importStoresCsv(file: File): Promise<{ created: number; failed: number }> {
  const form = new FormData();
  form.append("file", file);
  return api.postForm<{ created: number; failed: number }>("/stores/bulk/import", form);
}

/** GET /stores/bulk/export */
export const exportStoreList = (filter?: StoreFilter) =>
  request<{ download_url?: string; status?: string }>(
    `/stores/bulk/export${toQuery({ filter })}`,
  );

/** POST /stores/bulk/archive */
export const bulkArchiveStores = (ids: string[]) =>
  request<{ archived: number }>("/stores/bulk/archive", {
    method: "POST",
    body: JSON.stringify({ store_ids: ids }),
  });

/** POST /stores/bulk/assign-users */
export const bulkAssignUsers = (input: { store_ids: string[]; emails: string[]; role: TeamRole }) =>
  request<{ assigned: number }>("/stores/bulk/assign-users", {
    method: "POST",
    body: JSON.stringify(input),
  });

// ---------- formatting helpers (presentation only) ----------

export const accountStatusLabels: Record<AccountStatus, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment due",
  suspended: "Suspended",
  cancelled: "Cancelled",
};

export const storeFilterLabels: Record<StoreFilter, string> = {
  all: "All stores",
  active: "Active",
  archived: "Archived",
  healthy: "Healthy stores",
  alerts: "Stores with alerts",
};

export function formatNumber(value?: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-IN") : "—";
}

/** Accepts 0-1 or 0-100 confidence and renders a percentage. */
export function formatConfidence(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const pct = value <= 1 ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

export function formatScore(value?: number): string {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}` : "—";
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function storeLocation(store: OrgStore): string {
  return [store.city, store.state, store.country].filter(Boolean).join(", ");
}

export function healthTone(score?: number): "good" | "warn" | "bad" | "unknown" {
  if (typeof score !== "number" || !Number.isFinite(score)) return "unknown";
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

export function scansRemaining(org?: Organization): number | null | undefined {
  if (!org) return undefined;
  if (typeof org.scans_remaining === "number") return org.scans_remaining;
  if (org.scans_included === null) return null; // unlimited
  if (typeof org.scans_included === "number" && typeof org.scans_used === "number") {
    return Math.max(0, org.scans_included - org.scans_used);
  }
  return undefined;
}

export function usagePercent(org?: Organization): number | null {
  if (!org || typeof org.scans_used !== "number" || typeof org.scans_included !== "number") {
    return null;
  }
  if (org.scans_included <= 0) return null;
  return Math.min(100, Math.round((org.scans_used / org.scans_included) * 100));
}
