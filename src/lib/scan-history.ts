// Live Supabase-backed scan history: search, filter, sort and paginate
// shelf_scans for the signed-in user's active organization.

export type ScanStatus = "completed" | "processing" | "failed";

/** Assignment lifecycle mirrored from scan_assignments.status. */
export type ScanAssignmentStatus =
  | "pending"
  | "in_progress"
  | "needs_correction"
  | "completed"
  | "cancelled";

export type AuditModeFilter = "all" | "ai" | "digital";

export type ScanHistoryItem = {
  scan_id: string;
  store: string;
  location?: string;
  category?: string;
  created_at: string; // ISO timestamp
  products_detected?: number;
  low_stock_products?: number;
  average_confidence?: number; // 0-1 or 0-100
  processing_time_ms?: number;
  status: ScanStatus;
  audit_mode?: "ai" | "digital" | "ai_assisted";
  /** Set when the scan was run against a delegated assignment. */
  assignment_id?: string | null;
  assignment_status?: ScanAssignmentStatus | null;
  /** Planogram compliance of the assignment attempt, 0-100. */
  planogram_compliance?: number | null;
  assignee_name?: string | null;
  assignee_id?: string | null;
  /** User who ran/submitted the scan (shelf_scans.created_by). */
  conducted_by_name?: string | null;
  conducted_by_id?: string | null;
  downloads?: {
    pdf_url?: string;
    csv_url?: string;
    annotated_image_url?: string;
  };
};

export type ScanHistoryResponse = {
  items: ScanHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  stores?: string[];
  /** Assignees present in the org, for the reports filter. */
  assignees?: { id: string; name: string }[];
};

export type ScanTypeFilter = "all" | "assigned" | "adhoc";

export type ScanHistoryQuery = {
  q?: string;
  store?: string;
  date?: string; // YYYY-MM-DD
  date_from?: string;
  date_to?: string;
  sort?: "newest" | "oldest" | "processing_time";
  page?: number;
  page_size?: number;
  /** Assigned vs ad-hoc scans. */
  type?: ScanTypeFilter;
  /** Filter by assignment status (assigned scans only). */
  assignment_status?: ScanAssignmentStatus | "all";
  /** Filter by the assignee of the linked assignment. */
  assignee?: string | "all";
  /** Filter by audit execution mode (Wave 5 unified history). */
  audit_mode?: AuditModeFilter;
};

import { supabase } from "@/integrations/supabase/client";
import { dbError, getMembership, requireOrgId, requireUserId } from "@/lib/db/context";

const MANAGER_ROLES = ["owner", "admin", "manager"];

function toApiStatus(status: string): ScanStatus {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "processing"; // queued, processing
}


/** Paginated, filtered, sorted scan history for the active organization. */
export async function fetchScanHistory(
  params: ScanHistoryQuery,
  _signal?: AbortSignal,
): Promise<ScanHistoryResponse> {
  const orgId = await requireOrgId();
  const membership = await getMembership();
  const isManager = MANAGER_ROLES.includes(String(membership?.role ?? "").toLowerCase());
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Free plan only shows the last 7 days. Data is never deleted, just filtered.
  const { fetchHistoryCutoffIso } = await import("@/lib/subscription-limits");
  const cutoff = await fetchHistoryCutoffIso();

  // Assignment-based filters resolve to a concrete id list first so pagination
  // and the total count stay correct.
  let assignmentIdFilter: string[] | null = null;
  const wantsAssignmentStatus = params.assignment_status && params.assignment_status !== "all";
  const wantsAssignee = params.assignee && params.assignee !== "all";
  if (wantsAssignmentStatus || wantsAssignee) {
    let assignmentQuery = supabase.from("scan_assignments").select("id").eq("org_id", orgId);
    if (wantsAssignmentStatus) assignmentQuery = assignmentQuery.eq("status", params.assignment_status!);
    if (wantsAssignee) assignmentQuery = assignmentQuery.eq("assignee_id", params.assignee!);
    const { data: assignmentRows } = await assignmentQuery;
    assignmentIdFilter = (assignmentRows ?? []).map((row) => row.id as string);
    if (assignmentIdFilter.length === 0) {
      return { items: [], total: 0, page, page_size: pageSize, stores: [], assignees: [] };
    }
  }

  let query = supabase
    .from("shelf_scans")
    .select(
      "id, status, audit_mode, shelf_label, category, total_products, low_stock_count, out_of_stock_count, processing_started_at, processing_completed_at, created_at, store_id, created_by, finalized_by, assignment_id, stores(name)",
      { count: "exact" },
    )
    .eq("org_id", orgId);

  if (params.audit_mode && params.audit_mode !== "all") {
    query = query.eq("audit_mode", params.audit_mode);
  }

  // Managers see every scan in the active organization. Members' history is
  // their completed assigned work, irrespective of who created the scan row.
  if (!isManager) {
    const userId = await requireUserId();
    const { data: myAssignments, error: assignmentError } = await supabase
      .from("scan_assignments")
      .select("id")
      .eq("assignee_id", userId)
      .eq("status", "completed");
    if (assignmentError) dbError(assignmentError, "Could not load your completed audits.");
    const myAssignmentIds = (myAssignments ?? []).map((row) => row.id as string);
    if (myAssignmentIds.length === 0) {
      return { items: [], total: 0, page, page_size: pageSize, stores: [], assignees: [] };
    }
    query = query.eq("status", "completed").in("assignment_id", myAssignmentIds);
  }

  if (cutoff) query = query.gte("created_at", cutoff);

  if (params.store && params.store !== "all") {
    query = query.eq("store_id", params.store);
  }
  if (params.type === "assigned") query = query.not("assignment_id", "is", null);
  if (params.type === "adhoc") query = query.is("assignment_id", null);
  if (assignmentIdFilter) query = query.in("assignment_id", assignmentIdFilter);
  if (params.date) {
    const start = `${params.date}T00:00:00.000Z`;
    const end = `${params.date}T23:59:59.999Z`;
    query = query.gte("created_at", start).lte("created_at", end);
  }
  if (params.date_from) query = query.gte("created_at", `${params.date_from}T00:00:00.000Z`);
  if (params.date_to) query = query.lte("created_at", `${params.date_to}T23:59:59.999Z`);
  if (params.q) {
    query = query.or(
      `shelf_label.ilike.%${params.q}%,category.ilike.%${params.q}%`,
    );
  }

  if (params.sort === "oldest") {
    query = query.order("created_at", { ascending: true });
  } else {
    // "newest" default; processing_time sort applied client-side below since
    // it depends on two computed timestamps.
    query = query.order("created_at", { ascending: false });
  }

  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) return dbError(error, "Could not load audit history.");


  let items = (data ?? []).map((row: any): ScanHistoryItem => {
    const startedAt = row.processing_started_at ? new Date(row.processing_started_at).getTime() : undefined;
    const completedAt = row.processing_completed_at ? new Date(row.processing_completed_at).getTime() : undefined;
    const processingTimeMs =
      startedAt !== undefined && completedAt !== undefined ? completedAt - startedAt : undefined;
    const item: ScanHistoryItem = {
      scan_id: row.id as string,
      store: (row.stores?.name as string | undefined) ?? "—",
      created_at: row.created_at as string,
      status: toApiStatus(row.status as string),
      audit_mode: ((row as { audit_mode?: string }).audit_mode ?? "ai") as ScanHistoryItem["audit_mode"],
    };
    if (row.shelf_label) item.location = row.shelf_label as string;
    if (row.category) item.category = row.category as string;
    if (row.total_products !== null && row.total_products !== undefined) {
      item.products_detected = row.total_products;
    }
    if (row.low_stock_count !== null && row.out_of_stock_count !== null) {
      // Low stock counts only "low_stock" products — out of stock is a separate metric.
      item.low_stock_products = row.low_stock_count ?? 0;
    }
    if (processingTimeMs !== undefined) {
      item.processing_time_ms = processingTimeMs;
    }
    item.assignment_id = (row.assignment_id as string | null) ?? null;
    // Conducted by = who finalized the audit — never fall back to created_by.
    item.conducted_by_id = (row.finalized_by as string | null) ?? null;
    return item;
  });

  // Assignment context: status, compliance and the assignee who ran it.
  const assignmentIds = Array.from(
    new Set(items.map((item) => item.assignment_id).filter((id): id is string => Boolean(id))),
  );
  const conductorIds = Array.from(
    new Set(items.map((item) => item.conducted_by_id).filter((id): id is string => Boolean(id))),
  );
  if (assignmentIds.length || conductorIds.length) {
    const { data: assignmentRows } = assignmentIds.length
      ? await supabase
          .from("scan_assignments")
          .select("id, status, last_compliance_percent, assignee_id")
          .in("id", assignmentIds)
      : { data: [] as { id: string; status: string; last_compliance_percent: number | null; assignee_id: string | null }[] };
    const assigneeIds = Array.from(
      new Set((assignmentRows ?? []).map((row) => row.assignee_id as string).filter(Boolean)),
    );
    const profileIds = Array.from(new Set([...assigneeIds, ...conductorIds]));
    const { data: profileRows } = profileIds.length
      ? await supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
    const profileById = new Map((profileRows ?? []).map((row) => [row.id as string, row]));
    const assignmentById = new Map((assignmentRows ?? []).map((row) => [row.id as string, row]));
    for (const item of items) {
      if (item.conducted_by_id) {
        const profile = profileById.get(item.conducted_by_id);
        item.conducted_by_name = profile?.full_name ?? profile?.email ?? null;
      }
      if (!item.assignment_id) continue;
      const assignment = assignmentById.get(item.assignment_id);
      if (!assignment) continue;
      item.assignment_status = assignment.status as ScanAssignmentStatus;
      item.planogram_compliance =
        assignment.last_compliance_percent === null ||
        assignment.last_compliance_percent === undefined
          ? null
          : Number(assignment.last_compliance_percent);
      item.assignee_id = (assignment.assignee_id as string | null) ?? null;
      const profile = assignment.assignee_id ? profileById.get(assignment.assignee_id as string) : undefined;
      item.assignee_name = profile?.full_name ?? profile?.email ?? null;
    }
  }

  // Attach signed download URLs (PDF report, annotated image, CSV) for these scans.
  const { resolveScanAssetUrls } = await import("@/lib/scan-results");
  await Promise.all(
    items.map(async (item) => {
      if (item.status !== "completed") return;
      const urls = await resolveScanAssetUrls(item.scan_id);
      const downloads: NonNullable<ScanHistoryItem["downloads"]> = {};
      if (urls.pdf_url) downloads.pdf_url = urls.pdf_url;
      if (urls.csv_url) downloads.csv_url = urls.csv_url;
      if (urls.annotated_image_url) downloads.annotated_image_url = urls.annotated_image_url;
      if (Object.keys(downloads).length > 0) item.downloads = downloads;
    }),
  );


  if (params.sort === "processing_time") {
    items = [...items].sort((a, b) => (b.processing_time_ms ?? 0) - (a.processing_time_ms ?? 0));
  }

  const { data: storeRows } = await supabase.from("stores").select("name").eq("org_id", orgId);
  const stores = Array.from(new Set((storeRows ?? []).map((s) => s.name as string))).sort();

  // Assignee options for the reports filter (managers only need this list).
  let assignees: { id: string; name: string }[] = [];
  if (isManager) {
    const { data: memberRows } = await supabase
      .from("organization_members")
      .select("user_id, invited_email, profiles:user_id (full_name, email)")
      .eq("org_id", orgId);
    assignees = (memberRows ?? [])
      .map((row) => {
        const profile = (row as { profiles?: { full_name?: string | null; email?: string | null } | null })
          .profiles;
        return {
          id: row.user_id as string,
          name: profile?.full_name ?? profile?.email ?? (row.invited_email as string | null) ?? "Member",
        };
      })
      .filter((row) => Boolean(row.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    items,
    total: count ?? items.length,
    page,
    page_size: pageSize,
    stores,
    assignees,

  };
}

/** Deletes a shelf scan row (and its storage objects, if any). */
export async function deleteScan(scanId: string): Promise<void> {
  const orgId = await requireOrgId();

  const { data: images } = await supabase
    .from("scan_images")
    .select("storage_bucket, storage_path")
    .eq("scan_id", scanId);

  if (images && images.length > 0) {
    const byBucket = new Map<string, string[]>();
    for (const img of images) {
      const bucket = img.storage_bucket as string;
      const list = byBucket.get(bucket) ?? [];
      list.push(img.storage_path as string);
      byBucket.set(bucket, list);
    }
    for (const [bucket, paths] of byBucket) {
      await supabase.storage.from(bucket).remove(paths);
    }
  }

  const { error } = await supabase.from("shelf_scans").delete().eq("id", scanId).eq("org_id", orgId);
  if (error) return dbError(error, "Could not delete this audit.");
}

export function formatScanDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function formatScanTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function formatCount(value?: number): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "—";
}
