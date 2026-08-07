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
  const timeoutMs = Number(process.env["AISLIX_AI_TIMEOUT_MS"]) || 180_000;
  return {
    url: `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`,
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
  const source = arr(payload?.products).length
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

async function callVisionApi(body: unknown): Promise<any> {
  const { url, apiKey, timeoutMs } = visionConfig();

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

  try {
    return JSON.parse(text);
  } catch {
    throw new PipelineError("The AI vision backend returned a response that was not valid JSON.");
  }
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
/* Pipeline                                                                   */
/* -------------------------------------------------------------------------- */

export async function runScanPipelineServer(
  supabase: DB,
  scanId: string,
): Promise<PipelineResult> {
  const { data: scan, error: scanError } = await supabase
    .from("shelf_scans")
    .select("id, org_id, store_id, status, shelf_label, category, notes")
    .eq("id", scanId)
    .maybeSingle();
  if (scanError) throw new PipelineError(scanError.message, 500);
  if (!scan) throw new PipelineError("Scan not found.", 404);

  const startedAt = new Date().toISOString();
  await supabase
    .from("shelf_scans")
    .update({ status: "processing", processing_started_at: startedAt, error_message: null })
    .eq("id", scan.id);

  try {
    // --- Signed URLs for every uploaded original image ----------------------
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

    // --- Call the Railway FastAPI vision backend ---------------------------
    const payload = await callVisionApi({
      scan_id: scan.id,
      org_id: scan.org_id,
      store_id: scan.store_id,
      shelf_label: scan.shelf_label,
      category: scan.category,
      notes: scan.notes,
      image_urls: signedImages.map((i) => i.url),
      images: signedImages,
      requested_at: startedAt,
    });

    const products = normalizeProducts(payload);
    if (!products.length) {
      throw new PipelineError(
        "The AI vision backend did not detect any products in this shelf image.",
        422,
      );
    }

    // --- Persist detected products -----------------------------------------
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

    // --- Metrics -----------------------------------------------------------
    const metricsSource = (payload?.metrics ?? payload?.summary ?? payload) as any;
    const outOfStock = products.filter((p) => p.stock_status === "out_of_stock").length;
    const lowStock = products.filter((p) => p.stock_status === "low_stock").length;
    const misplaced = products.filter((p) => p.stock_status === "misplaced").length;
    const confidences = products
      .map((p) => p.confidence)
      .filter((c): c is number => c !== null);
    const confidenceAvg = confidences.length
      ? Number((confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(4))
      : null;

    const osa =
      pct(metricsSource?.osa_percent ?? metricsSource?.on_shelf_availability) ??
      Number((((products.length - outOfStock) / products.length) * 100).toFixed(2));
    const compliance = pct(
      metricsSource?.planogram_compliance_percent ?? metricsSource?.planogram_compliance,
    );
    const shareOfShelf = pct(
      metricsSource?.share_of_shelf_percent ?? metricsSource?.share_of_shelf,
    );
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

    const metrics = {
      total_products: products.length,
      unique_skus: new Set(products.map((p) => `${p.brand ?? ""}::${p.name}`)).size,
      unique_brands: new Set(products.map((p) => p.brand ?? "Unknown")).size,
      total_facings: products.reduce((total, p) => total + p.facings, 0),
      out_of_stock_products: outOfStock,
      low_stock_products: lowStock,
      misplaced_products: misplaced,
      average_confidence: confidenceAvg ?? 0,
      osa_percent: osa,
      shelf_health_score: health,
      ...(compliance !== null ? { shelf_compliance: compliance } : {}),
      ...(shareOfShelf !== null ? { share_of_shelf_percent: shareOfShelf } : {}),
      processing_time_ms: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
    };

    // --- Persist the result set --------------------------------------------
    const { error: resultError } = await supabase.from("scan_results").upsert(
      {
        scan_id: scan.id,
        executive_summary:
          str(payload?.executive_summary) ?? str(payload?.summary_text) ?? null,
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

    await storeAnnotatedImage(supabase, { id: scan.id as string, org_id: scan.org_id as string }, payload);

    // --- Complete the scan -------------------------------------------------
    const { error: completeError } = await supabase
      .from("shelf_scans")
      .update({
        status: "completed",
        total_products: products.length,
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

    await refreshAnalytics(supabase, {
      org_id: scan.org_id as string,
      store_id: (scan.store_id as string | null) ?? null,
    });

    return {
      scan_id: scan.id as string,
      status: "completed",
      total_products: products.length,
      out_of_stock_count: outOfStock,
      low_stock_count: lowStock,
      misplaced_count: misplaced,
      shelf_health_score: health,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The AI scan pipeline failed unexpectedly.";
    await markFailed(supabase, scan.id as string, message);
    if (error instanceof PipelineError) throw error;
    throw new PipelineError(message, 500);
  }
}
