// Live Supabase-backed scan history: search, filter, sort and paginate
// shelf_scans for the signed-in user's active organization.

export type ScanStatus = "completed" | "processing" | "failed";

export type ScanHistoryItem = {
  scan_id: string;
  store: string;
  created_at: string; // ISO timestamp
  products_detected?: number;
  low_stock_products?: number;
  average_confidence?: number; // 0-1 or 0-100
  processing_time_ms?: number;
  status: ScanStatus;
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
};

export type ScanHistoryQuery = {
  q?: string;
  store?: string;
  date?: string; // YYYY-MM-DD
  sort?: "newest" | "oldest" | "processing_time";
  page?: number;
  page_size?: number;
};

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId } from "@/lib/db/context";

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
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("shelf_scans")
    .select(
      "id, status, shelf_label, category, total_products, low_stock_count, out_of_stock_count, processing_started_at, processing_completed_at, created_at, store_id, stores(name)",
      { count: "exact" },
    )
    .eq("org_id", orgId);

  if (params.store && params.store !== "all") {
    query = query.eq("store_id", params.store);
  }
  if (params.date) {
    const start = `${params.date}T00:00:00.000Z`;
    const end = `${params.date}T23:59:59.999Z`;
    query = query.gte("created_at", start).lte("created_at", end);
  }
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
  if (error) return dbError(error, "Could not load scan history.");

  let items = (data ?? []).map((row: any): ScanHistoryItem => {
    const startedAt = row.processing_started_at ? new Date(row.processing_started_at).getTime() : undefined;
    const completedAt = row.processing_completed_at ? new Date(row.processing_completed_at).getTime() : undefined;
    const processingTimeMs =
      startedAt !== undefined && completedAt !== undefined ? completedAt - startedAt : undefined;
    return {
      scan_id: row.id as string,
      store: (row.stores?.name as string | undefined) ?? "—",
      created_at: row.created_at as string,
      products_detected: row.total_products ?? undefined,
      low_stock_products:
        row.low_stock_count !== null && row.out_of_stock_count !== null
          ? (row.low_stock_count ?? 0) + (row.out_of_stock_count ?? 0)
          : undefined,
      average_confidence: undefined,
      processing_time_ms: processingTimeMs,
      status: toApiStatus(row.status as string),
    };
  });

  if (params.sort === "processing_time") {
    items = [...items].sort((a, b) => (b.processing_time_ms ?? 0) - (a.processing_time_ms ?? 0));
  }

  const { data: storeRows } = await supabase.from("stores").select("name").eq("org_id", orgId);
  const stores = Array.from(new Set((storeRows ?? []).map((s) => s.name as string))).sort();

  return {
    items,
    total: count ?? items.length,
    page,
    page_size: pageSize,
    stores,
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
  if (error) return dbError(error, "Could not delete this scan.");
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
