/** Raw scan payload inspector — bypasses results-page enrichment for debugging. */

import { astraAnalysisFromScanResult, normalizeAstraAnalysis } from "@/lib/ai-audit/astra-response";
import { parseAdhocPlanogram } from "@/lib/role-planogram-requirements";
import { loadDigitalAuditSession } from "@/lib/digital-audit";
import { fetchScanResult, type ScanResult } from "@/lib/scan-results";
import { supabase } from "@/integrations/supabase/client";
import { dbError, notFound, requireOrgId } from "@/lib/db/context";

export type AuditResultKind = "ai" | "digital" | "ai_assisted" | "unknown";

export type ScanDebugSection = {
  id: string;
  label: string;
  data: unknown;
  note?: string;
};

export type ScanDebugPayload = {
  scan_id: string;
  status: string;
  result_kind: AuditResultKind;
  analysis_mode?: string;
  sections: ScanDebugSection[];
  normalized_result?: ScanResult;
  astra_mode: string;
  image_url?: string;
  errors: string[];
};

function detectResultKind(input: {
  digitalLineCount: number;
  analysisMode?: string;
  hasAstra: boolean;
  hasInventory: boolean;
}): AuditResultKind {
  if (input.digitalLineCount > 0) return "digital";
  if (
    input.hasAstra ||
    input.analysisMode === "expected_products" ||
    input.analysisMode === "planogram_comparison" ||
    input.analysisMode === "shelf_only"
  ) {
    return "ai";
  }
  if (input.hasInventory) return "ai";
  return "unknown";
}

function pickMetricsKeys(metrics: Record<string, unknown>): Record<string, unknown> {
  const keys = [
    "analysis_mode",
    "operating_model",
    "astra_planogram_analysis",
    "astra_expected_products_analysis",
    "astra_analysis",
    "competitor_intel",
    "retail_intelligence",
    "planogram_summary",
    "financial_impact",
    "role_summaries",
    "products",
  ];
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (metrics[key] !== undefined) out[key] = metrics[key];
  }
  return out;
}

/** Loads raw + normalized scan data for the debug inspector page. */
export async function fetchScanDebugPayload(scanId: string): Promise<ScanDebugPayload> {
  const errors: string[] = [];
  const orgId = await requireOrgId();

  const { data: scanRow, error: scanError } = await supabase
    .from("shelf_scans")
    .select(
      "id, status, category, sub_category, sub_category_label, shelf_label, created_at, assignment_id, adhoc_planogram, error_message, planogram_compliance_percent, stores(name)",
    )
    .eq("org_id", orgId)
    .eq("id", scanId)
    .maybeSingle();
  if (scanError) return dbError(scanError, "Could not load scan row.");
  if (!scanRow) notFound("Audit not found.");

  const { data: resultRow, error: resultError } = await supabase
    .from("scan_results")
    .select("executive_summary, metrics, alerts, recommendations, brand_share, category_breakdown")
    .eq("scan_id", scanId)
    .maybeSingle();
  if (resultError) errors.push(`scan_results: ${resultError.message}`);

  const { data: products, error: productsError } = await supabase
    .from("detected_products")
    .select("id, name, brand, variant, category, facings, confidence, sku, stock_status")
    .eq("scan_id", scanId)
    .limit(50);
  if (productsError) errors.push(`detected_products: ${productsError.message}`);

  const { data: images } = await supabase
    .from("scan_images")
    .select("kind, storage_bucket, storage_path")
    .eq("scan_id", scanId);

  let digitalSession: Awaited<ReturnType<typeof loadDigitalAuditSession>> | null = null;
  try {
    digitalSession = await loadDigitalAuditSession(scanId);
  } catch (error) {
    errors.push(`digital_session: ${error instanceof Error ? error.message : String(error)}`);
  }

  let normalized: ScanResult | undefined;
  try {
    normalized = await fetchScanResult(scanId);
  } catch (error) {
    errors.push(`fetchScanResult: ${error instanceof Error ? error.message : String(error)}`);
  }

  const metrics = (resultRow?.metrics ?? {}) as Record<string, unknown>;
  const adhoc = parseAdhocPlanogram((scanRow as { adhoc_planogram?: unknown }).adhoc_planogram);
  const analysisMode =
    adhoc.analysis_mode ??
    (typeof metrics.analysis_mode === "string" ? metrics.analysis_mode : undefined);

  const astraFromMetrics = normalizeAstraAnalysis(metrics);
  const astraFromResult = normalized ? astraAnalysisFromScanResult(normalized) : astraFromMetrics;

  const hasAstra =
    Boolean(metrics.astra_planogram_analysis) ||
    Boolean(metrics.astra_expected_products_analysis) ||
    Boolean((metrics.retail_intelligence as Record<string, unknown> | undefined)?.astra_analysis) ||
    astraFromResult.mode !== "shelf_only";

  const resultKind = detectResultKind({
    digitalLineCount: digitalSession?.lines?.length ?? 0,
    analysisMode,
    hasAstra,
    hasInventory: (products?.length ?? 0) > 0,
  });

  const annotated = images?.find((img) => img.kind === "annotated");
  const original = images?.find((img) => img.kind === "original");
  let imageUrl: string | undefined;
  const imageRow = annotated ?? original;
  if (imageRow) {
    const { data: signed } = await supabase.storage
      .from(imageRow.storage_bucket as string)
      .createSignedUrl(imageRow.storage_path as string, 3600);
    imageUrl = signed?.signedUrl;
  }

  const sections: ScanDebugSection[] = [
    {
      id: "scan_row",
      label: "shelf_scans row",
      data: scanRow,
    },
    {
      id: "adhoc_planogram",
      label: "adhoc_planogram (parsed)",
      data: adhoc,
      note: "Includes expected_products, analysis_mode, and any planogram rows submitted with the audit.",
    },
    {
      id: "metrics_keys",
      label: "scan_results.metrics (Astra + intel subset)",
      data: pickMetricsKeys(metrics),
      note: "Full metrics object can be large; this shows the Astra-related keys.",
    },
    {
      id: "full_metrics",
      label: "scan_results.metrics (full JSON)",
      data: metrics,
    },
    {
      id: "astra_normalized",
      label: "Normalized Astra analysis (frontend)",
      data: astraFromResult,
      note: "How the frontend interprets Astra payloads today.",
    },
    {
      id: "detected_products",
      label: `detected_products (first ${products?.length ?? 0} rows)`,
      data: products ?? [],
    },
    {
      id: "digital_session",
      label: "Digital audit session",
      data: digitalSession,
      note: "Present for Digital Audits — variance lines, evidence, submission status.",
    },
    {
      id: "normalized_scan_result",
      label: "fetchScanResult() output",
      data: normalized ?? null,
      note: "What the /results page loader returns before client enrichment.",
    },
    {
      id: "alerts_recommendations",
      label: "Alerts & recommendations",
      data: {
        alerts: resultRow?.alerts ?? [],
        recommendations: resultRow?.recommendations ?? [],
        executive_summary: resultRow?.executive_summary ?? null,
      },
    },
  ];

  return {
    scan_id: scanId,
    status: String(scanRow.status ?? "unknown"),
    result_kind: resultKind,
    analysis_mode: analysisMode,
    sections,
    normalized_result: normalized,
    astra_mode: astraFromResult.mode,
    image_url: imageUrl ?? normalized?.annotated_image_url ?? normalized?.original_image_url,
    errors,
  };
}
