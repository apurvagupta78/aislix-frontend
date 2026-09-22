// Live Supabase-backed scan result loader. Everything the UI renders is
// derived from real shelf_scans / scan_results / detected_products rows.

export type Severity = "high" | "medium" | "low";

export type ScanStatus = "queued" | "processing" | "completed" | "failed";

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

export const COMPLIANCE_ALERT_TITLE = "Placement issues detected";
export const COMPLIANCE_INTERPRETATION =
  "Facings appear outside the expected category or shelf position";

export type ComplianceStatus = "ok" | "category_mismatch";

export type ComplianceAlert = {
  id: string;
  severity: Severity;
  category?: string;
  title: string;
  interpretation?: string;
  detail?: string;
  expected_sub_category_label?: string;
  misplaced_facings?: number;
};

export type SubcategoryMismatch = {
  brand: string;
  product_name: string;
  detected_sub_category_label: string;
  expected_sub_category_label: string;
  quantity: number;
  confidence?: number;
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
  out_of_stock?: boolean;
  compliance_status?: ComplianceStatus;
  compliance_alert?: string;
  compliance_interpretation?: string;
  detected_sub_category_label?: string;
  expected_sub_category_label?: string;
  /** Reserved for the shelf-position model (row / bay label). */
  shelf_position?: string;
  sku?: string;
  match_key?: string;
  name?: string;
  facings?: number;
  location?: string;
};

export type BrandShare = { brand: string; share: number; quantity?: number };
export type ConfidenceBucket = { bucket: string; count: number };
export type CategorySlice = { category: string; count: number };
export type QuantityBucket = { bucket: string; count: number };
export type LowStockRow = { label: string; low_stock: number; out_of_stock: number };


export type ScanSummary = {
  total_products: number;
  unique_skus: number;
  unique_brands: number;
  low_stock_products: number;
  average_confidence: number;
  processing_time_ms: number;
  out_of_stock_products?: number;
  /** Reserved: duplicate-facing detection ships with the shelf-position model. */
  duplicate_products?: number;
  /** 0-1 or 0-100. Planogram compliance. */
  shelf_compliance?: number;
  /** 0-100 composite shelf health score (legacy). */
  shelf_health_score?: number;
  /** 0-100 retail execution score — excludes model confidence. */
  shelf_execution_score?: number;
  /** Physical facings detected in the image. */
  total_facings?: number;
  /** Share of shelf / bbox utilization percent (legacy — prefer brand_share_percent). */
  share_of_shelf_percent?: number;
  /** All facings for the planogram/focus brand as % of scoped shelf facings. */
  brand_share_percent?: number;
  brand_share_scope?: string;
  brand_share_denominator?: number;
  brand_share_denominator_definition?: string;
  identified_brand_count?: number;
  /** Facings for the specific planogram product SKU as % of total shelf facings. */
  product_share_percent?: number;
  product_share_label?: string;
  /** SKU availability percent. */
  availability_percent?: number;
  osa_percent?: number;
  facing_compliance_percent?: number;
  placement_compliance_percent?: number;
  recognition_coverage_percent?: number;
  confirmed_oos_count?: number;
  possible_oos_count?: number;
  shelf_gap_count?: number;
  placement_issue_count?: number;
  needs_review_facings?: number;
  low_stock_threshold?: number;
  /** Total learned SKUs in the org catalog after this scan. */
  learned_catalog_size?: number;
  /** New SKUs learned during this scan. */
  learned_new_this_scan?: number;

  /** Facings detected as belonging to another sub-category. */
  misplaced_products?: number;
  /** Distinct SKU groups flagged as sub-category mismatches. */
  subcategory_mismatch_skus?: number;
};

/** Revenue at risk / estimated lost sales — never invent velocity or price. */
export type FinancialImpact = {
  /** 1 = image only (risk level), 2 = velocity+price, 3 = OOS duration */
  level?: 1 | 2 | 3;
  commercial_risk?: "low" | "medium" | "high" | "critical";
  estimated_daily_lost_sales_inr: number;
  estimated_weekly_lost_sales_inr: number;
  estimated_monthly_lost_sales_inr: number;
  oos_sku_count: number;
  at_risk_sku_count: number;
  /** Visible units × MRP from planogram pricing (Aislix). */
  visible_inventory_value_inr?: number | null;
  /** Expected shelf units × MRP. */
  expected_inventory_value_inr?: number | null;
  /** Shortfall units × MRP (potential value gap). */
  potential_inventory_value_gap_inr?: number | null;
  methodology: string;
  confidence: "indicative" | "priced" | "medium" | "high" | "low";
  source?: string;
  assumption?: string;
  estimate_status?: "estimated" | "not_estimated";
  operational_priority?: "low" | "medium" | "high" | "critical";
  missing_prerequisites?: string[];
};

/** Recognition-quality counters reported by the vision backend. */
export type ScanQuality = {
  ocr_empty_facings?: number;
  ocr_low_confidence_facings?: number;
  ocr_avg_confidence?: number;
  recognition_ocr?: number;
  recognition_faiss?: number;
  recognition_gpt?: number;
  recognition_unknown?: number;
};

export type FacingBox = { x1: number; y1: number; x2: number; y2: number };

/** A single detected facing — the unit ops corrects in the "Needs review" flow. */
export type ScanFacing = {
  id: string;
  brand: string;
  product: string;
  variant?: string;
  sku?: string;
  pack_text?: string;
  ocr_confidence?: number;
  confidence?: number;
  recognition_source?: string;
  box?: FacingBox;
};

export type ScanResult = {
  scan_id: string;
  created_at?: string;
  store?: string;
  aisle?: string;
  location?: string;
  scan_category?: string;
  scan_sub_category?: string;
  status?: ScanStatus;
  error_message?: string;
  analysis_mode?: string;
  astra_planogram_analysis?: Record<string, unknown>;
  astra_shelf_analysis?: Record<string, unknown>;
  /** Canonical shelf_cv block from the vision pipeline (Astra). */
  astra_cv_analysis?: Record<string, unknown>;
  /** Aislix calc layer over Astra CV (preferred for shelf-only UI). */
  aislix_shelf_analysis?: Record<string, unknown>;
  aislix_planogram_analysis?: Record<string, unknown>;
  /** Full metrics blob from scan_results — used to recover Astra blocks. */
  metrics?: Record<string, unknown>;
  /** Prices, promotions, and shelf issues returned at the top level of Astra JSON. */
  astra_visible_prices?: Array<Record<string, unknown>>;
  astra_visible_promotions?: Array<Record<string, unknown>>;
  astra_shelf_issues?: Array<Record<string, unknown>>;
  summary: ScanSummary;
  annotated_image_url?: string;
  /** The untouched shelf photo — used to colour-correct the annotated render. */
  original_image_url?: string;
  executive_summary?: string;
  /** Role-specific AI summaries from Astra (execution / merchandising / brand / executive). */
  role_summaries?: Partial<
    Record<"execution" | "merchandising" | "brand" | "executive", string>
  >;
  /** Structured retail intelligence payload (scores, actions, metric states). */
  retail_intelligence?: import("@/lib/retail-intelligence").RetailIntelligencePayload;
  alerts?: ScanAlert[];
  compliance_alerts?: ComplianceAlert[];
  subcategory_mismatches?: SubcategoryMismatch[];
  /** Recognition quality counters (OCR / FAISS / AI / unknown). */
  quality?: ScanQuality;
  /** Per-facing detections used by the "Needs review" correction flow. */
  facings?: ScanFacing[];
  recommendations?: ScanRecommendation[];
  competitor_intel?: CompetitorSnapshot | null;
  financial_impact?: FinancialImpact | null;
  inventory?: InventoryItem[];
  /**
   * Planogram audit context: `requested` is true when the scan carried expected
   * products (assignment or ad-hoc Option 2), so the results page can show the
   * planogram section — or a warning when the backend returned nothing.
   */
  planogram?: {
    requested: boolean;
    percent: number | null;
    /** SKU presence match % (headline) as reported by the vision backend. */
    sku_match_percent: number | null;
    /** Quantity accuracy % — can be lower than the SKU match headline. */
    qty_compliance_percent: number | null;
    summary: Record<string, unknown>;
  };


  charts?: {
    top_brands?: BrandShare[];
    confidence_distribution?: ConfidenceBucket[];
    category_distribution?: CategorySlice[];
    quantity_distribution?: QuantityBucket[];
    low_stock_summary?: LowStockRow[];
  };
  downloads?: {
    pdf_url?: string;
    csv_url?: string;
    json_url?: string;
    annotated_image_url?: string;
  };
  share?: {
    /** Future: signed public link generated by the backend. */
    public_url?: string | null;
    email_enabled?: boolean;
    team_sharing_enabled?: boolean;
  };
  /** Number of shelf photos merged for this audit (P2 multi-photo). */
  photo_count?: number;
  parent_scan_id?: string | null;
  navigation?: {
    previous_scan_id?: string | null;
    next_scan_id?: string | null;
    previous_execution_score?: number | null;
  };
};

import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { CompetitorSnapshot } from "@/lib/brand-intel";
import { annotateCompetitorCategories, buildCompetitorSnapshot } from "@/lib/brand-intel";
import { enrichScanResultWithAstra } from "@/lib/ai-audit/astra-display";
import { normalizeAstraAnalysis } from "@/lib/ai-audit/astra-response";
import {
  formatCategorySelections,
  parseCategorySelections,
} from "@/lib/category-selections";
import { dbError, notFound, requireOrgId } from "@/lib/db/context";
import { parseAdhocPlanogram } from "@/lib/role-planogram-requirements";
import {
  listScanFieldVerifications,
  type FieldVerification,
} from "@/lib/ai-audit/field-verifications";


function severityFromAlert(value: unknown): Severity {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "medium";
}

function mapAlerts(raw: unknown): ScanAlert[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item: any) => item?.id !== "category-mismatch" && item?.category !== "compliance")
    .map((item: any, index) => ({
      id: item?.id ?? `alert-${index}`,
      severity: severityFromAlert(item?.severity),
      title: item?.title ?? "Alert",
      detail: item?.detail ?? undefined,
    }));
}


function mapComplianceAlerts(raw: unknown): ComplianceAlert[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any, index) => ({
    id: item?.id ?? `category-mismatch-${index}`,
    severity: severityFromAlert(item?.severity === "critical" ? "high" : item?.severity),
    category: item?.category ?? "compliance",
    title: item?.title ?? COMPLIANCE_ALERT_TITLE,
    interpretation: item?.interpretation ?? COMPLIANCE_INTERPRETATION,
    detail: item?.detail ?? undefined,
    expected_sub_category_label: item?.expected_sub_category_label ?? undefined,
    ...(typeof item?.misplaced_facings === "number"
      ? { misplaced_facings: Number(item.misplaced_facings) }
      : {}),
  }));
}

const QUALITY_KEYS = [
  "ocr_empty_facings",
  "ocr_low_confidence_facings",
  "ocr_avg_confidence",
  "recognition_ocr",
  "recognition_faiss",
  "recognition_gpt",
  "recognition_unknown",
] as const;

function mapQuality(metrics: Record<string, unknown>): ScanQuality {
  const quality: ScanQuality = {};
  for (const key of QUALITY_KEYS) {
    const value = metrics[key];
    if (typeof value === "number" && Number.isFinite(value)) quality[key] = value;
  }
  return quality;
}

function mapFinancialImpact(raw: unknown): FinancialImpact | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const num = (key: string) =>
    typeof row[key] === "number" && Number.isFinite(row[key]) ? Number(row[key]) : null;
  const daily = num("estimated_daily_lost_sales_inr");
  if (daily === null) return null;
  return {
    estimated_daily_lost_sales_inr: daily,
    estimated_weekly_lost_sales_inr: num("estimated_weekly_lost_sales_inr") ?? daily * 7,
    estimated_monthly_lost_sales_inr: num("estimated_monthly_lost_sales_inr") ?? daily * 30,
    oos_sku_count: num("oos_sku_count") ?? 0,
    at_risk_sku_count: num("at_risk_sku_count") ?? 0,
    visible_inventory_value_inr: num("visible_inventory_value_inr"),
    expected_inventory_value_inr: num("expected_inventory_value_inr"),
    potential_inventory_value_gap_inr: num("potential_inventory_value_gap_inr"),
    methodology:
      typeof row.methodology === "string"
        ? row.methodology
        : "Indicative estimate using category ASP defaults and typical daily velocity.",
    confidence: row.confidence === "priced" ? "priced" : "indicative",
    estimate_status: row.estimate_status === "estimated" ? "estimated" : row.estimate_status === "not_estimated" ? "not_estimated" : undefined,
    source: typeof row.source === "string" ? row.source : undefined,
  };
}

function boxFrom(raw: unknown): FacingBox | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const nums = ["x1", "y1", "x2", "y2"].map((k) => Number(r[k]));
  if (nums.some((n) => !Number.isFinite(n))) return undefined;
  return { x1: nums[0]!, y1: nums[1]!, x2: nums[2]!, y2: nums[3]! };
}

/**
 * Per-facing rows for the correction workflow. The backend's optional
 * `facings_debug[]` export wins; otherwise we fall back to stored
 * detected_products rows (which carry a bounding box and confidence).
 */
function mapFacings(rawPayload: any, products: any[]): ScanFacing[] {
  const debug = Array.isArray(rawPayload?.facings_debug) ? rawPayload.facings_debug : null;
  if (debug?.length) {
    return debug.map((row: any, index: number) => ({
      id: String(row?.id ?? `facing-${index}`),
      brand: row?.brand ?? "Unknown",
      product: row?.product_name ?? row?.product ?? "Unknown product",
      ...(row?.sku ? { sku: String(row.sku) } : {}),
      ...(row?.pack_text ? { pack_text: String(row.pack_text) } : {}),
      ...(typeof row?.ocr_confidence === "number" ? { ocr_confidence: row.ocr_confidence } : {}),
      ...(typeof row?.confidence === "number" ? { confidence: row.confidence } : {}),
      ...(row?.recognition_source ? { recognition_source: String(row.recognition_source) } : {}),
      ...(boxFrom(row) ? { box: boxFrom(row)! } : {}),
    }));
  }
  return products.map((p, index) => ({
    id: String(p?.id ?? `facing-${index}`),
    brand: (p?.brand as string | null) ?? "Unknown",
    product: (p?.name as string | null) ?? "Unknown product",
    ...(p?.sku ? { sku: String(p.sku) } : {}),
    ...(typeof p?.confidence === "number" ? { confidence: Number(p.confidence) } : {}),
    ...(boxFrom(p?.bounding_box) ? { box: boxFrom(p.bounding_box)! } : {}),
  }));
}

/** Facings a human should double-check: unknown source or weak confidence. */
export function needsReviewFacings(result?: ScanResult | null): ScanFacing[] {
  const facings = result?.facings ?? [];
  return facings.filter((f) => {
    const source = (f.recognition_source ?? "").toLowerCase();
    if (source === "unknown" || !f.brand || f.brand.toLowerCase() === "unknown") return true;
    const conf = normalizeConfidence(f.ocr_confidence ?? f.confidence ?? 1);
    return conf < 70;
  });
}

/** True when the backend reported low-confidence or unrecognised facings. */
export function hasReviewSignals(result?: ScanResult | null): boolean {
  const q = result?.quality ?? {};
  return (
    (q.ocr_low_confidence_facings ?? 0) > 0 ||
    (q.recognition_unknown ?? 0) > 0 ||
    needsReviewFacings(result).length > 0
  );
}

function mapSubcategoryMismatches(raw: unknown): SubcategoryMismatch[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    brand: item?.brand ?? "Unknown",
    product_name: item?.product_name ?? item?.name ?? "Unknown product",
    detected_sub_category_label: item?.detected_sub_category_label ?? "—",
    expected_sub_category_label: item?.expected_sub_category_label ?? "—",
    quantity: Number(item?.quantity) || 0,
    ...(item?.confidence !== null && item?.confidence !== undefined
      ? { confidence: Number(item.confidence) }
      : {}),
  }));
}


function mapRecommendations(raw: unknown): ScanRecommendation[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any, index) => ({
    id: item?.id ?? `rec-${index}`,
    title: item?.title ?? "Recommendation",
    detail: item?.detail ?? undefined,
    category: item?.category ?? undefined,
    impact: item?.impact ?? undefined,
  }));
}

function mapBrandShare(raw: unknown): BrandShare[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({ brand: item?.brand ?? "Unknown", share: Number(item?.share) || 0 }))
    .filter((item) => item.brand);
}

function mapCategoryBreakdown(raw: unknown): CategorySlice[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({ category: item?.category ?? "Unknown", count: Number(item?.count) || 0 }))
    .filter((item) => item.category);
}

function emptyScanSummary(): ScanSummary {
  return {
    total_products: 0,
    unique_skus: 0,
    unique_brands: 0,
    low_stock_products: 0,
    average_confidence: 0,
    processing_time_ms: 0,
  };
}

async function signImageUrl(
  bucket: string,
  path: string,
): Promise<string | undefined> {
  try {
    const signed = await Promise.race([
      supabase.storage.from(bucket).createSignedUrl(path, 3600),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
    ]);
    if (!signed || !("data" in signed)) return undefined;
    return signed.data?.signedUrl;
  } catch {
    return undefined;
  }
}

/** Loads the full result payload for one scan from Supabase. */
export async function fetchScanResult(scanId: string, signal?: AbortSignal): Promise<ScanResult> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const orgId = await requireOrgId();

  const { data: scan, error: scanError } = await supabase
    .from("shelf_scans")
    .select(
      "id, org_id, status, shelf_label, category, sub_category, sub_category_label, sub_category_custom, category_selections, created_at, processing_started_at, processing_completed_at, shelf_health_score, osa_percent, share_of_shelf_percent, planogram_compliance_percent, total_products, out_of_stock_count, low_stock_count, misplaced_count, store_id, assignment_id, adhoc_planogram, photo_count, parent_scan_id, error_message, stores(name)",
    )
    .eq("org_id", orgId)
    .eq("id", scanId)
    .maybeSingle();
  if (scanError) return dbError(scanError, "Could not load this audit.");
  if (!scan) notFound("Audit not found.");

  const scanStatus = scan.status as ScanStatus;
  if (scanStatus === "processing" || scanStatus === "queued") {
    return {
      scan_id: scan.id as string,
      created_at: scan.created_at as string,
      status: scanStatus,
      summary: emptyScanSummary(),
    };
  }
  if (scanStatus === "failed") {
    return {
      scan_id: scan.id as string,
      created_at: scan.created_at as string,
      status: scanStatus,
      summary: emptyScanSummary(),
      error_message:
        typeof (scan as { error_message?: string | null }).error_message === "string"
          ? (scan as { error_message: string }).error_message
          : undefined,
    };
  }

  // Never select raw_payload here — it can contain multi-MB base64 images and
  // will timeout the browser. Assets live in scan_images; metrics hold the rest.
  const [{ data: result }, { data: products }, { data: images }, { data: correctionRows }] =
    await Promise.all([
      supabase
        .from("scan_results")
        .select(
          "executive_summary, metrics, alerts, recommendations, brand_share, category_breakdown, confidence_avg",
        )
        .eq("scan_id", scanId)
        .maybeSingle(),
      supabase
        .from("detected_products")
        .select(
          "id, name, brand, variant, category, facings, shelf_row, stock_status, confidence, expected_facings, sku, bounding_box",
        )
        .eq("scan_id", scanId)
        .limit(500),
      supabase.from("scan_images").select("kind, storage_bucket, storage_path").eq("scan_id", scanId),
      supabase
        .from("scan_corrections")
        .select(
          "predicted_brand, predicted_product, corrected_brand, corrected_product, corrected_variant, created_at",
        )
        .eq("scan_id", scan.id as string)
        .order("created_at", { ascending: true }),
    ]);

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const annotated = images?.find((img) => img.kind === "annotated");
  const original = images?.find((img) => img.kind === "original");
  const pdf = images?.find((img) => img.kind === "pdf" || img.kind === "report");
  const csv = images?.find((img) => img.kind === "csv");
  const [annotatedUrl, originalUrl, pdfUrl, csvUrl] = await Promise.all([
    annotated
      ? signImageUrl(annotated.storage_bucket as string, annotated.storage_path as string)
      : Promise.resolve(undefined),
    original
      ? signImageUrl(original.storage_bucket as string, original.storage_path as string)
      : Promise.resolve(undefined),
    pdf
      ? signImageUrl(pdf.storage_bucket as string, pdf.storage_path as string)
      : Promise.resolve(undefined),
    csv
      ? signImageUrl(csv.storage_bucket as string, csv.storage_path as string)
      : Promise.resolve(undefined),
  ]);
  const annotatedImageSrc = annotatedUrl;
  const originalImageSrc = originalUrl;
  const correctionByLabel = new Map<
    string,
    { brand?: string | null; product?: string | null; variant?: string | null }
  >();
  for (const row of (correctionRows ?? []) as any[]) {
    const key = `${row.predicted_brand ?? ""}::${row.predicted_product ?? ""}`.toLowerCase();
    correctionByLabel.set(key, {
      brand: row.corrected_brand,
      product: row.corrected_product,
      variant: row.corrected_variant,
    });
  }

  const inventory: InventoryItem[] = [];
  const grouped = new Map<string, InventoryItem>();
  for (const p of products ?? []) {
    const rawBrand = (p.brand as string | null) ?? "Unknown";
    const rawProduct = (p.name as string | null) ?? "Unknown product";
    const fix = correctionByLabel.get(`${rawBrand}::${rawProduct}`.toLowerCase());
    const brand = fix?.brand || rawBrand;
    const product = fix?.product || rawProduct;
    const variant = fix?.variant || (p as { variant?: string | null }).variant || "";
    const key = `${brand}::${product}::${variant}`;
    const qty = Number(p.facings) || 1;
    const confidence = Number(p.confidence) || 0;
    const mismatch = (p.stock_status as string | null) === "misplaced";
    const status: ComplianceStatus | undefined = mismatch ? "category_mismatch" : undefined;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += qty;
      existing.confidence = Math.max(existing.confidence, confidence);
      if (mismatch) {
        existing.compliance_status = "category_mismatch";
        existing.compliance_interpretation =
          existing.compliance_interpretation ?? COMPLIANCE_INTERPRETATION;
      } else if (!existing.compliance_status && status) {
        existing.compliance_status = status;
      }
    } else {
      grouped.set(key, {
        id: p.id as string,
        brand,
        product,
        variant: variant || undefined,
        quantity: qty,
        confidence,
        category: (p.category as string | null) ?? undefined,
        ...(status ? { compliance_status: status } : {}),
        ...(mismatch ? { compliance_interpretation: COMPLIANCE_INTERPRETATION } : {}),
        shelf_position: p.shelf_row === null || p.shelf_row === undefined ? undefined : String(p.shelf_row),
      });
    }

  }

  // Stock flags are derived from the aggregated facing count, not individual rows.
  for (const item of grouped.values()) {
    item.out_of_stock = item.quantity === 0;
    item.low_stock = item.quantity > 0 && item.quantity <= 2;
  }
  inventory.push(...grouped.values());

  // Derived chart buckets from real detected_products rows only.
  const confidenceBuckets: ConfidenceBucket[] = [
    { bucket: "0-50%", count: 0 },
    { bucket: "50-75%", count: 0 },
    { bucket: "75-90%", count: 0 },
    { bucket: "90-100%", count: 0 },
  ];
  for (const item of inventory) {
    const pct = item.confidence <= 1 ? item.confidence * 100 : item.confidence;
    if (pct < 50) confidenceBuckets[0]!.count++;
    else if (pct < 75) confidenceBuckets[1]!.count++;
    else if (pct < 90) confidenceBuckets[2]!.count++;
    else confidenceBuckets[3]!.count++;
  }

  const quantityBucketDefs: [string, (q: number) => boolean][] = [
    ["0", (q) => q === 0],
    ["1-3", (q) => q >= 1 && q <= 3],
    ["4-6", (q) => q >= 4 && q <= 6],
    ["7+", (q) => q >= 7],
  ];
  const quantityBuckets: QuantityBucket[] = quantityBucketDefs.map(([bucket, match]) => ({
    bucket,
    count: inventory.filter((i) => match(i.quantity)).length,
  }));

  const lowStockByCategory = new Map<string, { low: number; out: number }>();
  for (const item of inventory) {
    const key = item.category ?? "Uncategorized";
    const entry = lowStockByCategory.get(key) ?? { low: 0, out: 0 };
    if (item.low_stock) entry.low++;
    if (item.out_of_stock) entry.out++;
    lowStockByCategory.set(key, entry);
  }
  const lowStockSummary: LowStockRow[] = Array.from(lowStockByCategory.entries())
    .filter(([, v]) => v.low > 0 || v.out > 0)
    .map(([label, v]) => ({ label, low_stock: v.low, out_of_stock: v.out }));

  const startedAt = scan.processing_started_at ? new Date(scan.processing_started_at).getTime() : undefined;
  const completedAt = scan.processing_completed_at ? new Date(scan.processing_completed_at).getTime() : undefined;
  const processingTimeMs = startedAt !== undefined && completedAt !== undefined ? completedAt - startedAt : 0;

  // Prefer the backend's own SKU count; otherwise dedupe on brand|product|variant
  // so flavour variants (e.g. Lay's Magic Masala vs Tomato Tango) count separately.
  const backendUniqueSkus = Number((result?.metrics as any)?.unique_skus);
  const uniqueSkus = Math.max(
    Number.isFinite(backendUniqueSkus) ? backendUniqueSkus : 0,
    countUniqueSkus(inventory),
  );
  const uniqueBrands = new Set(inventory.map((i) => i.brand)).size;
  const avgConfidence =
    result?.confidence_avg ??
    (inventory.length ? inventory.reduce((sum, i) => sum + i.confidence, 0) / inventory.length : 0);

  const metricsAny = (result?.metrics ?? {}) as Record<string, unknown>;
  const metricsNum = (key: string): number | undefined =>
    typeof metricsAny[key] === "number" ? Number(metricsAny[key]) : undefined;

  const inventoryFacingSum = inventory.reduce((n, i) => n + i.quantity, 0);
  const totalFacings =
    metricsNum("total_facings") ??
    (inventoryFacingSum > 0
      ? inventoryFacingSum
      : scan.total_products !== null && scan.total_products !== undefined
        ? Number(scan.total_products)
        : 0);

  // Products = unique SKUs — never copy facing totals into total_products.
  const productCount = uniqueSkus > 0 ? uniqueSkus : inventory.length;

  const summary: ScanSummary = {
    total_products: productCount,
    total_facings: totalFacings,
    unique_skus: uniqueSkus,
    unique_brands: uniqueBrands,
    // Only genuinely low-stock products; out-of-stock is reported separately.
    low_stock_products: inventory.filter((i) => i.low_stock).length,
    average_confidence:
      avgConfidence !== null && avgConfidence !== undefined && Number(avgConfidence) > 0
        ? Number(avgConfidence)
        : 0,
    processing_time_ms: processingTimeMs,
    ...(scan.out_of_stock_count !== null && scan.out_of_stock_count !== undefined
      ? { out_of_stock_products: scan.out_of_stock_count }
      : { out_of_stock_products: inventory.filter((i) => i.out_of_stock).length }),
    ...(metricsNum("confirmed_oos_count") !== undefined
      ? { confirmed_oos_count: metricsNum("confirmed_oos_count") }
      : {}),
    ...(metricsNum("possible_oos_count") !== undefined
      ? { possible_oos_count: metricsNum("possible_oos_count") }
      : {}),
    ...(metricsNum("shelf_gap_count") !== undefined ? { shelf_gap_count: metricsNum("shelf_gap_count") } : {}),
    ...(metricsNum("placement_issue_count") !== undefined
      ? { placement_issue_count: metricsNum("placement_issue_count") }
      : {}),
    ...(metricsNum("needs_review_facings") !== undefined
      ? { needs_review_facings: metricsNum("needs_review_facings") }
      : {}),
    ...(metricsNum("low_stock_threshold") !== undefined
      ? { low_stock_threshold: metricsNum("low_stock_threshold") }
      : { low_stock_threshold: 2 }),
    ...(scan.planogram_compliance_percent !== null && scan.planogram_compliance_percent !== undefined
      ? { shelf_compliance: scan.planogram_compliance_percent }
      : {}),
    ...(metricsNum("shelf_execution_score") !== undefined
      ? { shelf_execution_score: metricsNum("shelf_execution_score") }
      : {}),
    ...(scan.shelf_health_score !== null && scan.shelf_health_score !== undefined
      ? { shelf_health_score: scan.shelf_health_score }
      : metricsNum("shelf_health_score") !== undefined
        ? { shelf_health_score: metricsNum("shelf_health_score") }
        : {}),
    ...(metricsNum("share_of_shelf_percent") !== undefined
      ? { share_of_shelf_percent: metricsNum("share_of_shelf_percent") }
      : scan.share_of_shelf_percent !== null && (scan as any).share_of_shelf_percent !== undefined
        ? { share_of_shelf_percent: Number((scan as any).share_of_shelf_percent) }
        : {}),
    ...(metricsNum("availability_percent") !== undefined
      ? { availability_percent: metricsNum("availability_percent") }
      : scan.osa_percent !== null && scan.osa_percent !== undefined
        ? { availability_percent: Number(scan.osa_percent), osa_percent: Number(scan.osa_percent) }
        : {}),
    ...(metricsNum("facing_compliance_percent") !== undefined
      ? { facing_compliance_percent: metricsNum("facing_compliance_percent") }
      : {}),
    ...(metricsNum("placement_compliance_percent") !== undefined
      ? { placement_compliance_percent: metricsNum("placement_compliance_percent") }
      : {}),
    ...(metricsNum("recognition_coverage_percent") !== undefined
      ? { recognition_coverage_percent: metricsNum("recognition_coverage_percent") }
      : {}),
    ...(typeof (result?.metrics as any)?.learned_catalog_size === "number"
      ? { learned_catalog_size: Number((result?.metrics as any).learned_catalog_size) }
      : {}),
    ...(typeof (result?.metrics as any)?.learned_new_this_scan === "number"
      ? { learned_new_this_scan: Number((result?.metrics as any).learned_new_this_scan) }
      : {}),
    ...(typeof (result?.metrics as any)?.misplaced_products === "number"
      ? { misplaced_products: Number((result?.metrics as any).misplaced_products) }
      : scan.misplaced_count !== null && scan.misplaced_count !== undefined
        ? { misplaced_products: scan.misplaced_count }
        : {}),
    ...(typeof (result?.metrics as any)?.subcategory_mismatch_skus === "number"
      ? { subcategory_mismatch_skus: Number((result?.metrics as any).subcategory_mismatch_skus) }
      : {}),
    ...(metricsNum("brand_share_percent") !== undefined
      ? { brand_share_percent: metricsNum("brand_share_percent") }
      : {}),
    ...((result?.metrics as any)?.brand_share_scope
      ? { brand_share_scope: String((result?.metrics as any).brand_share_scope) }
      : {}),
    ...(metricsNum("brand_share_denominator") !== undefined
      ? { brand_share_denominator: metricsNum("brand_share_denominator") }
      : {}),
    ...(typeof (result?.metrics as any)?.brand_share_denominator_definition === "string"
      ? {
          brand_share_denominator_definition: (result?.metrics as any)
            .brand_share_denominator_definition as string,
        }
      : {}),
    ...(typeof (result?.metrics as any)?.identified_brand_count === "number"
      ? { identified_brand_count: Number((result?.metrics as any).identified_brand_count) }
      : {}),
    ...(metricsNum("product_share_percent") !== undefined
      ? { product_share_percent: metricsNum("product_share_percent") }
      : {}),
  };

  const complianceAlerts = mapComplianceAlerts((result?.metrics as any)?.compliance_alerts);
  const subcategoryMismatches = mapSubcategoryMismatches(
    (result?.metrics as any)?.subcategory_mismatches,
  );

  // Enrich inventory rows with the compliance detail the backend reports per SKU
  // group so exports and tables carry the same labels.
  const auditSubLabel =
    ((scan as any).sub_category_custom as string | null | undefined) ||
    ((scan as any).sub_category_label as string | null | undefined) ||
    complianceAlerts[0]?.expected_sub_category_label ||
    undefined;
  const mismatchByKey = new Map<string, SubcategoryMismatch>();
  for (const m of subcategoryMismatches) {
    mismatchByKey.set(`${m.brand.toLowerCase()}::${m.product_name.toLowerCase()}`, m);
  }
  for (const item of inventory) {
    const match = mismatchByKey.get(`${item.brand.toLowerCase()}::${item.product.toLowerCase()}`);
    if (match) {
      item.compliance_status = "category_mismatch";
      item.compliance_interpretation = item.compliance_interpretation ?? COMPLIANCE_INTERPRETATION;
      item.detected_sub_category_label = match.detected_sub_category_label;
      item.expected_sub_category_label = match.expected_sub_category_label;
    }
    const mismatch = item.compliance_status === "category_mismatch";
    item.compliance_alert = mismatch
      ? COMPLIANCE_ALERT_TITLE
      : item.compliance_status === "ok"
        ? "OK"
        : "";

    if (mismatch && !item.expected_sub_category_label && auditSubLabel) {
      item.expected_sub_category_label = auditSubLabel;
    }
  }



  const storeName = (scan as any).stores?.name as string | undefined;
  const storeId = (scan as any).store_id as string | null | undefined;

  const planogramPercent =
    scan.planogram_compliance_percent !== null && scan.planogram_compliance_percent !== undefined
      ? Number(scan.planogram_compliance_percent)
      : typeof metricsAny["planogram_compliance_percent"] === "number"
        ? Number(metricsAny["planogram_compliance_percent"])
        : null;
  let planogramSummary = (metricsAny["planogram_summary"] ?? {}) as Record<string, unknown>;
  const adhocParsed = parseAdhocPlanogram((scan as any).adhoc_planogram);
  const adhocRows = adhocParsed.rows;
  if (
    !Array.isArray(planogramSummary.configured_rows) &&
    adhocRows.length
  ) {
    planogramSummary = { ...planogramSummary, configured_rows: adhocRows };
  }
  const metricNum = (key: string): number | null =>
    typeof metricsAny[key] === "number" ? Number(metricsAny[key]) : null;
  const planogramSkuMatchPercent = metricNum("planogram_sku_match_percent") ?? planogramPercent;
  const planogramQtyCompliancePercent = metricNum("planogram_qty_compliance_percent");
  const configuredSummaryRows = Array.isArray(planogramSummary.configured_rows)
    ? planogramSummary.configured_rows
    : [];
  const metricsAnalysisMode = String(metricsAny["analysis_mode"] ?? "").toLowerCase();
  const adhocAnalysisMode = String(adhocParsed.analysis_mode ?? "").toLowerCase();
  const resolvedAnalysisMode = adhocAnalysisMode || metricsAnalysisMode;
  // Explicit shelf-only audits must never be treated as planogram just because
  // an assignment_id exists (self-serve AI audits create an assignment row).
  const shelfOnlyMode = ["shelf_only", "no_planogram", "image_only_shelf_analysis"].includes(
    resolvedAnalysisMode,
  );
  const planogramRequested =
    !shelfOnlyMode &&
    (Boolean((scan as any).assignment_id) ||
      adhocRows.length > 0 ||
      adhocAnalysisMode === "planogram_comparison" ||
      metricsAnalysisMode === "planogram_comparison" ||
      metricsAnalysisMode === "with_planogram" ||
      planogramPercent !== null ||
      configuredSummaryRows.length > 0);

  const quality = mapQuality(metricsAny);
  const facingsDebug = Array.isArray(metricsAny["facings_debug"])
    ? metricsAny["facings_debug"]
    : null;
  const facings = mapFacings(
    facingsDebug?.length ? { facings_debug: facingsDebug } : null,
    products ?? [],
  );

  const metricsCompetitor =
    metricsAny["competitor_intel"] && typeof metricsAny["competitor_intel"] === "object"
      ? (metricsAny["competitor_intel"] as Partial<CompetitorSnapshot>)
      : undefined;
  const topBrands = mapBrandShare(result?.brand_share);
  const auditSubCategory =
    (scan.sub_category_label as string | null) ??
    (scan.sub_category as string | null) ??
    undefined;
  const competitorIntel = annotateCompetitorCategories(
    buildCompetitorSnapshot(
      topBrands,
      { primary_brand: "", competitor_brands: [] },
      metricsCompetitor,
    ),
    inventory,
    auditSubCategory,
  );
  const financialImpact = mapFinancialImpact(metricsAny["financial_impact"]);

  const scanResult: ScanResult = {
    scan_id: scan.id as string,
    created_at: scan.created_at as string,
    status: scan.status as ScanStatus,
    summary,
    alerts: mapAlerts(result?.alerts),
    compliance_alerts: complianceAlerts,
    subcategory_mismatches: subcategoryMismatches,
    recommendations: mapRecommendations(result?.recommendations),
    competitor_intel: competitorIntel,
    ...(financialImpact ? { financial_impact: financialImpact } : {}),
    inventory,
    quality,
    facings,
    planogram: {
      requested: planogramRequested,
      percent: planogramPercent,
      sku_match_percent: planogramSkuMatchPercent,
      qty_compliance_percent: planogramQtyCompliancePercent,
      summary: planogramSummary,
    },


    charts: {
      top_brands: topBrands,
      confidence_distribution: confidenceBuckets,
      category_distribution: mapCategoryBreakdown(result?.category_breakdown),
      quantity_distribution: quantityBuckets,
      low_stock_summary: lowStockSummary,
    },
    downloads: {
      ...(annotatedImageSrc ? { annotated_image_url: annotatedImageSrc } : {}),
      ...(pdfUrl ? { pdf_url: pdfUrl } : {}),
      ...(csvUrl ? { csv_url: csvUrl } : {}),
    },

  };
  if (
    scanResult.summary &&
    scanResult.summary.brand_share_percent === undefined &&
    competitorIntel?.own_brand_share_percent !== undefined
  ) {
    scanResult.summary.brand_share_percent = competitorIntel.own_brand_share_percent;
  }

  if (storeName) scanResult.store = storeName;
  const shelfLabel = (scan as any).shelf_label as string | null | undefined;
  const scanCategory = (scan as any).category as string | null | undefined;
  if (shelfLabel) scanResult.location = shelfLabel;
  const selections = parseCategorySelections((scan as any).category_selections);
  const subLabel =
    ((scan as any).sub_category_custom as string | null | undefined) ||
    ((scan as any).sub_category_label as string | null | undefined) ||
    ((scan as any).sub_category as string | null | undefined);
  if (selections.length > 1) {
    // Mixed rack: show every shelf type instead of a misleading single pair.
    scanResult.scan_category = formatCategorySelections(selections, 3);
  } else {
    if (scanCategory) scanResult.scan_category = scanCategory;
    if (subLabel) scanResult.scan_sub_category = subLabel;
  }

  if (annotatedImageSrc) scanResult.annotated_image_url = annotatedImageSrc;
  if (originalImageSrc) scanResult.original_image_url = originalImageSrc;
  if (result?.executive_summary) scanResult.executive_summary = result.executive_summary;
  const metricsRoleSummaries = (result?.metrics as Record<string, unknown> | undefined)?.role_summaries;
  if (metricsRoleSummaries && typeof metricsRoleSummaries === "object") {
    scanResult.role_summaries = metricsRoleSummaries as ScanResult["role_summaries"];
  }
  const metricsObj = result?.metrics as Record<string, unknown> | undefined;
  const metricsRetailIntel = metricsObj?.retail_intelligence;
  const metricsExecutionScore = metricsObj?.retail_execution_score;
  if (metricsRetailIntel && typeof metricsRetailIntel === "object") {
    const intel = { ...(metricsRetailIntel as Record<string, unknown>) };
    if (intel.astra_analysis) {
      intel.astra_analysis = normalizeAstraAnalysis({ astra_analysis: intel.astra_analysis });
    }
    scanResult.retail_intelligence = intel as ScanResult["retail_intelligence"];
  }
  if (adhocParsed.analysis_mode) scanResult.analysis_mode = adhocParsed.analysis_mode;
  else if (metricsAnalysisMode) scanResult.analysis_mode = metricsAnalysisMode;
  if (adhocParsed.audit_role) {
    scanResult.retail_intelligence = {
      ...(scanResult.retail_intelligence ?? {}),
      audit_role: adhocParsed.audit_role,
    } as ScanResult["retail_intelligence"];
  }
  // Attach full metrics so Astra normalizers can find shelf_cv / aislix blocks.
  if (metricsObj && typeof metricsObj === "object") {
    scanResult.metrics = metricsObj;
  }
  const metricsAstraPlanogram = metricsObj?.astra_planogram_analysis;
  const metricsAstraShelf = metricsObj?.astra_shelf_analysis;
  const metricsAstraCv = metricsObj?.astra_cv_analysis;
  const metricsAislixShelf = metricsObj?.aislix_shelf_analysis;
  const metricsAislixPlanogram = metricsObj?.aislix_planogram_analysis;
  if (metricsAstraPlanogram && typeof metricsAstraPlanogram === "object") {
    scanResult.astra_planogram_analysis = metricsAstraPlanogram as Record<string, unknown>;
  }
  if (metricsAstraShelf && typeof metricsAstraShelf === "object") {
    scanResult.astra_shelf_analysis = metricsAstraShelf as Record<string, unknown>;
  }
  if (metricsAstraCv && typeof metricsAstraCv === "object") {
    scanResult.astra_cv_analysis = metricsAstraCv as Record<string, unknown>;
  }
  if (metricsAislixShelf && typeof metricsAislixShelf === "object") {
    scanResult.aislix_shelf_analysis = metricsAislixShelf as Record<string, unknown>;
  }
  if (metricsAislixPlanogram && typeof metricsAislixPlanogram === "object") {
    scanResult.aislix_planogram_analysis = metricsAislixPlanogram as Record<string, unknown>;
  }
  if (Array.isArray(metricsObj?.visible_prices)) {
    scanResult.astra_visible_prices = metricsObj.visible_prices as Array<Record<string, unknown>>;
  }
  if (Array.isArray(metricsObj?.visible_promotions)) {
    scanResult.astra_visible_promotions = metricsObj.visible_promotions as Array<
      Record<string, unknown>
    >;
  }
  if (Array.isArray(metricsObj?.shelf_issues)) {
    scanResult.astra_shelf_issues = metricsObj.shelf_issues as Array<Record<string, unknown>>;
  }
  const auditScope = metricsObj?.audit_scope;
  const adjacentFindings = metricsObj?.adjacent_category_findings;
  const multiPhoto = metricsObj?.multi_photo;
  if (auditScope || adjacentFindings || multiPhoto) {
    scanResult.retail_intelligence = {
      ...(scanResult.retail_intelligence ?? {}),
      ...(auditScope && typeof auditScope === "object" ? { audit_scope: auditScope as Record<string, unknown> } : {}),
      ...(Array.isArray(adjacentFindings)
        ? {
            adjacent_category_findings: adjacentFindings as NonNullable<
              ScanResult["retail_intelligence"]
            >["adjacent_category_findings"],
          }
        : {}),
      ...(multiPhoto && typeof multiPhoto === "object" ? { multi_photo: multiPhoto as NonNullable<ScanResult["retail_intelligence"]>["multi_photo"] } : {}),
    };
  }
  const photoCount = (scan as { photo_count?: number | null }).photo_count;
  if (typeof photoCount === "number" && photoCount > 0) {
    scanResult.photo_count = photoCount;
  }
  const parentScanId = (scan as { parent_scan_id?: string | null }).parent_scan_id;
  if (parentScanId) scanResult.parent_scan_id = parentScanId;
  if (metricsExecutionScore && typeof metricsExecutionScore === "object") {
    scanResult.retail_intelligence = {
      ...(scanResult.retail_intelligence ?? {}),
      retail_execution_score: metricsExecutionScore as import("@/lib/retail-intelligence").RetailExecutionScore,
    };
  }
  if (!scanResult.role_summaries && metricsObj?.role_summaries) {
    scanResult.role_summaries = metricsObj.role_summaries as ScanResult["role_summaries"];
  }

  if (storeId && scan.created_at && scan.status === "completed") {
    const createdAt = scan.created_at as string;
    const [{ data: prevRows }, { data: nextRows }] = await Promise.all([
      supabase
        .from("shelf_scans")
        .select("id")
        .eq("org_id", orgId)
        .eq("store_id", storeId)
        .eq("status", "completed")
        .lt("created_at", createdAt)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("shelf_scans")
        .select("id")
        .eq("org_id", orgId)
        .eq("store_id", storeId)
        .eq("status", "completed")
        .gt("created_at", createdAt)
        .order("created_at", { ascending: true })
        .limit(1),
    ]);

    const previousScanId = prevRows?.[0]?.id as string | undefined;
    const nextScanId = nextRows?.[0]?.id as string | undefined;
    let previousExecutionScore: number | null = null;

    if (previousScanId) {
      const { data: prevResult } = await supabase
        .from("scan_results")
        .select("metrics")
        .eq("scan_id", previousScanId)
        .maybeSingle();
      const prevMetrics = (prevResult?.metrics ?? {}) as Record<string, unknown>;
      const raw =
        typeof prevMetrics["shelf_execution_score"] === "number"
          ? Number(prevMetrics["shelf_execution_score"])
          : typeof prevMetrics["shelf_health_score"] === "number"
            ? Number(prevMetrics["shelf_health_score"])
            : null;
      previousExecutionScore = raw;
    }

    scanResult.navigation = {
      previous_scan_id: previousScanId ?? null,
      next_scan_id: nextScanId ?? null,
      previous_execution_score: previousExecutionScore,
    };
  }

  return enrichScanResultWithAstra(scanResult);
}

/** Stable dedupe key for a SKU: prefers a real SKU, else brand|product|variant. */
export function inventorySkuKey(row: Partial<InventoryItem> & { sku?: string | null }): string {
  const sku = (row.sku ?? "").trim().toLowerCase();
  if (sku) return sku;
  const brand = (row.brand || "unknown").trim().toLowerCase();
  const product = (row.product || "unknown").trim().toLowerCase();
  const variant = (row.variant ?? "").trim().toLowerCase();
  if (!brand && !product && !variant) return "";
  return `${brand}|${product}|${variant}`;
}

/** Counts distinct SKUs, treating variants of the same product as separate SKUs. */
export function countUniqueSkus(inventory: InventoryItem[] | undefined): number {
  const keys = new Set<string>();
  for (const row of inventory ?? []) {
    const key = inventorySkuKey(row);
    if (key) keys.add(key);
  }
  return keys.size;
}

/** Product label with the variant appended when it is not already part of the name. */
export function displayProductName(row: { product?: string | null; variant?: string | null }): string {
  const name = (row.product ?? "").trim() || "Unknown";
  const variant = (row.variant ?? "").trim();
  if (!variant || name.toLowerCase().includes(variant.toLowerCase())) return name;
  return `${name} (${variant})`;
}

export function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value <= 1 ? value * 100 : value;
}

export function formatPercent(value?: number): string | undefined {
  if (value === undefined || value === null || !Number.isFinite(value)) return undefined;
  return `${normalizeConfidence(value).toFixed(0)}%`;
}

export function formatConfidence(value: number): string {
  return `${normalizeConfidence(value).toFixed(1)}%`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function formatScanDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function csvEscape(value: string | number | undefined | null): string {
  const s = value === undefined || value === null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvSection(title: string, rows: (string | number)[][]): string[] {
  return [`# ${title}`, ...rows.map((row) => row.map(csvEscape).join(","))];
}

/** Full scan report CSV — summary metrics, actions, financial impact, brands, and inventory. */
export function buildFullScanReportCsv(result: ScanResult): string {
  const lines: string[] = [];
  const s = result.summary;
  const push = (...sectionLines: string[]) => {
    if (lines.length) lines.push("");
    lines.push(...sectionLines);
  };

  push(
    "# Aislix Shelf Audit Report",
    `# Scan ID,${csvEscape(result.scan_id)}`,
    `# Store,${csvEscape(result.store ?? "")}`,
    `# Location,${csvEscape(result.location ?? result.aisle ?? "")}`,
    `# Category,${csvEscape(result.scan_category ?? "")}`,
    `# Sub-category,${csvEscape(result.scan_sub_category ?? "")}`,
    `# Scan date,${csvEscape(formatScanDate(result.created_at) ?? "")}`,
  );

  if (s) {
    push(
      ...csvSection("Execution summary", [
        ["Metric", "Value"],
        ["Shelf execution score", s.shelf_execution_score ?? s.shelf_health_score ?? ""],
        ["Shelf health score", s.shelf_health_score ?? ""],
        ["Total facings", s.total_facings ?? s.total_products ?? ""],
        ["Unique SKUs", s.unique_skus ?? ""],
        ["Unique brands", s.unique_brands ?? ""],
        ["Recognition coverage %", s.recognition_coverage_percent ?? ""],
        ["Availability %", s.availability_percent ?? s.osa_percent ?? ""],
        ["Facing compliance %", s.facing_compliance_percent ?? ""],
        ["Placement compliance %", s.placement_compliance_percent ?? ""],
        ["Share of shelf %", s.share_of_shelf_percent ?? ""],
        ["Brand share %", s.brand_share_percent ?? ""],
        ["Product share %", s.product_share_percent ?? ""],
        ["Product share SKU", s.product_share_label ?? ""],
        ["Planogram SKU match %", result.planogram?.sku_match_percent ?? result.planogram?.percent ?? ""],
        ["Planogram qty compliance %", result.planogram?.qty_compliance_percent ?? ""],
        ["Confirmed OOS", s.confirmed_oos_count ?? s.out_of_stock_products ?? ""],
        ["Possible OOS / low stock", s.possible_oos_count ?? s.low_stock_products ?? ""],
        ["Placement issues", s.placement_issue_count ?? s.misplaced_products ?? ""],
        ["Avg confidence %", normalizeConfidence(s.average_confidence).toFixed(1)],
        ["Processing time", formatDuration(s.processing_time_ms)],
      ]),
    );
  }

  const roleSummaries =
    result.role_summaries ??
    (result.retail_intelligence as { role_summaries?: Record<string, string> } | undefined)
      ?.role_summaries;
  if (roleSummaries && Object.keys(roleSummaries).length) {
    const roleRows: (string | number)[][] = [["View", "Summary"]];
    for (const view of ["execution", "merchandising", "brand", "executive"] as const) {
      const text = roleSummaries[view]?.trim();
      if (text) roleRows.push([view, text]);
    }
    if (roleRows.length > 1) {
      push(...csvSection("Role summaries (all 4 views)", roleRows));
    }
  }

  if (result.executive_summary?.trim()) {
    push(`# Executive summary`, csvEscape(result.executive_summary.trim()));
  }

  const pgSummary = result.planogram?.summary ?? {};
  const pgLines = pgSummary.lines;
  if (Array.isArray(pgLines) && pgLines.length) {
    push(
      ...csvSection("Planogram compliance (expected vs found)", [
        ["Brand", "Product", "Expected qty", "Found qty", "Status", "Detail"],
        ...pgLines.map((line) => {
          const row = line as Record<string, unknown>;
          return [
            String(row.brand ?? ""),
            String(row.product ?? ""),
            String(row.expected_qty ?? ""),
            String(row.detected_qty ?? ""),
            String(row.issue_type ?? ""),
            String(row.detail ?? ""),
          ];
        }),
      ]),
    );
  }

  const configured = pgSummary.configured_rows;
  if (Array.isArray(configured) && configured.length) {
    push(
      ...csvSection("Planogram configuration", [
        [
          "Location",
          "Category",
          "Sub category",
          "Brand",
          "Product",
          "Variant",
          "Expected qty",
          "Price INR",
          "Daily sales",
          "SKU",
          "Shelf position",
        ],
        ...configured.map((row) => {
          const r = row as Record<string, unknown>;
          return [
            String(r.location ?? ""),
            String(r.category ?? ""),
            String(r.sub_category ?? ""),
            String(r.brand ?? ""),
            String(r.product_name ?? ""),
            String(r.variant ?? ""),
            String(r.expected_qty ?? ""),
            String(r.mrp_inr ?? ""),
            String(r.avg_daily_sales ?? ""),
            String(r.sku ?? ""),
            String(r.shelf_position ?? ""),
          ];
        }),
      ]),
    );
  }

  const ci = result.competitor_intel;
  if (ci?.competitor_shares?.length) {
    push(
      ...csvSection("Competitor intelligence", [
        ["Brand", "Share %", "Facings", "Role"],
        ...ci.competitor_shares.map((row) => [
          row.brand,
          row.share?.toFixed?.(1) ?? row.share ?? "",
          row.facings ?? "",
          row.is_primary ? "Primary" : row.is_competitor ? "Competitor" : "",
        ]),
      ]),
    );
    if (ci.upper_hand?.length) {
      push(
        ...csvSection("Competitor upper hand", [
          ["Brand", "Share %", "Note"],
          ...ci.upper_hand.map((edge) => [edge.brand, edge.share, edge.note]),
        ]),
      );
    }
  }

  const threshold = s?.low_stock_threshold ?? 2;
  const atRisk = (result.inventory ?? []).filter((r) => (r.quantity ?? 0) < threshold);
  if (atRisk.length) {
    push(
      ...csvSection(`SKUs below ${threshold} facings (OOS / low stock)`, [
        ["Brand", "Product", "Variant", "Quantity"],
        ...atRisk.map((r) => [
          r.brand,
          r.product ?? "",
          r.variant ?? "",
          r.quantity ?? 0,
        ]),
      ]),
    );
  }

  const nba = result.retail_intelligence?.next_best_actions;
  if (nba?.length) {
    push(
      ...csvSection("Next best actions", [
        ["Priority", "Title", "Reason", "Recommended action", "Est. daily impact INR"],
        ...nba.map((a) => [
          a.priority,
          a.title,
          a.reason ?? "",
          a.recommended_action ?? "",
          a.estimated_daily_impact_inr ?? "",
        ]),
      ]),
    );
  }

  const fi = result.financial_impact;
  if (fi) {
    push(
      ...csvSection("Financial impact (indicative)", [
        ["Metric", "Value (INR)"],
        ["Estimated daily lost sales", fi.estimated_daily_lost_sales_inr],
        ["Estimated weekly lost sales", fi.estimated_weekly_lost_sales_inr],
        ["Estimated monthly lost sales", fi.estimated_monthly_lost_sales_inr],
        ["OOS SKU count", fi.oos_sku_count],
        ["At-risk SKU count", fi.at_risk_sku_count],
        ["Confidence", fi.confidence],
        ["Methodology", fi.methodology],
      ]),
    );
  }

  const brands = result.charts?.top_brands ?? [];
  if (brands.length) {
    push(
      ...csvSection("Top brands by shelf share", [
        ["Brand", "Share %"],
        ...brands.map((b) => [b.brand, b.share.toFixed(1)]),
      ]),
    );
  }

  if (result.recommendations?.length) {
    push(
      ...csvSection("Recommended actions", [
        ["Title", "Impact", "Detail"],
        ...result.recommendations.map((r) => [r.title, r.impact ?? "", r.detail ?? ""]),
      ]),
    );
  }

  if (result.compliance_alerts?.length) {
    push(
      ...csvSection("Compliance alerts", [
        ["Severity", "Title", "Detail"],
        ...result.compliance_alerts.map((a) => [a.severity, a.title, a.detail ?? ""]),
      ]),
    );
  }

  if (result.alerts?.length) {
    push(
      ...csvSection("Alerts", [
        ["Severity", "Title", "Detail"],
        ...result.alerts.map((a) => [a.severity, a.title, a.detail ?? ""]),
      ]),
    );
  }

  push(
    "# Observed shelf products (visible facings)",
    inventoryToCsv(result.inventory ?? []).split("\n").slice(1).join("\n"),
  );
  return lines.join("\n");
}

export function inventoryToCsv(items: InventoryItem[]): string {
  const header = [
    "Brand",
    "Product",
    "Variant",
    "Category",
    "Visible facings",
    "Confidence %",
    "Compliance Alert",
    "Compliance Note",
    "Detected Sub-category",
    "Audit Sub-category",
    "Shelf position",
  ];
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
      i.compliance_status === "category_mismatch"
        ? COMPLIANCE_ALERT_TITLE
        : (i.compliance_alert ?? (i.compliance_status === "ok" ? "OK" : "")),

      i.compliance_interpretation ?? "",
      i.detected_sub_category_label ?? "",
      i.expected_sub_category_label ?? "",
      i.shelf_position ?? "",
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

export function downloadBlobBytes(content: ArrayBuffer | Uint8Array, filename: string, type: string) {
  const part = content instanceof Uint8Array ? new Uint8Array(content).buffer : content;
  const url = URL.createObjectURL(new Blob([part as ArrayBuffer], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type ExcelRows = (string | number | undefined | null)[][];

export type DigitalExportLine = {
  product_name?: string | null;
  category?: string | null;
  brand?: string | null;
  sku?: string | null;
  expected_qty?: number | null;
  actual_qty?: number | null;
  bin_key?: string | null;
  qc_disposition?: string | null;
  qc_defect_types?: unknown;
  qc_confidence?: number | null;
  qc_notes?: string | null;
  qc_analyzed_at?: string | null;
};

export type ScanReportExcelExtras = {
  verifications?: FieldVerification[];
  digitalLines?: DigitalExportLine[];
};

function excelSheetName(label: string): string {
  return label.replace(/[\\/?*[\]:]/g, "").slice(0, 31);
}

/** Multi-tab Excel workbook — eight-section retail report (table-first). */
export function buildFullScanReportExcel(
  result: ScanResult,
  extras?: ScanReportExcelExtras,
): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const s = result.summary;

  const append = (name: string, rows: ExcelRows) => {
    if (!rows.length) return;
    const sheet = XLSX.utils.aoa_to_sheet(rows.map((row) => row.map((cell) => cell ?? "")));
    XLSX.utils.book_append_sheet(wb, sheet, excelSheetName(name));
  };

  append("Report Header", [
    ["RETAIL SHELF AI ANALYSIS REPORT"],
    ["Report ID", result.scan_id],
    ["Status", "DRAFT"],
    ["Analysis date", formatScanDate(result.created_at) ?? ""],
  ]);

  append("S1 Purpose Scope", [
    ["Field", "Value"],
    ["Store", result.store ?? ""],
    ["Location", result.location ?? result.aisle ?? ""],
    ["Category", result.scan_category ?? ""],
    ["Sub-category", result.scan_sub_category ?? ""],
    ["Executive summary", result.executive_summary ?? ""],
  ]);

  const roleSummaries =
    result.role_summaries ??
    (result.retail_intelligence as { role_summaries?: Record<string, string> } | undefined)
      ?.role_summaries;
  if (roleSummaries) {
    append("S1 Role Summaries", [
      ["Role", "Summary"],
      ...(["execution", "merchandising", "brand", "executive"] as const)
        .map((view) => [view, roleSummaries[view]?.trim() ?? ""])
        .filter((row) => row[1]),
    ]);
  }

  append("S2 Inputs Method", [
    ["Field", "Value"],
    ["Evidence", "PHOTO-DETECTED"],
    ["Recognition coverage %", s?.recognition_coverage_percent ?? ""],
    ["Avg confidence %", s ? normalizeConfidence(s.average_confidence).toFixed(1) : ""],
    ["Processing time", s ? formatDuration(s.processing_time_ms) : ""],
    ["Planogram supplied", result.planogram?.requested ? "Yes" : "No"],
  ]);

  const inventoryRows = result.inventory ?? [];
  const totalFacings = inventoryRows.reduce((n, row) => n + (row.quantity ?? 0), 0);
  append("Observed shelf products", [
    [
      "Brand",
      "Product",
      "Variant",
      "Category",
      "Visible facings",
      "Confidence %",
      "Stock status",
      "Compliance",
    ],
    ...(inventoryRows.length
      ? [
          ...inventoryRows.map((i) => [
            i.brand,
            i.product,
            i.variant ?? "",
            i.category ?? "",
            i.quantity,
            normalizeConfidence(i.confidence).toFixed(1),
            i.out_of_stock ? "Out" : i.low_stock ? "Low" : "In stock",
            i.compliance_status ?? "OK",
          ]),
          [
            "TOTAL",
            `${inventoryRows.length} SKUs`,
            "",
            "",
            totalFacings,
            "",
            "",
            "",
          ],
        ]
      : [["—", "No products returned by analysis API", "", "", "", "", "", ""]]),
  ]);

  const facingVers = (extras?.verifications ?? []).filter((v) => v.field_key === "facings");
  const unitVers = (extras?.verifications ?? []).filter((v) => v.field_key === "visible_units");
  const sumVerified = (rows: FieldVerification[]) =>
    rows.reduce(
      (n, r) => n + (typeof r.verified_value === "number" ? r.verified_value : Number(r.verified_value) || 0),
      0,
    );
  // AI totals are always shelf-wide (summary / inventory) — never only the verified subset.
  const inventoryFacingSum = inventoryRows.reduce((n, i) => n + (Number(i.quantity) || 0), 0);
  const aiFacingsTotal =
    s?.total_facings ??
    (inventoryFacingSum > 0 ? inventoryFacingSum : "");
  const aiUnitsTotal =
    (typeof (s as { total_visible_units?: number } | undefined)?.total_visible_units === "number"
      ? (s as { total_visible_units?: number }).total_visible_units
      : undefined) ??
    (inventoryFacingSum > 0 ? inventoryFacingSum : "N/A");
  const verifiedFacingsTotal = facingVers.length ? sumVerified(facingVers) : "N/A";
  const verifiedUnitsTotal = unitVers.length ? sumVerified(unitVers) : "N/A";

  append("S5 Core KPIs", [
    ["KPI", "Value"],
    ["Retail execution score", s?.shelf_execution_score ?? "Not scoreable"],
    ["Products identified", s?.total_products ?? s?.unique_skus ?? ""],
    ["Total visible facings", s?.total_facings ?? ""],
    ["AI Facings", aiFacingsTotal],
    ["Verified Facings", verifiedFacingsTotal],
    ["AI Visible Units", aiUnitsTotal],
    ["Verified Visible Units", verifiedUnitsTotal],
    ["Unique SKUs", s?.unique_skus ?? ""],
    ["Brand share %", s?.brand_share_percent ?? ""],
    ["Planogram SKU match %", result.planogram?.sku_match_percent ?? result.planogram?.percent ?? ""],
    ["Facing compliance %", s?.facing_compliance_percent ?? ""],
    ["Placement compliance %", s?.placement_compliance_percent ?? ""],
    ["Target SKU availability %", s?.availability_percent ?? s?.osa_percent ?? ""],
    ["Confirmed shelf absence", s?.confirmed_oos_count ?? ""],
  ]);

  const brands = result.charts?.top_brands ?? [];
  if (brands.length) {
    append("Share of facings", [
      ["Brand", "Share %", "Visible facings"],
      ...brands.map((b) => [b.brand, b.share.toFixed(1), b.quantity ?? ""]),
    ]);
  }

  const ci = result.competitor_intel;
  if (ci?.competitor_shares?.length) {
    append("Competitor intelligence", [
      ["Brand", "Share %", "Visible facings", "Role"],
      ...ci.competitor_shares.map((row) => [
        row.brand,
        row.share?.toFixed?.(1) ?? row.share ?? "",
        row.facings ?? "",
        row.is_primary ? "Primary" : row.is_competitor ? "Competitor" : "Other",
      ]),
    ]);
    if (ci.upper_hand?.length) {
      append("Competitor upper hand", [
        ["Brand", "Share %", "Note"],
        ...ci.upper_hand.map((edge) => [edge.brand, edge.share, edge.note]),
      ]);
    }
  }

  const assortment = result.retail_intelligence?.assortment as
    | Record<string, { value?: number | null }>
    | undefined;
  if (assortment) {
    append("S5 Assortment", [
      ["Metric", "Value"],
      ["Assortment breadth %", assortment.breadth_percent?.value ?? "Not configured"],
      ["Missing assortment", assortment.missing_assortment?.value ?? "Not configured"],
      ["Target SKU availability %", assortment.target_sku_availability?.value ?? "Not configured"],
    ]);
  }

  const pgLines = result.planogram?.summary?.lines;
  const configured = (result.planogram?.summary as { configured_rows?: unknown[] } | undefined)
    ?.configured_rows;
  if (Array.isArray(configured) && configured.length) {
    append("S3 Planogram Reference", [
      ["Brand", "Product", "Expected qty", "Shelf position", "MRP INR"],
      ...configured.map((line) => {
        const row = line as Record<string, unknown>;
        return [
          String(row.brand ?? ""),
          String(row.product_name ?? row.product ?? ""),
          String(row.expected_qty ?? ""),
          String(row.shelf_position ?? ""),
          String(row.mrp_inr ?? ""),
        ];
      }),
    ]);
  } else if (Array.isArray(pgLines) && pgLines.length) {
    append("S3 Planogram Match", [
      ["Brand", "Product", "Expected qty", "Found qty", "Status", "Detail"],
      ...pgLines.map((line) => {
        const row = line as Record<string, unknown>;
        return [
          String(row.brand ?? ""),
          String(row.product ?? ""),
          String(row.expected_qty ?? ""),
          String(row.detected_qty ?? ""),
          String(row.issue_type ?? ""),
          String(row.detail ?? ""),
        ];
      }),
    ]);
  }

  const fi = result.financial_impact;
  append("S6 Commercial", [
    ["Metric", "Value (INR)", "Evidence"],
    [
      "Est. daily lost sales",
      fi?.estimated_daily_lost_sales_inr ?? "Not configured",
      fi ? "ESTIMATED" : "NOT CONFIGURED",
    ],
    ["Est. weekly lost sales", fi?.estimated_weekly_lost_sales_inr ?? "", fi?.confidence ?? ""],
    ["OOS SKU count", fi?.oos_sku_count ?? "", "PHOTO-DETECTED"],
    ["Methodology", fi?.methodology ?? "Add product prices and daily sales in setup", ""],
  ]);

  const actionRows: ExcelRows = [["Priority", "Title", "Detail", "Impact"]];
  for (const r of result.recommendations ?? []) {
    actionRows.push([r.impact ?? "medium", r.title, r.detail ?? "", r.category ?? ""]);
  }
  const ledger = result.retail_intelligence?.opportunity_ledger as
    | Array<Record<string, unknown>>
    | undefined;
  for (const item of ledger ?? []) {
    actionRows.push([
      String(item.severity ?? item.priority ?? "medium"),
      String(item.issue ?? item.title ?? ""),
      String(item.recommended_action ?? ""),
      String(item.estimated_daily_impact_inr ?? ""),
    ]);
  }
  append("S7 Actions", actionRows);

  append("S8 Limitations", [
    ["Item", "Detail"],
    [
      "Photo scope",
      "Visible facings only — not hidden depth, backroom stock, or store-wide inventory.",
    ],
    [
      "Financial",
      "Lost sales are indicative when user-supplied MRP and daily sales are configured.",
    ],
    ["Score gate", "Execution score needs target SKUs, expected qty, and shelf position rules."],
  ]);

  const verifications = extras?.verifications ?? [];
  append("Human verification", [
    [
      "Product ID",
      "Field",
      "AI value",
      "Verified value",
      "Verified at",
      "AI Facings total",
      "Verified Facings total",
      "AI Visible Units total",
      "Verified Visible Units total",
    ],
    ...(verifications.length
      ? verifications.map((v, idx) => [
          v.detected_product_id ?? "",
          v.field_key,
          v.ai_value ?? "",
          v.verified_value ?? "",
          v.verified_at ?? "",
          idx === 0 ? aiFacingsTotal : "",
          idx === 0 ? verifiedFacingsTotal : "",
          idx === 0 ? aiUnitsTotal : "",
          idx === 0 ? verifiedUnitsTotal : "",
        ])
      : [
          [
            "",
            "",
            "",
            "",
            "",
            aiFacingsTotal,
            verifiedFacingsTotal,
            aiUnitsTotal,
            verifiedUnitsTotal,
          ],
        ]),
  ]);

  const digitalLines = extras?.digitalLines ?? [];
  if (digitalLines.length) {
    append("Digital audit lines", [
      [
        "Product",
        "Brand",
        "Category",
        "SKU",
        "Bin",
        "Expected",
        "Actual",
        "QC disposition",
        "Defects",
        "QC confidence",
        "QC notes",
      ],
      ...digitalLines.map((line) => [
        line.product_name ?? "",
        line.brand ?? "",
        line.category ?? "",
        line.sku ?? "",
        line.bin_key ?? "",
        line.expected_qty ?? "",
        line.actual_qty ?? "",
        line.qc_disposition ?? "",
        Array.isArray(line.qc_defect_types)
          ? (line.qc_defect_types as string[]).join("; ")
          : typeof line.qc_defect_types === "string"
            ? line.qc_defect_types
            : "",
        line.qc_confidence ?? "",
        line.qc_notes ?? "",
      ]),
    ]);
    const withQc = digitalLines.filter((l) => l.qc_disposition);
    if (withQc.length) {
      const sellable = withQc.filter((l) => l.qc_disposition === "SELLABLE").length;
      const damaged = withQc.filter((l) => l.qc_disposition === "DAMAGED").length;
      const humanReview = withQc.filter((l) => l.qc_disposition === "HUMAN_REVIEW").length;
      append("FNV QC summary", [
        ["Metric", "Value"],
        ["Units with disposition", withQc.length],
        ["Sellable", sellable],
        ["Damaged", damaged],
        ["Human review", humanReview],
        ["Sellable rate %", withQc.length ? ((sellable / withQc.length) * 100).toFixed(1) : ""],
        ["Damage rate %", withQc.length ? ((damaged / withQc.length) * 100).toFixed(1) : ""],
        [
          "Human review rate %",
          withQc.length ? ((humanReview / withQc.length) * 100).toFixed(1) : "",
        ],
      ]);
    }
  }

  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

/** Download combined KPI + role summaries as multi-tab Excel (demo / guest). */
export function downloadDemoFullReportExcel(result: ScanResult): void {
  downloadBlobBytes(
    buildFullScanReportExcel(result),
    `aislix-${result.scan_id || "demo"}-full-report.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

/** Builds a full multi-tab Excel report from live scan data. */
export async function downloadScanExcel(scanId: string, _url?: string): Promise<void> {
  let result: ScanResult | null = null;
  try {
    result = await fetchScanResult(scanId);
  } catch {
    result = null;
  }

  const [verifications, digitalRes] = await Promise.all([
    listScanFieldVerifications(scanId).catch(() => [] as FieldVerification[]),
    supabase
      .from("digital_audit_lines")
      .select(
        "product_name, category, brand, sku, expected_qty, actual_qty, bin_key, qc_disposition, qc_defect_types, qc_confidence, qc_notes, qc_analyzed_at",
      )
      .eq("scan_id", scanId),
  ]);
  const digitalLines = (digitalRes.data ?? []) as DigitalExportLine[];

  if (!result?.summary && !result?.inventory?.length && !digitalLines.length) {
    throw new Error("This audit has no report data to export.");
  }

  const reportResult: ScanResult =
    result ??
    ({
      scan_id: scanId,
      created_at: new Date().toISOString(),
      status: "completed",
      inventory: [],
    } as ScanResult);

  const bytes = buildFullScanReportExcel(reportResult, {
    verifications,
    digitalLines,
  });
  downloadBlobBytes(
    bytes,
    `aislix-${scanId}-report.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

/* ---------------------------- asset downloads ----------------------------- */

export type ScanAssetUrls = {
  pdf_url?: string;
  csv_url?: string;
  annotated_image_url?: string;
  original_image_url?: string;
};

/** Signed storage URLs for a scan's generated assets (pdf / annotated / csv). */
export async function resolveScanAssetUrls(scanId: string): Promise<ScanAssetUrls> {
  const { data: images } = await supabase
    .from("scan_images")
    .select("kind, storage_bucket, storage_path")
    .eq("scan_id", scanId);

  const pick = (kinds: string[]) =>
    (images ?? []).find((img) => kinds.includes(img.kind as string));

  const urls: ScanAssetUrls = {};
  const entries: Array<[keyof ScanAssetUrls, string[]]> = [
    ["pdf_url", ["pdf", "report"]],
    ["annotated_image_url", ["annotated"]],
    ["original_image_url", ["original"]],
    ["csv_url", ["csv"]],
  ];

  await Promise.all(
    entries.map(async ([key, kinds]) => {
      const row = pick(kinds);
      if (!row) return;
      const { data: signed } = await supabase.storage
        .from(row.storage_bucket as string)
        .createSignedUrl(row.storage_path as string, 3600);
      if (signed?.signedUrl) urls[key] = signed.signedUrl;
    }),
  );

  return urls;
}

/** Fetches a URL and saves it as a real file download (works on mobile Safari). */
export async function downloadFileFromUrl(url: string, filename: string): Promise<void> {
  if (url.startsWith("data:")) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error("This file is no longer available.");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

/**
 * Asks the backend to (re)generate this scan's report assets when they are
 * missing from storage. Safe to call repeatedly — it is a no-op once the
 * PDF / annotated image / CSV already exist.
 */
export async function ensureScanAssets(scanId: string): Promise<void> {
  const { backfillScanAssets } = await import("@/lib/scan-pipeline.functions");
  await backfillScanAssets({ data: { scanId } });
}

async function downloadAsset(
  scanId: string,
  key: keyof ScanAssetUrls,
  filename: string,
  hint: string | undefined,
  missingMessage: string,
): Promise<void> {
  let url = hint ?? (await resolveScanAssetUrls(scanId))[key];
  if (!url) {
    // Older scans may never have had their exports stored — rebuild them.
    await ensureScanAssets(scanId);
    url = (await resolveScanAssetUrls(scanId))[key];
  }
  if (!url) throw new Error(missingMessage);
  try {
    await downloadFileFromUrl(url, filename);
  } catch {
    // Signed URLs expire — resolve a fresh one once before giving up.
    const fresh = (await resolveScanAssetUrls(scanId))[key];
    if (!fresh) throw new Error(missingMessage);
    await downloadFileFromUrl(fresh, filename);
  }
}

export async function downloadScanPdf(scanId: string, url?: string): Promise<void> {
  try {
    const { rebuildScanPdfWithVerifications } = await import("@/lib/scan-pipeline.functions");
    const rebuilt = await rebuildScanPdfWithVerifications({ data: { scanId } });
    if (rebuilt?.pdf_base64) {
      const cleaned = rebuilt.pdf_base64.replace(/^data:[^;]+;base64,/, "");
      const bytes = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
      downloadBlobBytes(bytes, `aislix-${scanId}-report.pdf`, "application/pdf");
      return;
    }
  } catch {
    // Fall through to stored asset.
  }
  try {
    await downloadAsset(
      scanId,
      "pdf_url",
      `aislix-${scanId}-report.pdf`,
      url,
      "No PDF report is available for this audit yet.",
    );
    return;
  } catch {
    // Digital / FNV audits often lack a shelf-photo PDF — build a tabular PDF instead.
  }
  const built = await buildDigitalFallbackPdf(scanId);
  if (!built) {
    throw new Error("No PDF report is available for this audit yet.");
  }
  downloadBlobBytes(built, `aislix-${scanId}-report.pdf`, "application/pdf");
}

/** Minimal single-page PDF for digital/FNV audits when vision PDF assets are absent. */
async function buildDigitalFallbackPdf(scanId: string): Promise<Uint8Array | null> {
  const [result, digitalRes] = await Promise.all([
    fetchScanResult(scanId).catch(() => null),
    supabase
      .from("digital_audit_lines")
      .select(
        "product_name, sku, expected_qty, actual_qty, qc_disposition, brand, category",
      )
      .eq("scan_id", scanId)
      .limit(80),
  ]);
  const lines = (digitalRes.data ?? []) as Array<Record<string, unknown>>;
  if (!result && !lines.length) return null;

  const header = [
    "Aislix audit report",
    `Scan: ${scanId}`,
    result?.store ? `Store: ${result.store}` : null,
    result?.created_at ? `Date: ${result.created_at}` : null,
    `Lines: ${lines.length}`,
    "",
  ].filter(Boolean) as string[];

  const body = lines.slice(0, 40).map((line, i) => {
    const name = String(line.product_name ?? line.sku ?? `Line ${i + 1}`);
    const exp = line.expected_qty ?? "—";
    const act = line.actual_qty ?? "—";
    const qc = line.qc_disposition ?? "—";
    return `${i + 1}. ${name}  exp=${exp}  act=${act}  qc=${qc}`;
  });

  return encodeSimplePdf([...header, ...body]);
}

/** Tiny PDF writer (text only) — no external dependency. */
function encodeSimplePdf(lines: string[]): Uint8Array {
  const escape = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const contentLines = ["BT", "/F1 10 Tf", "50 780 Td", "14 TL"];
  for (const line of lines) {
    contentLines.push(`(${escape(line.slice(0, 110))}) Tj`, "T*");
  }
  contentLines.push("ET");
  const stream = contentLines.join("\n");
  const objects = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n",
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n",
    `4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export async function downloadScanAnnotatedImage(
  scanId: string,
  url?: string,
  originalUrl?: string,
): Promise<void> {
  const ext = url?.includes(".png") || url?.startsWith("data:image/png") ? "png" : "jpg";

  const assets = url && originalUrl ? null : await resolveScanAssetUrls(scanId);
  const annotated = url ?? assets?.annotated_image_url;
  const original = originalUrl ?? assets?.original_image_url;

  // Save the same true-colour image the viewer shows (the backend writes BGR).
  if (annotated && original) {
    try {
      const { correctAnnotatedImage } = await import("@/lib/annotated-image");
      const corrected = await correctAnnotatedImage(annotated, original);
      if (corrected !== annotated) {
        await downloadFileFromUrl(corrected, `aislix-${scanId}-annotated.jpg`);
        return;
      }
    } catch {
      // fall through to the stored asset
    }
  }

  return downloadAsset(
    scanId,
    "annotated_image_url",
    `aislix-${scanId}-annotated.${ext}`,
    annotated,

    "No annotated image is available for this audit yet.",
  );
}

/** @deprecated Use downloadDemoFullReportExcel */
export function downloadDemoFullReportCsv(result: ScanResult): void {
  downloadDemoFullReportExcel(result);
}

/** Build CSV for digital / FNV QC line rows (expected/actual + disposition). */
export function buildDigitalAuditLinesCsv(lines: DigitalExportLine[]): string {
  const header = [
    "product_name",
    "brand",
    "category",
    "sku",
    "bin",
    "expected_qty",
    "actual_qty",
    "qc_disposition",
    "defects",
    "qc_confidence",
    "qc_notes",
  ];
  const escape = (value: unknown) => {
    const s = value == null ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const defectCell = (raw: unknown) => {
    if (Array.isArray(raw)) return (raw as string[]).join("; ");
    if (typeof raw === "string") return raw;
    return "";
  };
  return [
    header.join(","),
    ...lines.map((line) =>
      [
        line.product_name ?? "",
        line.brand ?? "",
        line.category ?? "",
        line.sku ?? "",
        line.bin_key ?? "",
        line.expected_qty ?? "",
        line.actual_qty ?? "",
        line.qc_disposition ?? "",
        defectCell(line.qc_defect_types),
        line.qc_confidence ?? "",
        line.qc_notes ?? "",
      ]
        .map(escape)
        .join(","),
    ),
  ].join("\n");
}

/**
 * Download a real CSV for any audit mode.
 * Prefers a stored csv asset; otherwise builds from digital/FNV lines or AI inventory.
 */
export async function downloadScanCsv(scanId: string, url?: string): Promise<void> {
  try {
    await downloadAsset(
      scanId,
      "csv_url",
      `aislix-${scanId}-report.csv`,
      url,
      "No CSV report is available for this audit yet.",
    );
    return;
  } catch {
    // Fall through — digital/FNV and older AI scans may lack a stored csv asset.
  }

  const [result, digitalRes] = await Promise.all([
    fetchScanResult(scanId).catch(() => null),
    supabase
      .from("digital_audit_lines")
      .select(
        "product_name, category, brand, sku, expected_qty, actual_qty, bin_key, qc_disposition, qc_defect_types, qc_confidence, qc_notes",
      )
      .eq("scan_id", scanId),
  ]);
  const digitalLines = (digitalRes.data ?? []) as DigitalExportLine[];

  if (digitalLines.length) {
    downloadBlob(
      buildDigitalAuditLinesCsv(digitalLines),
      `aislix-${scanId}-report.csv`,
      "text/csv;charset=utf-8",
    );
    return;
  }

  if (result && (result.summary || result.inventory?.length)) {
    downloadBlob(
      buildFullScanReportCsv(result),
      `aislix-${scanId}-report.csv`,
      "text/csv;charset=utf-8",
    );
    return;
  }

  throw new Error("No CSV report is available for this audit yet.");
}
