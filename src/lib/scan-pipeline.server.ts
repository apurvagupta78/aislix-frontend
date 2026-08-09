/**
 * Server-only AI scan pipeline.
 *
 * Runs steps 3-6 of the scan flow: send the uploaded shelf images to the
 * Railway FastAPI vision backend, persist every returned product, metric and
 * analytics rollup into Supabase, then flip the scan to `completed`. Any
 * failure marks the scan `failed` with the reason so the UI can offer a retry.
 *
 * There is no mock/fallback path — if the vision API is unreachable or returns
 * an unusable payload, the scan fails.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type DB = SupabaseClient<Database>;

export type PipelineResult = {
  scan_id: string;
  status: "completed";
  total_products: number;
  out_of_stock_count: number;
  low_stock_count: number;
  misplaced_count: number;
  shelf_health_score: number | null;
  /** Number of SKUs persisted into the learned catalog by this scan. */
  learned_saved?: number;
  /** Set when the learned catalog could not be persisted (surfaced as a toast). */
  learned_error?: string | null;
};


export class PipelineError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "PipelineError";
    this.status = status;
  }
}

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

function visionConfig() {
  const baseUrl = (
    process.env["AISLIX_AI_API_URL"] ??
    process.env["RAILWAY_API_URL"] ??
    process.env["SCAN_API_URL"] ??
    ""
  ).trim();
  if (!baseUrl) {
    throw new PipelineError(
      "The AI vision backend is not connected yet. Add the AISLIX_AI_API_URL secret with your Railway FastAPI URL.",
      503,
    );
  }
  const path = (process.env["AISLIX_AI_SCAN_PATH"] ?? "/scan").trim() || "/scan";
  const apiKey = (process.env["AISLIX_AI_API_KEY"] ?? "").trim();
  const timeoutMs = Number(process.env["AISLIX_AI_TIMEOUT_MS"]) || 600_000;
  const base = baseUrl.replace(/\/+$/, "");
  return {
    baseUrl: base,
    url: `${base}${path.startsWith("/") ? path : `/${path}`}`,
    apiKey,
    timeoutMs,
  };
}

/* -------------------------------------------------------------------------- */
/* Normalization helpers                                                      */
/* -------------------------------------------------------------------------- */

type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "misplaced";

const STOCK_VALUES: StockStatus[] = ["in_stock", "low_stock", "out_of_stock", "misplaced"];

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function arr(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

/** Confidence is stored as 0-1 regardless of what the API sends. */
function normalizeConfidence(value: unknown): number | null {
  const n = num(value);
  if (n === null) return null;
  const scaled = n > 1 ? n / 100 : n;
  return Math.min(1, Math.max(0, scaled));
}

function normalizeStock(raw: unknown, facings: number, expected: number | null): StockStatus {
  const value = str(raw)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (value && STOCK_VALUES.includes(value as StockStatus)) return value as StockStatus;
  if (value === "oos" || value === "empty") return "out_of_stock";
  if (value === "low") return "low_stock";
  if (value === "misplaced_product" || value === "wrong_position") return "misplaced";
  if (facings <= 0) return "out_of_stock";
  if (expected !== null && expected > 0 && facings < expected * 0.5) return "low_stock";
  return "in_stock";
}

export type NormalizedProduct = {
  name: string;
  brand: string | null;
  category: string | null;
  sku: string | null;
  barcode: string | null;
  facings: number;
  shelf_row: number | null;
  position_index: number | null;
  stock_status: StockStatus;
  confidence: number | null;
  price_inr: number | null;
  expected_facings: number | null;
  bounding_box: unknown | null;
};

function normalizeProducts(payload: any): NormalizedProduct[] {
  const source = arr(payload?.inventory).length
    ? arr(payload?.inventory)
    : arr(payload?.products).length
      ? arr(payload?.products)
      : arr(payload?.detected_products).length
        ? arr(payload?.detected_products)
        : arr(payload?.items).length
          ? arr(payload?.items)
          : arr(payload?.detections);

  return source
    .map((item: any, index: number): NormalizedProduct | null => {
      const name =
        str(item?.name) ?? str(item?.product) ?? str(item?.product_name) ?? str(item?.label);
      if (!name) return null;

      const facings = Math.max(
        0,
        Math.round(num(item?.facings) ?? num(item?.quantity) ?? num(item?.count) ?? 0),
      );
      const expected = num(item?.expected_facings) ?? num(item?.expected_quantity);
      const shelfRow = num(item?.shelf_row) ?? num(item?.row) ?? num(item?.shelf_level);
      const position =
        num(item?.position_index) ?? num(item?.position) ?? num(item?.column) ?? index;

      return {
        name,
        brand: str(item?.brand) ?? str(item?.brand_name),
        category: str(item?.category) ?? str(item?.category_name),
        sku: str(item?.sku),
        barcode: str(item?.barcode) ?? str(item?.ean),
        facings,
        shelf_row: shelfRow === null ? null : Math.round(shelfRow),
        position_index: position === null ? null : Math.round(position),
        stock_status: normalizeStock(item?.stock_status ?? item?.status, facings, expected),
        confidence: normalizeConfidence(item?.confidence ?? item?.score),
        price_inr: num(item?.price_inr) ?? num(item?.price),
        expected_facings: expected === null ? null : Math.round(expected),
        bounding_box: item?.bounding_box ?? item?.bbox ?? item?.box ?? null,
      };
    })
    .filter((p): p is NormalizedProduct => p !== null);
}

function normalizeAlerts(payload: any) {
  return arr(payload?.alerts).map((item: any, index: number) => ({
    id: str(item?.id) ?? `alert-${index + 1}`,
    severity: (() => {
      const s = str(item?.severity)?.toLowerCase();
      return s === "critical" || s === "high" || s === "medium" || s === "low" ? s : "medium";
    })(),
    title: str(item?.title) ?? str(item?.message) ?? "Alert",
    detail: str(item?.detail) ?? str(item?.description) ?? undefined,
  }));
}

function normalizeRecommendations(payload: any) {
  return arr(payload?.recommendations).map((item: any, index: number) => ({
    id: str(item?.id) ?? `rec-${index + 1}`,
    title: str(item?.title) ?? str(item?.recommendation) ?? "Recommendation",
    detail: str(item?.detail) ?? str(item?.description) ?? undefined,
    category: str(item?.category) ?? undefined,
    impact: str(item?.impact) ?? undefined,
  }));
}

function brandShare(payload: any, products: NormalizedProduct[]) {
  const provided = arr(payload?.brand_share ?? payload?.top_brands);
  if (provided.length) {
    return provided
      .map((item: any) => ({
        brand: str(item?.brand) ?? "Unknown",
        share: num(item?.share) ?? num(item?.percent) ?? 0,
      }))
      .filter((item) => item.share > 0 || item.brand !== "Unknown");
  }
  const totals = new Map<string, number>();
  let total = 0;
  for (const p of products) {
    const key = p.brand ?? "Unknown";
    const weight = p.facings || 1;
    totals.set(key, (totals.get(key) ?? 0) + weight);
    total += weight;
  }
  if (!total) return [];
  return Array.from(totals.entries())
    .map(([brand, weight]) => ({ brand, share: Number(((weight / total) * 100).toFixed(1)) }))
    .sort((a, b) => b.share - a.share);
}

function categoryBreakdown(payload: any, products: NormalizedProduct[]) {
  const provided = arr(payload?.category_breakdown ?? payload?.category_distribution);
  if (provided.length) {
    return provided.map((item: any) => ({
      category: str(item?.category) ?? "Uncategorized",
      count: Math.round(num(item?.count) ?? 0),
    }));
  }
  const counts = new Map<string, number>();
  for (const p of products) {
    const key = p.category ?? "Uncategorized";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

function shelfRows(payload: any, products: NormalizedProduct[]) {
  const provided = arr(payload?.shelf_rows);
  if (provided.length) return provided;
  const rows = new Map<number, { row: number; products: number; facings: number }>();
  for (const p of products) {
    if (p.shelf_row === null) continue;
    const entry = rows.get(p.shelf_row) ?? { row: p.shelf_row, products: 0, facings: 0 };
    entry.products += 1;
    entry.facings += p.facings;
    rows.set(p.shelf_row, entry);
  }
  return Array.from(rows.values()).sort((a, b) => a.row - b.row);
}

function pct(value: unknown): number | null {
  const n = num(value);
  if (n === null) return null;
  const scaled = n > 0 && n <= 1 ? n * 100 : n;
  return Math.min(100, Math.max(0, Number(scaled.toFixed(2))));
}

/* -------------------------------------------------------------------------- */
/* Vision API call                                                            */
/* -------------------------------------------------------------------------- */

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_MS = Number(process.env["AISLIX_AI_TIMEOUT_MS"]) || 600_000;

function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    throw new PipelineError("The AI vision backend returned a response that was not valid JSON.");
  }
}

async function callVisionApi(body: unknown): Promise<any> {
  const { baseUrl, url, apiKey, timeoutMs } = visionConfig();

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };
  if (apiKey) {
    headers["authorization"] = `Bearer ${apiKey}`;
    headers["x-api-key"] = apiKey;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && /timeout|abort/i.test(error.name + error.message);
    throw new PipelineError(
      timedOut
        ? "The AI vision backend took too long to respond. Please retry the scan."
        : `Could not reach the AI vision backend at ${url}.`,
      timedOut ? 504 : 502,
    );
  }

  const text = await response.text();
  if (!response.ok) {
    const detail = text.slice(0, 400);
    throw new PipelineError(
      `AI vision backend returned ${response.status}${detail ? `: ${detail}` : ""}`,
      response.status >= 500 ? 502 : response.status,
    );
  }

  const payload = parseJson(text);

  // Async backend: 202 Accepted means the scan is queued; poll until it finishes.
  const remoteId = str(payload?.scan_id) ?? str(payload?.id) ?? str(payload?.job_id);
  const initialStatus = (str(payload?.status) ?? "").toLowerCase();
  const isAsync =
    response.status === 202 || ["queued", "pending", "processing", "running"].includes(initialStatus);
  if (!isAsync) return payload;

  if (!remoteId) {
    throw new PipelineError(
      "The AI vision backend accepted the scan but did not return a scan_id to poll.",
    );
  }

  return pollVisionScan(baseUrl, remoteId, headers);
}

async function pollVisionScan(
  baseUrl: string,
  remoteId: string,
  headers: Record<string, string>,
): Promise<any> {
  const statusUrl = `${baseUrl}/scan/${encodeURIComponent(remoteId)}`;
  const deadline = Date.now() + POLL_MAX_MS;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    let res: Response;
    try {
      res = await fetch(statusUrl, {
        method: "GET",
        headers: { accept: "application/json", ...(headers["authorization"] ? { authorization: headers["authorization"], "x-api-key": headers["x-api-key"]! } : {}) },
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      continue; // transient network/timeout — retry on the next tick
    }

    const body = await res.text();
    if (res.status === 404 || res.status >= 500) continue;
    if (!res.ok) {
      throw new PipelineError(
        `AI vision backend returned ${res.status}${body ? `: ${body.slice(0, 400)}` : ""}`,
        res.status,
      );
    }

    const payload = parseJson(body);
    const status = (str(payload?.status) ?? "").toLowerCase();

    if (status === "failed" || status === "error") {
      throw new PipelineError(
        str(payload?.error) ??
          str(payload?.error_message) ??
          str(payload?.detail) ??
          "The AI vision backend failed to analyse this shelf image.",
      );
    }
    if (status === "completed" || status === "complete" || status === "done" || status === "success") {
      return payload?.result ?? payload?.results ?? payload;
    }
    // queued / processing → keep polling
  }

  throw new PipelineError(
    "The AI vision backend did not finish analysing this scan in time. Please retry.",
    504,
  );
}

/* -------------------------------------------------------------------------- */
/* Short-request job API (submit once, poll separately)                       */
/* -------------------------------------------------------------------------- */

function visionHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };
  if (apiKey) {
    headers["authorization"] = `Bearer ${apiKey}`;
    headers["x-api-key"] = apiKey;
  }
  return headers;
}

export type SubmitVisionResult =
  | { kind: "completed"; payload: any }
  | { kind: "accepted"; jobId: string };

/** POST /scan only — returns as soon as Railway accepts the job. */
export async function submitVisionJob(body: unknown): Promise<SubmitVisionResult> {
  const { url, apiKey } = visionConfig();
  const headers = visionHeaders(apiKey);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && /timeout|abort/i.test(error.name + error.message);
    throw new PipelineError(
      timedOut
        ? "The AI vision backend took too long to accept this scan. Please retry."
        : `Could not reach the AI vision backend at ${url}.`,
      timedOut ? 504 : 502,
    );
  }

  const text = await response.text();
  if (!response.ok) {
    throw new PipelineError(
      `AI vision backend returned ${response.status}${text ? `: ${text.slice(0, 400)}` : ""}`,
      response.status >= 500 ? 502 : response.status,
    );
  }

  const payload = parseJson(text);
  const status = (str(payload?.status) ?? "").toLowerCase();
  const jobId = str(payload?.scan_id) ?? str(payload?.id) ?? str(payload?.job_id);
  const isAsync =
    response.status === 202 || ["queued", "pending", "processing", "running"].includes(status);

  if (!isAsync) return { kind: "completed", payload };
  if (!jobId) {
    throw new PipelineError(
      "The AI vision backend accepted the scan but did not return a scan_id to poll.",
    );
  }
  return { kind: "accepted", jobId };
}

export type PollVisionResult = { kind: "processing" } | { kind: "completed"; payload: any };

/** A single GET /scan/{id} — never loops, so the request stays short. */
export async function pollVisionJobOnce(jobId: string): Promise<PollVisionResult> {
  const { baseUrl, apiKey } = visionConfig();
  const headers = visionHeaders(apiKey);
  delete headers["content-type"];

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/scan/${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return { kind: "processing" }; // transient — the client will poll again
  }

  const text = await res.text();
  if (res.status === 404 || res.status >= 500) return { kind: "processing" };
  if (!res.ok) {
    throw new PipelineError(
      `AI vision backend returned ${res.status}${text ? `: ${text.slice(0, 400)}` : ""}`,
      res.status,
    );
  }

  const payload = parseJson(text);
  const status = (str(payload?.status) ?? "").toLowerCase();

  if (status === "failed" || status === "error") {
    throw new PipelineError(
      str(payload?.error) ??
        str(payload?.error_message) ??
        str(payload?.detail) ??
        "The AI vision backend failed to analyse this shelf image.",
    );
  }
  if (["completed", "complete", "done", "success"].includes(status)) {
    return { kind: "completed", payload: payload?.result ?? payload?.results ?? payload };
  }
  return { kind: "processing" };
}


/* -------------------------------------------------------------------------- */
/* Persistence                                                                */
/* -------------------------------------------------------------------------- */

async function markFailed(supabase: DB, scanId: string, message: string) {
  await supabase
    .from("shelf_scans")
    .update({
      status: "failed",
      error_message: message.slice(0, 800),
      processing_completed_at: new Date().toISOString(),
    })
    .eq("id", scanId);
}

/** Downloads the annotated render (URL or base64) and stores it alongside the original. */
async function storeAnnotatedImage(
  supabase: DB,
  scan: { id: string; org_id: string },
  payload: any,
): Promise<void> {
  const url = str(payload?.annotated_image_url) ?? str(payload?.annotated_url);
  const base64 = str(payload?.annotated_image_base64) ?? str(payload?.annotated_image);
  if (!url && !base64) return;

  let bytes: Uint8Array;
  let contentType = "image/jpeg";
  try {
    if (url) {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) return;
      contentType = res.headers.get("content-type") ?? contentType;
      bytes = new Uint8Array(await res.arrayBuffer());
    } else {
      const cleaned = base64!.replace(/^data:[^;]+;base64,/, "");
      if (base64!.startsWith("data:")) {
        contentType = base64!.slice(5, base64!.indexOf(";")) || contentType;
      }
      bytes = Uint8Array.from(Buffer.from(cleaned, "base64"));
    }
  } catch {
    return; // annotated render is optional — never fail the scan for it
  }
  if (!bytes.byteLength) return;

  const ext = contentType.includes("png") ? "png" : "jpg";
  const path = `${scan.org_id}/${scan.id}/annotated-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("scan-images")
    .upload(path, bytes, { contentType, upsert: true });
  if (uploadError) return;

  await supabase.from("scan_images").insert({
    scan_id: scan.id,
    kind: "annotated",
    storage_bucket: "scan-images",
    storage_path: path,
    mime_type: contentType,
    file_size_bytes: bytes.byteLength,
  } as never);
}

/** Stores the PDF report returned by the vision backend as base64. */
async function storePdfReport(
  supabase: DB,
  scan: { id: string; org_id: string },
  payload: any,
): Promise<void> {
  const base64 = str(payload?.pdf_base64) ?? str(payload?.report_pdf_base64);
  if (!base64) return;

  let bytes: Uint8Array;
  try {
    const cleaned = base64.replace(/^data:[^;]+;base64,/, "");
    bytes = Uint8Array.from(Buffer.from(cleaned, "base64"));
  } catch {
    return;
  }
  if (!bytes.byteLength) return;

  const path = `${scan.org_id}/${scan.id}/report-${Date.now()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("scan-images")
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (uploadError) return;

  await supabase.from("scan_images").insert({
    scan_id: scan.id,
    kind: "pdf",
    storage_bucket: "scan-images",
    storage_path: path,
    mime_type: "application/pdf",
    file_size_bytes: bytes.byteLength,
  } as never);
}

/** Stores the CSV export returned by the vision backend as base64. */
async function storeCsvReport(
  supabase: DB,
  scan: { id: string; org_id: string },
  payload: any,
): Promise<void> {
  const base64 = str(payload?.csv_base64) ?? str(payload?.report_csv_base64);
  if (!base64) return;

  let bytes: Uint8Array;
  try {
    const cleaned = base64.replace(/^data:[^;]+;base64,/, "");
    bytes = Uint8Array.from(Buffer.from(cleaned, "base64"));
  } catch {
    return;
  }
  if (!bytes.byteLength) return;

  const path = `${scan.org_id}/${scan.id}/report-${Date.now()}.csv`;
  const { error: uploadError } = await supabase.storage
    .from("scan-images")
    .upload(path, bytes, { contentType: "text/csv", upsert: true });
  if (uploadError) return;

  await supabase.from("scan_images").insert({
    scan_id: scan.id,
    kind: "csv",
    storage_bucket: "scan-images",
    storage_path: path,
    mime_type: "text/csv",
    file_size_bytes: bytes.byteLength,
  } as never);
}


/** Recomputes the daily rollup for this org/store from real completed scans. */
async function refreshAnalytics(
  supabase: DB,
  scan: { org_id: string; store_id: string | null },
): Promise<void> {
  const day = new Date();
  const periodDate = day.toISOString().slice(0, 10);
  const dayStart = `${periodDate}T00:00:00.000Z`;
  const dayEnd = `${periodDate}T23:59:59.999Z`;

  let query = supabase
    .from("shelf_scans")
    .select(
      "shelf_health_score, osa_percent, share_of_shelf_percent, out_of_stock_count, low_stock_count, misplaced_count",
    )
    .eq("org_id", scan.org_id)
    .eq("status", "completed")
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);
  query = scan.store_id ? query.eq("store_id", scan.store_id) : query.is("store_id", null);

  const { data: rows } = await query;
  if (!rows?.length) return;

  const avg = (pick: (row: any) => number | null) => {
    const values = rows.map(pick).filter((v): v is number => v !== null && Number.isFinite(v));
    if (!values.length) return null;
    return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
  };
  const sum = (pick: (row: any) => number | null) =>
    rows.reduce((total, row) => total + (pick(row) ?? 0), 0);

  const { data: brandRows } = await supabase
    .from("scan_results")
    .select("brand_share, category_breakdown, shelf_scans!inner(org_id, store_id, created_at, status)")
    .eq("shelf_scans.org_id", scan.org_id)
    .eq("shelf_scans.status", "completed")
    .gte("shelf_scans.created_at", dayStart)
    .lte("shelf_scans.created_at", dayEnd)
    .limit(200);

  const brandTotals = new Map<string, number>();
  const categoryTotals = new Map<string, number>();
  for (const row of brandRows ?? []) {
    for (const entry of arr((row as any).brand_share)) {
      const brand = str(entry?.brand);
      if (brand) brandTotals.set(brand, (brandTotals.get(brand) ?? 0) + (num(entry?.share) ?? 0));
    }
    for (const entry of arr((row as any).category_breakdown)) {
      const category = str(entry?.category);
      if (category) {
        categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + (num(entry?.count) ?? 0));
      }
    }
  }
  const topBrands = Array.from(brandTotals.entries())
    .map(([brand, share]) => ({ brand, share: Number((share / (brandRows?.length || 1)).toFixed(1)) }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 8);
  const categoryMix = Array.from(categoryTotals.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const record = {
    org_id: scan.org_id,
    store_id: scan.store_id,
    period_date: periodDate,
    scans_count: rows.length,
    avg_shelf_health: avg((r) => num(r.shelf_health_score)),
    avg_osa_percent: avg((r) => num(r.osa_percent)),
    avg_share_of_shelf: avg((r) => num(r.share_of_shelf_percent)),
    out_of_stock_count: sum((r) => num(r.out_of_stock_count)),
    low_stock_count: sum((r) => num(r.low_stock_count)),
    misplaced_count: sum((r) => num(r.misplaced_count)),
    top_brands: topBrands,
    category_mix: categoryMix,
  };

  let existingQuery = supabase
    .from("shelf_analytics")
    .select("id")
    .eq("org_id", scan.org_id)
    .eq("period_date", periodDate);
  existingQuery = scan.store_id
    ? existingQuery.eq("store_id", scan.store_id)
    : existingQuery.is("store_id", null);
  const { data: existing } = await existingQuery.maybeSingle();

  if (existing?.id) {
    await supabase.from("shelf_analytics").update(record as never).eq("id", existing.id);
  } else {
    await supabase.from("shelf_analytics").insert(record as never);
  }
}

/* -------------------------------------------------------------------------- */
/* Learned SKU catalog (Railway cannot reach Supabase — we own persistence)    */
/* -------------------------------------------------------------------------- */

type LearnedCatalogRow = {
  sku: string | null;
  brand: string | null;
  product_name: string;
  variant: string | null;
  category: string | null;
  embedding: unknown;
};

/** Shared cross-org catalog, sent to Railway as `learned_catalog`. */
async function loadLearnedCatalog(supabase: DB, _orgId: string): Promise<LearnedCatalogRow[]> {
  const { data, error } = await supabase
    .from("global_learned_skus")
    .select("sku, brand, product_name, variant, category, embedding");
  if (error || !data) return [];
  return data.map((row: any) => ({
    sku: row.sku ?? null,
    brand: row.brand ?? null,
    product_name: row.product_name ?? "",
    variant: row.variant ?? null,
    category: row.category ?? null,
    embedding: row.embedding ?? null,
  }));
}


/** Human-readable product name derived from a SKU code (`lipton_green_tea` → `Lipton Green Tea`). */
function nameFromSku(sku: string): string {
  return sku
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Only keep numeric vectors — anything else would corrupt the stored embedding. */
function normalizeEmbedding(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const vector = value.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return vector.length ? vector : null;
}

/** Persist `learned_updates` returned by Railway back into learned_skus. */
export async function persistLearnedUpdates(
  supabase: DB,
  scan: { id: string; org_id: string },
  payload: any,
): Promise<{ saved: number; error: string | null }> {
  const updates = arr(payload?.learned_updates ?? payload?.learned_catalog_updates);
  if (!updates.length) return { saved: 0, error: null };

  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const raw of updates) {
    const sku = str(raw?.sku);
    // The conflict target is (org_id, sku); rows without a SKU cannot be upserted.
    if (!sku || seen.has(sku)) continue;
    seen.add(sku);
    const name =
      str(raw?.product_name) ?? str(raw?.name) ?? str(raw?.title) ?? nameFromSku(sku);
    rows.push({
      org_id: scan.org_id,
      sku,
      name,
      brand: str(raw?.brand),
      variant: str(raw?.variant),
      category: str(raw?.category),
      barcode: str(raw?.barcode),
      embedding: normalizeEmbedding(raw?.embedding),
      source_scan_id: scan.id,
      times_seen: Math.max(1, Math.round(num(raw?.hit_count) ?? num(raw?.times_seen) ?? 1)),
      confidence: normalizeConfidence(raw?.confidence),
      expected_facings: num(raw?.expected_facings),
      last_seen_at: now,
    });
  }
  if (!rows.length) return { saved: 0, error: null };

  try {
    const { error } = await supabase
      .from("learned_skus")
      .upsert(rows as never, { onConflict: "org_id,sku" });
    if (error) {
      console.error("[scan-pipeline] learned_skus upsert failed:", {
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
        rows: rows.length,
        org_id: scan.org_id,
      });
      return { saved: 0, error: error.message };
    }
    return { saved: rows.length, error: null };
  } catch (thrown) {
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    console.error("[scan-pipeline] learned_skus upsert threw:", thrown);
    return { saved: 0, error: message };
  }
}


/* -------------------------------------------------------------------------- */
/* Pipeline                                                                   */
/* -------------------------------------------------------------------------- */

type ScanRow = {
  id: string;
  org_id: string;
  store_id: string | null;
  shelf_label: string | null;
  category: string | null;
  notes: string | null;
};

/** Beverages-only shelf narrowing carried in `notes` (e.g. "tea shelf" → "tea"). */
function subCategoryFromNotes(notes: string | null): string | null {
  const match = /^(tea|juice|soft drinks)\s+shelf$/i.exec((notes ?? "").trim());
  return match ? match[1]!.toLowerCase() : null;
}



async function loadScan(supabase: DB, scanId: string): Promise<ScanRow> {
  const { data: scan, error } = await supabase
    .from("shelf_scans")
    .select("id, org_id, store_id, status, shelf_label, category, notes")
    .eq("id", scanId)
    .maybeSingle();
  if (error) throw new PipelineError(error.message, 500);
  if (!scan) throw new PipelineError("Scan not found.", 404);
  return {
    id: scan.id as string,
    org_id: scan.org_id as string,
    store_id: (scan.store_id as string | null) ?? null,
    shelf_label: (scan.shelf_label as string | null) ?? null,
    category: (scan.category as string | null) ?? null,
    notes: (scan.notes as string | null) ?? null,
  };
}

/** Signs every uploaded original image and builds the Railway request body. */
async function buildVisionRequest(supabase: DB, scan: ScanRow, startedAt: string) {
  const { data: images, error: imagesError } = await supabase
    .from("scan_images")
    .select("id, storage_bucket, storage_path, mime_type, width, height")
    .eq("scan_id", scan.id)
    .eq("kind", "original")
    .order("created_at", { ascending: true });
  if (imagesError) throw new PipelineError(imagesError.message, 500);
  if (!images?.length) throw new PipelineError("No shelf images were uploaded for this scan.", 400);

  const signedImages: { url: string; path: string; width: number | null; height: number | null }[] =
    [];
  for (const image of images) {
    const { data: signed, error: signError } = await supabase.storage
      .from(image.storage_bucket as string)
      .createSignedUrl(image.storage_path as string, 3600);
    if (signError || !signed?.signedUrl) {
      throw new PipelineError("Could not create a download link for the uploaded image.", 500);
    }
    signedImages.push({
      url: signed.signedUrl,
      path: image.storage_path as string,
      width: (image.width as number | null) ?? null,
      height: (image.height as number | null) ?? null,
    });
  }

  const learnedCatalog = await loadLearnedCatalog(supabase, scan.org_id);


  return {
    scan_id: scan.id,
    org_id: scan.org_id,
    store_id: scan.store_id,
    shelf_label: scan.shelf_label,
    category: scan.category,
    sub_category: subCategoryFromNotes(scan.notes),
    notes: scan.notes,
    image_urls: signedImages.map((i) => i.url),
    images: signedImages,
    learned_catalog: learnedCatalog,
    requested_at: startedAt,
  };
}

/** Shared persistence for a completed vision payload. */
async function persistScanPayload(
  supabase: DB,
  scan: ScanRow,
  payload: any,
  startedAt: string,
): Promise<PipelineResult> {
  const products = normalizeProducts(payload);
  if (!products.length) {
    throw new PipelineError(
      "The AI vision backend did not detect any products in this shelf image.",
      422,
    );
  }

  // --- Persist detected products -------------------------------------------
  await supabase.from("detected_products").delete().eq("scan_id", scan.id);
  const { error: productError } = await supabase.from("detected_products").insert(
    products.map((p) => ({
      scan_id: scan.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      sku: p.sku,
      barcode: p.barcode,
      facings: p.facings,
      shelf_row: p.shelf_row,
      position_index: p.position_index,
      stock_status: p.stock_status,
      confidence: p.confidence,
      price_inr: p.price_inr,
      expected_facings: p.expected_facings,
      bounding_box: p.bounding_box,
    })) as never,
  );
  if (productError) throw new PipelineError(productError.message, 500);

  // --- Metrics -------------------------------------------------------------
  const metricsSource = (payload?.metrics ?? payload?.summary ?? payload) as any;
  const outOfStock = products.filter((p) => p.stock_status === "out_of_stock").length;
  const lowStock = products.filter((p) => p.stock_status === "low_stock").length;
  const misplaced = products.filter((p) => p.stock_status === "misplaced").length;
  const confidences = products.map((p) => p.confidence).filter((c): c is number => c !== null);
  const confidenceAvg = confidences.length
    ? Number((confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(4))
    : null;

  const osa =
    pct(metricsSource?.osa_percent ?? metricsSource?.on_shelf_availability) ??
    Number((((products.length - outOfStock) / products.length) * 100).toFixed(2));
  const compliance = pct(
    metricsSource?.planogram_compliance_percent ?? metricsSource?.planogram_compliance,
  );
  const shareOfShelf = pct(metricsSource?.share_of_shelf_percent ?? metricsSource?.share_of_shelf);
  const health =
    pct(metricsSource?.shelf_health_score ?? metricsSource?.shelf_health) ??
    Number(
      (
        osa * 0.6 +
        (compliance ?? osa) * 0.25 +
        (confidenceAvg !== null ? confidenceAvg * 100 : 90) * 0.15
      ).toFixed(2),
    );

  const shares = brandShare(payload, products);
  const categories = categoryBreakdown(payload, products);
  const rows = shelfRows(payload, products);
  const completedAt = new Date().toISOString();

  // Learned catalog is persisted before the result set so the badge counts are stored.
  const learned = await persistLearnedUpdates(
    supabase,
    { id: scan.id, org_id: scan.org_id },
    payload,
  );
  const learnedNewThisScan = learned.saved;

  const { count: learnedCatalogCount } = await supabase
    .from("learned_skus")
    .select("id", { count: "exact", head: true })
    .eq("org_id", scan.org_id);

  const totalProducts = products.reduce((total, p) => total + p.facings, 0);

  const metrics = {
    total_products: totalProducts,
    unique_skus: new Set(products.map((p) => `${p.brand ?? ""}::${p.name}`)).size,
    unique_brands: new Set(products.map((p) => p.brand ?? "Unknown")).size,
    total_facings: totalProducts,
    out_of_stock_products: outOfStock,
    low_stock_products: lowStock,
    misplaced_products: misplaced,
    average_confidence: confidenceAvg ?? 0,
    osa_percent: osa,
    shelf_health_score: health,
    ...(compliance !== null ? { shelf_compliance: compliance } : {}),
    ...(shareOfShelf !== null ? { share_of_shelf_percent: shareOfShelf } : {}),
    learned_catalog_size: learnedCatalogCount ?? 0,
    learned_new_this_scan: learnedNewThisScan,
    processing_time_ms: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
  };

  // --- Persist the result set ----------------------------------------------
  const { error: resultError } = await supabase.from("scan_results").upsert(
    {
      scan_id: scan.id,
      executive_summary: str(payload?.executive_summary) ?? str(payload?.summary_text) ?? null,
      metrics,
      alerts: normalizeAlerts(payload),
      recommendations: normalizeRecommendations(payload),
      brand_share: shares,
      category_breakdown: categories,
      shelf_rows: rows,
      model_version: str(payload?.model_version) ?? str(payload?.version) ?? null,
      confidence_avg: confidenceAvg,
      raw_payload: payload ?? null,
    } as never,
    { onConflict: "scan_id" },
  );
  if (resultError) throw new PipelineError(resultError.message, 500);

  await storeAnnotatedImage(supabase, { id: scan.id, org_id: scan.org_id }, payload);
  await storePdfReport(supabase, { id: scan.id, org_id: scan.org_id }, payload);
  await storeCsvReport(supabase, { id: scan.id, org_id: scan.org_id }, payload);


  // --- Complete the scan ---------------------------------------------------
  const { error: completeError } = await supabase
    .from("shelf_scans")
    .update({
      status: "completed",
      total_products: totalProducts,
      out_of_stock_count: outOfStock,
      low_stock_count: lowStock,
      misplaced_count: misplaced,
      shelf_health_score: health,
      osa_percent: osa,
      share_of_shelf_percent: shareOfShelf,
      planogram_compliance_percent: compliance,
      processing_completed_at: completedAt,
      error_message: null,
    })
    .eq("id", scan.id);
  if (completeError) throw new PipelineError(completeError.message, 500);

  await refreshAnalytics(supabase, { org_id: scan.org_id, store_id: scan.store_id });

  return {
    scan_id: scan.id,
    status: "completed",
    total_products: totalProducts,
    out_of_stock_count: outOfStock,
    low_stock_count: lowStock,
    misplaced_count: misplaced,
    shelf_health_score: health,
    learned_saved: learned.saved,
    learned_error: learned.error,

  };
}

export type StartPipelineResult =
  | { status: "processing"; scan_id: string; job_id: string | null; started_at: string }
  | ({ status: "completed"; job_id: null; started_at: string } & PipelineResult);

/**
 * Short request: signs the images, submits the job to Railway and returns
 * immediately. The client then calls `pollScanPipelineServer` every few
 * seconds, so no single request ever blocks for minutes.
 */
export async function startScanPipelineServer(
  supabase: DB,
  scanId: string,
): Promise<StartPipelineResult> {
  const scan = await loadScan(supabase, scanId);
  const startedAt = new Date().toISOString();
  await supabase
    .from("shelf_scans")
    .update({ status: "processing", processing_started_at: startedAt, error_message: null })
    .eq("id", scan.id);

  try {
    const body = await buildVisionRequest(supabase, scan, startedAt);
    const submitted = await submitVisionJob(body);

    if (submitted.kind === "completed") {
      const result = await persistScanPayload(supabase, scan, submitted.payload, startedAt);
      return { ...result, job_id: null, started_at: startedAt };
    }
    return {
      status: "processing",
      scan_id: scan.id,
      job_id: submitted.jobId,
      started_at: startedAt,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The AI scan pipeline failed unexpectedly.";
    await markFailed(supabase, scan.id, message);
    if (error instanceof PipelineError) throw error;
    throw new PipelineError(message, 500);
  }
}

export type PollPipelineResult =
  | { status: "processing"; scan_id: string }
  | ({ status: "completed" } & PipelineResult);

/** Single short poll of the Railway job; persists everything once it completes. */
export async function pollScanPipelineServer(
  supabase: DB,
  scanId: string,
  jobId?: string | null,
): Promise<PollPipelineResult> {
  const scan = await loadScan(supabase, scanId);

  // Already finished (e.g. persisted by an earlier poll) — report it as done.
  const { data: existing } = await supabase
    .from("shelf_scans")
    .select(
      "status, total_products, out_of_stock_count, low_stock_count, misplaced_count, shelf_health_score",
    )
    .eq("id", scan.id)
    .maybeSingle();
  if (existing?.status === "completed") {
    // Older scans can be missing their generated PDF / annotated assets.
    try {
      await backfillScanAssetsServer(supabase, scan.id);
    } catch {
      // downloads are optional — never block the results redirect
    }
    return {
      status: "completed",
      scan_id: scan.id,
      total_products: (existing.total_products as number) ?? 0,
      out_of_stock_count: (existing.out_of_stock_count as number) ?? 0,
      low_stock_count: (existing.low_stock_count as number) ?? 0,
      misplaced_count: (existing.misplaced_count as number) ?? 0,
      shelf_health_score: (existing.shelf_health_score as number | null) ?? null,
    };
  }

  try {
    const poll = await pollVisionJobOnce(jobId ?? scan.id);
    if (poll.kind === "processing") return { status: "processing", scan_id: scan.id };
    const startedAt = new Date().toISOString();
    return await persistScanPayload(supabase, scan, poll.payload, startedAt);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The AI scan pipeline failed unexpectedly.";
    await markFailed(supabase, scan.id, message);
    if (error instanceof PipelineError) throw error;
    throw new PipelineError(message, 500);
  }
}

/** Legacy single-request pipeline (kept for existing callers / retries). */
export async function runScanPipelineServer(
  supabase: DB,
  scanId: string,
): Promise<PipelineResult> {
  const scan = await loadScan(supabase, scanId);
  const startedAt = new Date().toISOString();
  await supabase
    .from("shelf_scans")
    .update({ status: "processing", processing_started_at: startedAt, error_message: null })
    .eq("id", scan.id);

  try {
    const body = await buildVisionRequest(supabase, scan, startedAt);
    const payload = await callVisionApi(body);
    return await persistScanPayload(supabase, scan, payload, startedAt);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The AI scan pipeline failed unexpectedly.";
    await markFailed(supabase, scan.id, message);
    if (error instanceof PipelineError) throw error;
    throw new PipelineError(message, 500);
  }
}


/* -------------------------------------------------------------------------- */
/* Download asset backfill                                                    */
/* -------------------------------------------------------------------------- */

export type BackfillAssetsResult = {
  scan_id: string;
  pdf: boolean;
  annotated: boolean;
  csv: boolean;
};

async function existingAssetKinds(supabase: DB, scanId: string): Promise<Set<string>> {
  const { data } = await supabase.from("scan_images").select("kind").eq("scan_id", scanId);
  return new Set((data ?? []).map((row) => row.kind as string));
}

/**
 * Ensures a completed scan has its PDF / annotated / CSV assets in storage.
 *
 * 1. Re-uses base64 files already saved on `scan_results.raw_payload`.
 * 2. Falls back to the Railway `POST /scan/export-assets` endpoint, which
 *    regenerates the report from the original shelf image.
 */
export async function backfillScanAssetsServer(
  supabase: DB,
  scanId: string,
): Promise<BackfillAssetsResult> {
  const scan = await loadScan(supabase, scanId);
  let kinds = await existingAssetKinds(supabase, scan.id);
  const done = () => ({
    scan_id: scan.id,
    pdf: kinds.has("pdf") || kinds.has("report"),
    annotated: kinds.has("annotated"),
    csv: kinds.has("csv"),
  });
  if (done().pdf && done().annotated && done().csv) return done();

  const target = { id: scan.id, org_id: scan.org_id };

  // Step 1 — replay whatever the original vision response already returned.
  const { data: result } = await supabase
    .from("scan_results")
    .select("raw_payload")
    .eq("scan_id", scan.id)
    .maybeSingle();
  const payload = (result?.raw_payload ?? null) as any;
  if (payload) {
    if (!done().annotated) await storeAnnotatedImage(supabase, target, payload);
    if (!done().pdf) await storePdfReport(supabase, target, payload);
    if (!done().csv) await storeCsvReport(supabase, target, payload);
    kinds = await existingAssetKinds(supabase, scan.id);
    if (done().pdf && done().annotated && done().csv) return done();
  }

  // Step 2 — ask the vision backend to regenerate the missing exports.
  const { data: originals } = await supabase
    .from("scan_images")
    .select("storage_bucket, storage_path")
    .eq("scan_id", scan.id)
    .eq("kind", "original")
    .order("created_at", { ascending: true })
    .limit(1);
  const original = originals?.[0];
  if (!original) return done();

  const { data: signed } = await supabase.storage
    .from(original.storage_bucket as string)
    .createSignedUrl(original.storage_path as string, 3600);
  if (!signed?.signedUrl) return done();

  const { baseUrl, apiKey, timeoutMs } = visionConfig();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };
  if (apiKey) {
    headers["authorization"] = `Bearer ${apiKey}`;
    headers["x-api-key"] = apiKey;
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/scan/export-assets`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        image_url: signed.signedUrl,
        scan_id: scan.id,
        store_id: scan.store_id,
        shelf_label: scan.shelf_label,
        category: scan.category,
      }),
      signal: AbortSignal.timeout(Math.min(timeoutMs, 300_000)),
    });
  } catch {
    throw new PipelineError(
      "Could not reach the report service to rebuild this download. Please try again.",
      504,
    );
  }
  const text = await response.text();
  if (!response.ok) {
    throw new PipelineError(
      `The report service could not rebuild this download (${response.status}).`,
      response.status >= 500 ? 502 : response.status,
    );
  }
  const exported = parseJson(text);

  if (!done().annotated) await storeAnnotatedImage(supabase, target, exported);
  if (!done().pdf) await storePdfReport(supabase, target, exported);
  if (!done().csv) await storeCsvReport(supabase, target, exported);
  kinds = await existingAssetKinds(supabase, scan.id);
  return done();
}
