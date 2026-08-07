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

import { api } from "./api/client";

/** GET /scans — paginated history for the signed-in user. */
export function fetchScanHistory(
  params: ScanHistoryQuery,
  signal?: AbortSignal,
): Promise<ScanHistoryResponse> {
  return api.get<ScanHistoryResponse>("/scans", {
    signal,
    query: {
      q: params.q,
      store: params.store,
      date: params.date,
      sort: params.sort,
      page: params.page ?? 1,
      page_size: params.page_size ?? 10,
    },
  });
}

/** DELETE /scan/{scan_id} */
export function deleteScan(scanId: string): Promise<void> {
  return api.delete<void>(`/scan/${encodeURIComponent(scanId)}`);
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
