// Organization & Store Management — live Supabase queries.
//
// Every value rendered by the organization module is sourced from the
// database via the helpers in `@/lib/db/context`. There is no mock data.

import type { TeamRole } from "@/lib/account";

import { supabase } from "@/integrations/supabase/client";
import {
  dbError,
  getMembership,
  notFound,
  requireOrgId,
  requireUserId,
} from "@/lib/db/context";

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
  user_id?: string;
  name?: string;
  email: string;
  role: TeamRole;
  status?: "active" | "invited" | "suspended";
  added_at?: string;
  /** True when the member has org-wide access rather than an explicit scope. */
  all_stores?: boolean;
};


export type StoreReport = {
  id: string;
  label: string;
  kind?: "pdf" | "csv" | "xlsx";
  period?: string;
  url?: string | null;
  generated_at?: string;
};


function compact<T>(obj: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}

// ---------- role mapping (TeamRole <-> app_role) ----------
// account.ts's TeamRole uses "manager" where the database's app_role enum
// uses "store_manager". Map between the two at the boundary.

type AppRole = "owner" | "admin" | "store_manager" | "viewer";

function toAppRole(role: TeamRole): AppRole {
  return role === "manager" ? "store_manager" : role;
}

function toTeamRole(role: AppRole): TeamRole {
  return role === "store_manager" ? "manager" : role;
}

// ---------- store row mapping ----------

function mapStoreRow(row: {
  id: string;
  name: string;
  code: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  status: string;
  created_at: string;
}): OrgStore {
  const address = [row.address_line1, row.address_line2].filter(Boolean).join(", ") || undefined;
  return compact({
    id: row.id,
    name: row.name,
    store_code: row.code ?? undefined,
    address,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    country: row.country ?? undefined,
    manager_name: row.contact_name ?? undefined,
    contact_number: row.contact_phone ?? undefined,
    status: row.status === "inactive" ? "archived" : "active",
    created_at: row.created_at,
  });
}

function storeInputToRow(input: StoreInput) {
  return {
    name: input.name,
    code: input.store_code ?? null,
    address_line1: input.address ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    country: input.country ?? null,
    contact_name: input.manager_name ?? null,
    contact_phone: input.contact_number ?? null,
  };
}

async function attachStoreMetrics(stores: OrgStore[]): Promise<OrgStore[]> {
  if (stores.length === 0) return stores;
  const ids = stores.map((s) => s.id);
  const { data: scans, error } = await supabase
    .from("shelf_scans")
    .select(
      "store_id, shelf_health_score, low_stock_count, out_of_stock_count, created_at, status",
    )
    .in("store_id", ids)
    .order("created_at", { ascending: false });
  if (error) dbError(error, "Could not load store metrics.");

  const byStore = new Map<string, typeof scans>();
  for (const scan of scans ?? []) {
    if (!scan.store_id) continue;
    const list = byStore.get(scan.store_id) ?? [];
    list.push(scan);
    byStore.set(scan.store_id, list);
  }

  return stores.map((store) => {
    const rows = byStore.get(store.id) ?? [];
    if (rows.length === 0) return store;
    const scoreRows = rows.filter((r) => typeof r.shelf_health_score === "number");
    const avgScore =
      scoreRows.length > 0
        ? scoreRows.reduce((sum, r) => sum + (r.shelf_health_score ?? 0), 0) / scoreRows.length
        : undefined;
    const metrics: StoreMetrics = compact({
      shelf_health_score: avgScore,
      last_scan_at: rows[0]?.created_at ?? null,
      total_scans: rows.length,
      low_stock_alerts: rows.reduce((sum, r) => sum + (r.low_stock_count ?? 0), 0),
      out_of_stock_alerts: rows.reduce((sum, r) => sum + (r.out_of_stock_count ?? 0), 0),
    });
    return { ...store, metrics };
  });
}

// ---------- organization ----------

export async function fetchOrganization(_signal?: AbortSignal): Promise<Organization> {
  const orgId = await requireOrgId();

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, logo_url")
    .eq("id", orgId)
    .maybeSingle();
  if (orgError) dbError(orgError, "Could not load your organization.");
  if (!org) notFound("Organization not found.");

  const [{ count: totalStores }, { count: activeStores }, { count: archivedStores }] =
    await Promise.all([
      supabase.from("stores").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabase
        .from("stores")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "active"),
      supabase
        .from("stores")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "inactive"),
    ]);

  const { count: activeUsers } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "active");

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(
      "status, current_period_end, scans_used, plan_id, subscription_plans(id, name, scan_quota)",
    )
    .eq("org_id", orgId)
    .maybeSingle();

  const plan = subscription?.subscription_plans as
    | { id: string; name: string; scan_quota: number | null }
    | null
    | undefined;

  return compact({
    id: org.id,
    name: org.name,
    logo_url: org.logo_url,
    plan_name: plan?.name,
    plan_id: plan?.id ?? subscription?.plan_id,
    account_status: (subscription?.status as AccountStatus | undefined) ?? undefined,
    total_stores: totalStores ?? undefined,
    active_stores: activeStores ?? undefined,
    archived_stores: archivedStores ?? undefined,
    active_users: activeUsers ?? undefined,
    scans_used: subscription?.scans_used ?? undefined,
    scans_included: plan?.scan_quota ?? null,
    scans_remaining:
      typeof plan?.scan_quota === "number" && typeof subscription?.scans_used === "number"
        ? Math.max(0, plan.scan_quota - subscription.scans_used)
        : plan?.scan_quota === null
          ? null
          : undefined,
    billing_period_end: subscription?.current_period_end ?? null,
    gst_number: org.gstin ?? null,
  });
}

// ---------- stores ----------

export async function fetchStoreList(
  query: StoreListQuery = {},
  _signal?: AbortSignal,
): Promise<StoreListResponse> {
  const orgId = await requireOrgId();
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let builder = supabase.from("stores").select("*", { count: "exact" }).eq("org_id", orgId);

  if (query.search) {
    const q = query.search.replace(/[%,]/g, "");
    builder = builder.or(
      `name.ilike.%${q}%,code.ilike.%${q}%,city.ilike.%${q}%,contact_name.ilike.%${q}%`,
    );
  }
  if (query.filter === "active") builder = builder.eq("status", "active");
  if (query.filter === "archived") builder = builder.eq("status", "inactive");

  builder = builder.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await builder;
  if (error) dbError(error, "Could not load stores.");

  let items = (data ?? []).map(mapStoreRow);
  try {
    items = await attachStoreMetrics(items);
  } catch {
    // Metrics are best-effort: never hide stores because analytics failed.
  }

  if (query.filter === "healthy") {
    items = items.filter((s) => (s.metrics?.shelf_health_score ?? 0) >= 80);
  }
  if (query.filter === "alerts") {
    items = items.filter(
      (s) => (s.metrics?.out_of_stock_alerts ?? 0) > 0 || (s.metrics?.low_stock_alerts ?? 0) > 0,
    );
  }

  return { items, total: count ?? items.length, page, page_size: pageSize };
}

export async function fetchStore(id: string, _signal?: AbortSignal): Promise<OrgStore> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) dbError(error, "Could not load the store.");
  if (!data) notFound("Store not found.");
  try {
    const [store] = await attachStoreMetrics([mapStoreRow(data)]);
    return store!;
  } catch {
    return mapStoreRow(data);
  }
}

export async function createOrgStore(input: StoreInput): Promise<OrgStore> {
  const orgId = await requireOrgId();
  const { assertCanAddStore, mapLimitError } = await import("@/lib/subscription-limits");
  await assertCanAddStore(orgId);
  const { data, error } = await supabase

    .from("stores")
    .insert({ org_id: orgId, ...storeInputToRow(input) })
    .select("*")
    .single();
  if (error) {
    const mapped = await mapLimitError(error, orgId);
    if (mapped !== error) throw mapped;
    dbError(error, "Could not create the store.");
  }
  return mapStoreRow(data!);
}

export async function updateOrgStore(id: string, input: StoreInput): Promise<OrgStore> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("stores")
    .update(storeInputToRow(input))
    .eq("org_id", orgId)
    .eq("id", id)
    .select("*")
    .single();
  if (error) dbError(error, "Could not update the store.");
  return mapStoreRow(data!);
}

export async function deleteOrgStore(id: string): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase.from("stores").delete().eq("org_id", orgId).eq("id", id);
  if (error) dbError(error, "Could not delete the store.");
}

export async function archiveOrgStore(id: string): Promise<OrgStore> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("stores")
    .update({ status: "inactive" })
    .eq("org_id", orgId)
    .eq("id", id)
    .select("*")
    .single();
  if (error) dbError(error, "Could not archive the store.");
  return mapStoreRow(data!);
}

export async function restoreOrgStore(id: string): Promise<OrgStore> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("stores")
    .update({ status: "active" })
    .eq("org_id", orgId)
    .eq("id", id)
    .select("*")
    .single();
  if (error) dbError(error, "Could not restore the store.");
  return mapStoreRow(data!);
}

// ---------- store dashboard ----------

export async function fetchStoreMetrics(
  id: string,
  _signal?: AbortSignal,
): Promise<StoreMetrics> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("shelf_scans")
    .select("shelf_health_score, low_stock_count, out_of_stock_count, created_at")
    .eq("org_id", orgId)
    .eq("store_id", id)
    .order("created_at", { ascending: false });
  if (error) dbError(error, "Could not load store metrics.");

  const rows = data ?? [];
  const scoreRows = rows.filter((r) => typeof r.shelf_health_score === "number");
  return compact({
    shelf_health_score:
      scoreRows.length > 0
        ? scoreRows.reduce((sum, r) => sum + (r.shelf_health_score ?? 0), 0) / scoreRows.length
        : undefined,
    last_scan_at: rows[0]?.created_at ?? null,
    total_scans: rows.length,
    low_stock_alerts: rows.reduce((sum, r) => sum + (r.low_stock_count ?? 0), 0),
    out_of_stock_alerts: rows.reduce((sum, r) => sum + (r.out_of_stock_count ?? 0), 0),
  });
}

export async function fetchStoreScans(
  id: string,
  limit = 10,
  _signal?: AbortSignal,
): Promise<{ items: StoreScan[]; total?: number }> {
  const orgId = await requireOrgId();
  const { data, error, count } = await supabase
    .from("shelf_scans")
    .select(
      "id, created_at, status, shelf_health_score, total_products, low_stock_count, out_of_stock_count",
      { count: "exact" },
    )
    .eq("org_id", orgId)
    .eq("store_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) dbError(error, "Could not load store scans.");

  const items: StoreScan[] = (data ?? []).map((row) => compact({
    scan_id: row.id,
    captured_at: row.created_at,
    status: row.status as StoreScan["status"],
    shelf_health_score: row.shelf_health_score ?? undefined,
    products_detected: row.total_products,
    low_stock_products: row.low_stock_count,
    out_of_stock_products: row.out_of_stock_count,
  }));

  return { items, total: count ?? items.length };
}

export async function fetchStoreHealthTrend(
  id: string,
  days = 30,
  _signal?: AbortSignal,
): Promise<{ points: HealthTrendPoint[] }> {
  const orgId = await requireOrgId();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("shelf_analytics")
    .select("period_date, avg_shelf_health")
    .eq("org_id", orgId)
    .eq("store_id", id)
    .gte("period_date", since)
    .order("period_date", { ascending: true });
  if (error) dbError(error, "Could not load the health trend.");

  const points: HealthTrendPoint[] = (data ?? []).map((row) => compact({
    date: row.period_date,
    shelf_health_score: row.avg_shelf_health ?? undefined,
  }));

  return { points };
}

export async function fetchStoreRecommendations(
  id: string,
  _signal?: AbortSignal,
): Promise<{ items: StoreRecommendation[] }> {
  const orgId = await requireOrgId();
  const { data: scans, error: scansError } = await supabase
    .from("shelf_scans")
    .select("id")
    .eq("org_id", orgId)
    .eq("store_id", id)
    .order("created_at", { ascending: false })
    .limit(5);
  if (scansError) dbError(scansError, "Could not load store recommendations.");

  const scanIds = (scans ?? []).map((s) => s.id);
  if (scanIds.length === 0) return { items: [] };

  const { data: results, error: resultsError } = await supabase
    .from("scan_results")
    .select("id, scan_id, recommendations")
    .in("scan_id", scanIds);
  if (resultsError) dbError(resultsError, "Could not load store recommendations.");

  const items: StoreRecommendation[] = [];
  for (const result of results ?? []) {
    const recs = Array.isArray(result.recommendations) ? result.recommendations : [];
    for (const rec of recs) {
      if (rec && typeof rec === "object") {
        const r = rec as Record<string, unknown>;
        items.push(compact({
          id: `${result.id}-${items.length}`,
          title: typeof r["title"] === "string" ? (r["title"] as string) : String(r["title"] ?? "Recommendation"),
          detail: typeof r["detail"] === "string" ? (r["detail"] as string) : undefined,
          impact: (r["impact"] as StoreRecommendation["impact"]) ?? undefined,
          category: typeof r["category"] === "string" ? (r["category"] as string) : undefined,
        }));
      }
    }
  }

  return { items };
}

export async function fetchStoreReports(
  id: string,
  _signal?: AbortSignal,
): Promise<{ items: StoreReport[] }> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("shelf_scans")
    .select("id, shelf_label, created_at, status")
    .eq("org_id", orgId)
    .eq("store_id", id)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) dbError(error, "Could not load store reports.");

  const items: StoreReport[] = (data ?? []).map((row) => ({
    id: row.id,
    label: row.shelf_label ?? "Shelf scan report",
    generated_at: row.created_at,
  }));

  return { items };
}

// ---------- per-store team access ----------

/**
 * Team with access to a store: members explicitly scoped to it, plus members
 * with no store scope at all (owners / admins / managers see every store).
 */
export async function fetchStoreTeam(
  id: string,
  _signal?: AbortSignal,
): Promise<{ items: StoreTeamMember[] }> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, user_id, role, status, store_ids, invited_email, created_at")
    .eq("org_id", orgId);
  if (error) dbError(error, "Could not load the store team.");

  const rows = (data ?? []).filter((row) => {
    const storeIds = (row.store_ids ?? []) as string[];
    return storeIds.length === 0 || storeIds.includes(id);
  });
  const userIds = rows.map((r) => r.user_id).filter(Boolean);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const items: StoreTeamMember[] = rows.map((row) => {
    const profile = profileById.get(row.user_id);
    return compact({
      id: row.id,
      user_id: row.user_id,
      name: profile?.full_name ?? undefined,
      email: profile?.email ?? row.invited_email ?? "",
      role: toTeamRole(row.role as AppRole),
      status: row.status,
      added_at: row.created_at,
      all_stores: ((row.store_ids ?? []) as string[]).length === 0,
    });
  });

  return { items };
}

/** Appends a store to the store scope of the given members (deduped). */
export async function grantStoreAccess(storeId: string, userIds: string[]): Promise<void> {
  if (!userIds.length) return;
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, user_id, store_ids")
    .eq("org_id", orgId)
    .in("user_id", userIds);
  if (error) dbError(error, "Could not update store access.");

  for (const row of data ?? []) {
    const current = (row.store_ids ?? []) as string[];
    if (current.includes(storeId)) continue;
    const merged = Array.from(new Set([...current, storeId]));
    const { error: updateError } = await supabase
      .from("organization_members")
      .update({ store_ids: merged })
      .eq("id", row.id);
    if (updateError) dbError(updateError, "Could not update store access.");
  }
}


export async function addStoreMember(
  id: string,
  input: { email: string; role: TeamRole },
): Promise<StoreTeamMember> {
  const orgId = await requireOrgId();
  const inviterId = await requireUserId();

  const { data: existing } = await supabase
    .from("organization_members")
    .select("id, store_ids")
    .eq("org_id", orgId)
    .eq("invited_email", input.email)
    .maybeSingle();

  if (existing) {
    const storeIds = Array.from(new Set([...(existing.store_ids ?? []), id]));
    const { data, error } = await supabase
      .from("organization_members")
      .update({ store_ids: storeIds, role: toAppRole(input.role) })
      .eq("id", existing.id)
      .select("id, role, status, invited_email, created_at")
      .single();
    if (error) dbError(error, "Could not add the store member.");
    return {
      id: data!.id,
      email: data!.invited_email ?? input.email,
      role: toTeamRole(data!.role as AppRole),
      status: data!.status,
      added_at: data!.created_at,
    };
  }

  const { data, error } = await supabase
    .from("organization_members")
    .insert({
      org_id: orgId,
      user_id: inviterId,
      role: toAppRole(input.role),
      status: "invited",
      invited_email: input.email,
      invited_by: inviterId,
      store_ids: [id],
    })
    .select("id, role, status, invited_email, created_at")
    .single();
  if (error) dbError(error, "Could not add the store member.");

  return {
    id: data!.id,
    email: data!.invited_email ?? input.email,
    role: toTeamRole(data!.role as AppRole),
    status: data!.status,
    added_at: data!.created_at,
  };
}

export async function updateStoreMemberRole(
  _id: string,
  memberId: string,
  role: TeamRole,
): Promise<StoreTeamMember> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("organization_members")
    .update({ role: toAppRole(role) })
    .eq("org_id", orgId)
    .eq("id", memberId)
    .select("id, role, status, invited_email, created_at")
    .single();
  if (error) dbError(error, "Could not update the member role.");

  return {
    id: data!.id,
    email: data!.invited_email ?? "",
    role: toTeamRole(data!.role as AppRole),
    status: data!.status,
    added_at: data!.created_at,
  };
}

export async function removeStoreMember(id: string, memberId: string): Promise<void> {
  const orgId = await requireOrgId();
  const { data, error: fetchError } = await supabase
    .from("organization_members")
    .select("store_ids")
    .eq("org_id", orgId)
    .eq("id", memberId)
    .maybeSingle();
  if (fetchError) dbError(fetchError, "Could not remove the store member.");
  if (!data) return;

  const storeIds = (data.store_ids ?? []).filter((sid: string) => sid !== id);
  const { error } = await supabase
    .from("organization_members")
    .update({ store_ids: storeIds })
    .eq("org_id", orgId)
    .eq("id", memberId);
  if (error) dbError(error, "Could not remove the store member.");
}

// ---------- bulk operations ----------

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0]!.split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
}

export async function importStoresCsv(file: File): Promise<{ created: number; failed: number }> {
  const orgId = await requireOrgId();
  const text = await file.text();
  const rows = parseCsv(text);

  const { assertCanAddStore } = await import("@/lib/subscription-limits");
  let allowance = await assertCanAddStore();
  let remaining = allowance.stores_remaining;

  let created = 0;
  let failed = 0;

  for (const row of rows) {
    const name = row["name"] || row["Name"];
    if (!name) {
      failed += 1;
      continue;
    }
    if (remaining !== null && remaining <= 0) {
      // Plan store limit reached — surface the same limit modal as single adds.
      allowance = await assertCanAddStore();
      remaining = allowance.stores_remaining;
    }

    const { error } = await supabase.from("stores").insert({
      org_id: orgId,
      name,
      code: row["store_code"] || row["code"] || null,
      address_line1: row["address"] || null,
      city: row["city"] || null,
      state: row["state"] || null,
      country: row["country"] || null,
      contact_name: row["manager_name"] || null,
      contact_phone: row["contact_number"] || null,
    });
    if (error) failed += 1;
    else {
      created += 1;
      if (remaining !== null) remaining -= 1;
    }

  }

  return { created, failed };
}

export async function exportStoreList(
  filter?: StoreFilter,
): Promise<{ download_url?: string; status?: string }> {
  const { items } = await fetchStoreList(compact({ filter, page: 1, page_size: 1000 }));
  const headers = ["name", "store_code", "address", "city", "state", "country", "status"];
  const lines = [headers.join(",")];
  for (const store of items) {
    lines.push(
      headers
        .map((key) => String((store as unknown as Record<string, unknown>)[key] ?? ""))
        .join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const download_url = URL.createObjectURL(blob);
  return { download_url, status: "ready" };
}

export async function bulkArchiveStores(ids: string[]): Promise<{ archived: number }> {
  const orgId = await requireOrgId();
  const { error, data } = await supabase
    .from("stores")
    .update({ status: "inactive" })
    .eq("org_id", orgId)
    .in("id", ids)
    .select("id");
  if (error) dbError(error, "Could not archive the selected stores.");
  return { archived: data?.length ?? ids.length };
}

export async function bulkAssignUsers(input: {
  store_ids: string[];
  emails: string[];
  role: TeamRole;
}): Promise<{ assigned: number }> {
  let assigned = 0;
  for (const storeId of input.store_ids) {
    for (const email of input.emails) {
      await addStoreMember(storeId, { email, role: input.role });
      assigned += 1;
    }
  }
  return { assigned };
}

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
