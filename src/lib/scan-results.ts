// Contract for the future FastAPI scan-results response. The UI binds only to
// these types — no fabricated inventory or analytics anywhere.

export type Severity = "high" | "medium" | "low";

export type ScanAlert = {
  id: string;
  severity: Severity;
  title: string;
  detail?: string;
};

export type ScanRecommendation = {
  id: string;
  title: string;
  detail?: string;
  category?: string;
  impact?: string;
};

export type InventoryItem = {
  id: string;
  brand: string;
  product: string;
  variant?: string;
  quantity: number;
  confidence: number; // 0-1 or 0-100, normalized on render
  category?: string;
  low_stock?: boolean;
};

export type BrandShare = { brand: string; share: number };
export type ConfidenceBucket = { bucket: string; count: number };
export type CategorySlice = { category: string; count: number };

export type ScanResult = {
  scan_id: string;
  created_at?: string;
  store?: string;
  aisle?: string;
  summary: {
    total_products: number;
    unique_skus: number;
    unique_brands: number;
    low_stock_products: number;
    average_confidence: number;
    processing_time_ms: number;
  };
  annotated_image_url?: string;
  executive_summary?: string;
  alerts?: ScanAlert[];
  recommendations?: ScanRecommendation[];
  inventory?: InventoryItem[];
  charts?: {
    top_brands?: BrandShare[];
    confidence_distribution?: ConfidenceBucket[];
    category_distribution?: CategorySlice[];
  };
  downloads?: {
    pdf_url?: string;
    csv_url?: string;
    json_url?: string;
    annotated_image_url?: string;
  };
  navigation?: {
    previous_scan_id?: string | null;
    next_scan_id?: string | null;
  };
};

const API_BASE = import.meta.env['VITE_SCAN_API_BASE'] ?? "";

/** GET /scan/{scan_id} — full result payload for one scan. */
export async function fetchScanResult(
  scanId: string,
  signal?: AbortSignal,
): Promise<ScanResult> {
  const response = await fetch(`${API_BASE}/scan/${encodeURIComponent(scanId)}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Could not load scan results (HTTP ${response.status}).`);
  }
  return (await response.json()) as ScanResult;
}

export function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value <= 1 ? value * 100 : value;
}

export function formatConfidence(value: number): string {
  return `${normalizeConfidence(value).toFixed(1)}%`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function inventoryToCsv(items: InventoryItem[]): string {
  const header = ["Brand", "Product", "Variant", "Category", "Quantity", "Confidence %"];
  const escape = (value: string | number | undefined) => {
    const s = value === undefined || value === null ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = items.map((i) =>
    [
      i.brand,
      i.product,
      i.variant ?? "",
      i.category ?? "",
      i.quantity,
      normalizeConfidence(i.confidence).toFixed(1),
    ]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

export function downloadBlob(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
