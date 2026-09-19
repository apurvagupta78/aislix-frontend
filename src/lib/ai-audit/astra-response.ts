/** Normalized Astra comparison payloads returned by Railway. */

export type AstraImageQuality = {
  status: "GOOD" | "LIMITED" | "POOR" | string;
  reason?: string;
};

export type AstraPlanogramRow = {
  location: string;
  brand: string;
  brand_status: string;
  product_name: string;
  product_status: string;
  variant: string;
  variant_status: string;
  expected_facings: number;
  actual_facings: number;
  facing_variance: number;
  facing_compliance_percent: number | "N/A";
  expected_shelf_units: number;
  actual_visible_units: number;
  shelf_unit_variance: number;
  facings_range_status: string;
  overall_row_status: string;
  confidence: number;
  evidence_note: string;
};

export type AstraPlanogramSummary = {
  total_planogram_rows?: number;
  matched_rows?: number;
  not_found_rows?: number;
  non_compliant_rows?: number;
  not_verifiable_rows?: number;
  overall_compliance_percent?: number;
};

export type AstraExpectedProductRow = {
  location: string;
  category: string;
  category_status: string;
  sub_category: string;
  subcategory_status: string;
  brand: string;
  brand_status: string;
  product_name: string;
  product_status: string;
  variant: string;
  variant_status: string;
  expected_facings: number;
  actual_facings: number;
  facing_variance: number;
  facing_status: string;
  expected_shelf_units: number;
  actual_visible_units: number;
  shelf_unit_variance: number;
  shelf_unit_status: string;
  overall_status: string;
  confidence: number;
  evidence_note: string;
};

export type AstraExpectedProductsSummary = {
  total_products?: number;
  matched_products?: number;
  not_found_products?: number;
  not_verifiable_products?: number;
  products_below_expected_facings?: number;
  products_below_expected_units?: number;
  products_above_expected_facings?: number;
  products_above_expected_units?: number;
};

export type NormalizedAstraAnalysis =
  | {
      mode: "planogram";
      operating_model?: string;
      image_quality?: AstraImageQuality;
      rows: AstraPlanogramRow[];
      summary: AstraPlanogramSummary;
    }
  | {
      mode: "expected_products";
      operating_model?: string;
      image_quality?: AstraImageQuality;
      products: AstraExpectedProductRow[];
      summary: AstraExpectedProductsSummary;
    }
  | { mode: "shelf_only" };

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function imageQuality(raw: unknown): AstraImageQuality | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const status = str(obj.status);
  if (!status) return undefined;
  return { status, reason: str(obj.reason) || undefined };
}

function normalizePlanogramRow(raw: unknown): AstraPlanogramRow {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    location: str(r.location),
    brand: str(r.brand),
    brand_status: str(r.brand_status),
    product_name: str(r.product_name),
    product_status: str(r.product_status),
    variant: str(r.variant),
    variant_status: str(r.variant_status),
    expected_facings: num(r.expected_facings),
    actual_facings: num(r.actual_facings),
    facing_variance: num(r.facing_variance),
    facing_compliance_percent:
      r.facing_compliance_percent === "N/A" ? "N/A" : num(r.facing_compliance_percent),
    expected_shelf_units: num(r.expected_shelf_units),
    actual_visible_units: num(r.actual_visible_units),
    shelf_unit_variance: num(r.shelf_unit_variance),
    facings_range_status: str(r.facings_range_status),
    overall_row_status: str(r.overall_row_status),
    confidence: num(r.confidence),
    evidence_note: str(r.evidence_note),
  };
}

function normalizeExpectedProductRow(raw: unknown): AstraExpectedProductRow {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    location: str(r.location),
    category: str(r.category),
    category_status: str(r.category_status),
    sub_category: str(r.sub_category),
    subcategory_status: str(r.subcategory_status),
    brand: str(r.brand),
    brand_status: str(r.brand_status),
    product_name: str(r.product_name),
    product_status: str(r.product_status),
    variant: str(r.variant),
    variant_status: str(r.variant_status),
    expected_facings: num(r.expected_facings),
    actual_facings: num(r.actual_facings),
    facing_variance: num(r.facing_variance),
    facing_status: str(r.facing_status),
    expected_shelf_units: num(r.expected_shelf_units),
    actual_visible_units: num(r.actual_visible_units),
    shelf_unit_variance: num(r.shelf_unit_variance),
    shelf_unit_status: str(r.shelf_unit_status),
    overall_status: str(r.overall_status),
    confidence: num(r.confidence),
    evidence_note: str(r.evidence_note),
  };
}

function pickRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

/** Extract Astra comparison analysis from a vision API payload or stored metrics. */
export function normalizeAstraAnalysis(payload: unknown): NormalizedAstraAnalysis {
  const root = pickRecord(payload);
  if (!root) return { mode: "shelf_only" };

  const nested =
    pickRecord(root.astra_planogram_analysis) ??
    pickRecord(root.astra_expected_products_analysis) ??
    pickRecord(root.result) ??
    pickRecord(root.metrics);

  const planogramBlock =
    pickRecord(root.astra_planogram_analysis) ??
    pickRecord(nested?.astra_planogram_analysis) ??
    (Array.isArray(root.rows) ? root : null);

  if (planogramBlock && Array.isArray(planogramBlock.rows) && planogramBlock.rows.length) {
    return {
      mode: "planogram",
      operating_model: str(planogramBlock.operating_model) || undefined,
      image_quality: imageQuality(planogramBlock.image_quality),
      rows: planogramBlock.rows.map(normalizePlanogramRow),
      summary: (planogramBlock.summary ?? {}) as AstraPlanogramSummary,
    };
  }

  const expectedBlock =
    pickRecord(root.astra_expected_products_analysis) ??
    pickRecord(nested?.astra_expected_products_analysis) ??
    (Array.isArray(root.products) ? root : null);

  if (expectedBlock && Array.isArray(expectedBlock.products) && expectedBlock.products.length) {
    return {
      mode: "expected_products",
      operating_model: str(expectedBlock.operating_model) || undefined,
      image_quality: imageQuality(expectedBlock.image_quality),
      products: expectedBlock.products.map(normalizeExpectedProductRow),
      summary: (expectedBlock.summary ?? {}) as AstraExpectedProductsSummary,
    };
  }

  const stored = pickRecord(root.astra_analysis);
  if (stored?.mode === "planogram" && Array.isArray(stored.rows)) {
    return {
      mode: "planogram",
      operating_model: str(stored.operating_model) || undefined,
      image_quality: imageQuality(stored.image_quality),
      rows: stored.rows.map(normalizePlanogramRow),
      summary: (stored.summary ?? {}) as AstraPlanogramSummary,
    };
  }
  if (stored?.mode === "expected_products" && Array.isArray(stored.products)) {
    return {
      mode: "expected_products",
      operating_model: str(stored.operating_model) || undefined,
      image_quality: imageQuality(stored.image_quality),
      products: stored.products.map(normalizeExpectedProductRow),
      summary: (stored.summary ?? {}) as AstraExpectedProductsSummary,
    };
  }

  return { mode: "shelf_only" };
}

export function astraAnalysisFromScanResult(result: {
  retail_intelligence?: Record<string, unknown> | null;
}): NormalizedAstraAnalysis {
  const intel = result.retail_intelligence as Record<string, unknown> | undefined;
  if (intel?.astra_analysis) return normalizeAstraAnalysis({ astra_analysis: intel.astra_analysis });
  return normalizeAstraAnalysis(intel ?? {});
}
