// Contract + bindings for the future backend (FastAPI now, Supabase later).
// No fabricated rows anywhere — the UI renders only what the API returns.

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

import { API_BASE, assertApiConfigured } from "./api-config";

/** GET /scans — paginated history for the signed-in user. */
export async function fetchScanHistory(
  params: ScanHistoryQuery,
  signal?: AbortSignal,
): Promise<ScanHistoryResponse> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.store && params.store !== "all") search.set("store", params.store);
  if (params.date) search.set("date", params.date);
  if (params.sort) search.set("sort", params.sort);
  search.set("page", String(params.page ?? 1));
  search.set("page_size", String(params.page_size ?? 10));

  const response = await fetch(`${API_BASE}/scans?${search.toString()}`, {
    headers: { Accept: "application/json" },
    signal: signal ?? null,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Could not load scan history (HTTP ${response.status}).`);
  }
  return (await response.json()) as ScanHistoryResponse;
}

/** DELETE /scan/{scan_id} */
export async function deleteScan(scanId: string): Promise<void> {
  assertApiConfigured();
  const response = await fetch(`${API_BASE}/scan/${encodeURIComponent(scanId)}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Could not delete this scan (HTTP ${response.status}).`);
  }
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
