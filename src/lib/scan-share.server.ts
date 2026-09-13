/**
 * Server-only scan sharing internals.
 *
 * Share links are opaque 24-byte tokens stored in scan_share_links; the public
 * report is served through a server function that reads with elevated
 * privileges so anonymous visitors never touch the Data API directly.
 */

import { serverAppOrigin } from "@/lib/app-origin";
import type { SharedScanPayload, SharedComplianceLine } from "@/lib/scan-share";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function shareUrlForToken(token: string): string {
  return `${serverAppOrigin()}/share/${token}`;
}

/** Reuses the newest live link for a scan, or mints a new 7-day token. */
export async function ensureShareLink(
  scanId: string,
  orgId: string,
  userId: string,
): Promise<{ token: string; url: string; expires_at: string }> {
  const db = await admin();

  const { data: existing } = await db
    .from("scan_share_links")
    .select("token, expires_at")
    .eq("scan_id", scanId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.token) {
    return {
      token: existing.token as string,
      url: shareUrlForToken(existing.token as string),
      expires_at: existing.expires_at as string,
    };
  }

  const { data: row, error } = await db
    .from("scan_share_links")
    .insert({ scan_id: scanId, org_id: orgId, created_by: userId })
    .select("token, expires_at")
    .single();
  if (error) throw new Error(error.message);

  return {
    token: row!.token as string,
    url: shareUrlForToken(row!.token as string),
    expires_at: row!.expires_at as string,
  };
}

export async function logShareEvent(input: {
  scanId: string;
  orgId: string;
  shareType: "link" | "email" | "team";
  userId: string;
  recipientEmail?: string | null;
  recipientUserId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const db = await admin();
  await db.from("scan_share_events").insert({
    scan_id: input.scanId,
    org_id: input.orgId,
    share_type: input.shareType,
    created_by: input.userId,
    recipient_email: input.recipientEmail ?? null,
    recipient_user_id: input.recipientUserId ?? null,
    payload: (input.payload ?? {}) as never,
  });
}

export type SignedScanAssets = {
  pdf_url?: string;
  annotated_image_url?: string;
  csv_url?: string;
};

/** Signed storage URLs for a scan's PDF report, annotated shelf image and CSV. */
export async function signedScanAssets(
  scanId: string,
  expiresIn: number,
): Promise<SignedScanAssets> {
  const db = await admin();
  const { data: images } = await db
    .from("scan_images")
    .select("kind, storage_bucket, storage_path")
    .eq("scan_id", scanId);

  const out: SignedScanAssets = {};
  const pick = (kinds: string[]) =>
    (images ?? []).find((img) => kinds.includes(img.kind as string));

  const entries: Array<[keyof SignedScanAssets, string[]]> = [
    ["pdf_url", ["pdf", "report"]],
    ["annotated_image_url", ["annotated"]],
    ["csv_url", ["csv"]],
  ];

  for (const [key, kinds] of entries) {
    const row = pick(kinds);
    if (!row) continue;
    const { data } = await db.storage
      .from(row.storage_bucket as string)
      .createSignedUrl(row.storage_path as string, expiresIn);
    if (data?.signedUrl) out[key] = data.signedUrl;
  }
  return out;
}

/**
 * Resolves share assets, asking the pipeline to rebuild any missing export
 * (PDF, annotated image or CSV) once before signing the URLs.
 */
export async function prepareScanForShare(
  scanId: string,
  expiresIn: number,
): Promise<SignedScanAssets> {
  const assets = await signedScanAssets(scanId, expiresIn);
  if (assets.pdf_url && assets.annotated_image_url && assets.csv_url) return assets;

  try {
    const db = await admin();
    const { backfillScanAssetsServer } = await import("@/lib/scan-pipeline.server");
    await backfillScanAssetsServer(db as never, scanId);
  } catch {
    // Best effort — send whatever assets already exist.
    return assets;
  }
  return signedScanAssets(scanId, expiresIn);
}

/** Minimal scan facts used in emails and the public report header. */
export async function scanShareSummary(scanId: string): Promise<{
  org_id: string;
  store_name: string | null;
  location: string | null;
  category: string | null;
  sub_category: string | null;
  scanned_at: string | null;
  status: string;
  shelf_health_score: number | null;
  products_detected: number;
  planogram_compliance_percent: number | null;
}> {
  const db = await admin();
  const { data, error } = await db
    .from("shelf_scans")
    .select(
      "id, org_id, status, shelf_label, category, sub_category, sub_category_label, sub_category_custom, created_at, shelf_health_score, total_products, planogram_compliance_percent, stores(name)",
    )
    .eq("id", scanId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Scan not found.");

  const row = data as Record<string, any>;
  return {
    org_id: row["org_id"] as string,
    store_name: (row["stores"]?.name as string | null) ?? null,
    location: (row["shelf_label"] as string | null) ?? null,
    category: (row["category"] as string | null) ?? null,
    sub_category:
      (row["sub_category_custom"] as string | null) ||
      (row["sub_category_label"] as string | null) ||
      (row["sub_category"] as string | null) ||
      null,
    scanned_at: (row["created_at"] as string | null) ?? null,
    status: String(row["status"] ?? "queued"),
    shelf_health_score:
      row["shelf_health_score"] === null || row["shelf_health_score"] === undefined
        ? null
        : Number(row["shelf_health_score"]),
    products_detected: Number(row["total_products"] ?? 0),
    planogram_compliance_percent:
      row["planogram_compliance_percent"] === null ||
      row["planogram_compliance_percent"] === undefined
        ? null
        : Number(row["planogram_compliance_percent"]),
  };
}

type DemoLandingSession = {
  landing_session_id: string;
  scan_id: string;
  status: "completed";
  scanned_at?: string;
  sample_id?: string | null;
  category?: string;
  shelf_label?: string;
  has_planogram?: boolean;
  metrics?: Record<string, unknown>;
  inventory?: Array<Record<string, unknown>>;
  top_brands?: Array<{ brand: string; share: number; quantity?: number }>;
  brand_share?: Array<{ brand: string; share: number; quantity?: number }>;
  executive_summary?: string;
  role_summaries?: Record<string, string>;
  retail_intelligence?: Record<string, unknown>;
  recommendations?: Array<Record<string, unknown>>;
  alerts?: Array<Record<string, unknown>>;
  compliance_alerts?: Array<Record<string, unknown>>;
};

async function fetchBackendLandingSession(token: string): Promise<DemoLandingSession | null> {
  const backendUrl =
    (typeof process !== "undefined" && process.env["AISLIX_AI_API_URL"]) || "";
  if (!backendUrl) return null;
  try {
    const res = await fetch(
      `${backendUrl.replace(/\/+$/, "")}/landing/session/${encodeURIComponent(token)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as DemoLandingSession & { status?: string };
    if (data.status !== "completed") return null;
    return data;
  } catch {
    return null;
  }
}

/** Resolve a demo audit by landing session token (Supabase first, then Railway). */
export async function loadDemoLandingSession(token: string): Promise<DemoLandingSession | null> {
  const db = await admin();
  const { data: row, error } = await db
    .from("landing_demo_sessions")
    .select(
      "session_token, scan_id, scan_status, scan_result, sample_id, category, created_at, updated_at",
    )
    .eq("session_token", token)
    .maybeSingle();

  if (!error && row?.scan_status === "completed" && row.scan_result) {
    const stored =
      row.scan_result && typeof row.scan_result === "object" && !Array.isArray(row.scan_result)
        ? (row.scan_result as Record<string, unknown>)
        : {};
    return {
      landing_session_id: row.session_token as string,
      scan_id: String(row.scan_id ?? stored.scan_id ?? "demo"),
      status: "completed",
      scanned_at:
        (stored.scanned_at as string | undefined) ??
        (row.updated_at as string | undefined) ??
        (row.created_at as string | undefined),
      sample_id: (row.sample_id as string | null) ?? (stored.sample_id as string | null),
      category: (row.category as string | null) ?? (stored.category as string | undefined),
      shelf_label: stored.shelf_label as string | undefined,
      has_planogram: stored.has_planogram as boolean | undefined,
      metrics: stored.metrics as Record<string, unknown> | undefined,
      inventory: (stored.inventory as Array<Record<string, unknown>> | undefined) ?? [],
      top_brands: stored.top_brands as DemoLandingSession["top_brands"],
      brand_share: stored.brand_share as DemoLandingSession["brand_share"],
      executive_summary: stored.executive_summary as string | undefined,
      role_summaries: stored.role_summaries as Record<string, string> | undefined,
      retail_intelligence: stored.retail_intelligence as Record<string, unknown> | undefined,
      recommendations: stored.recommendations as Array<Record<string, unknown>> | undefined,
      alerts: stored.alerts as Array<Record<string, unknown>> | undefined,
      compliance_alerts: stored.compliance_alerts as Array<Record<string, unknown>> | undefined,
    };
  }

  return fetchBackendLandingSession(token);
}

/** Full public payload for a share token. Throws on expired / invalid tokens. */
export async function loadSharedScan(token: string): Promise<SharedScanPayload> {
  const db = await admin();

  const { data: link } = await db
    .from("scan_share_links")
    .select("id, scan_id, org_id, expires_at, revoked_at, view_count")
    .eq("token", token)
    .maybeSingle();

  if (
    !link ||
    link.revoked_at ||
    new Date(link.expires_at as string).getTime() < Date.now()
  ) {
    throw new Error("expired_or_invalid");
  }

  const scanId = link.scan_id as string;
  const summary = await scanShareSummary(scanId);

  const { data: scanRow } = await db
    .from("shelf_scans")
    .select("osa_percent, out_of_stock_count, low_stock_count")
    .eq("id", scanId)
    .maybeSingle();

  const { data: result } = await db
    .from("scan_results")
    .select("executive_summary, metrics")
    .eq("scan_id", scanId)
    .maybeSingle();

  const { data: products } = await db
    .from("detected_products")
    .select("name, brand, category, facings, stock_status, confidence")
    .eq("scan_id", scanId)
    .order("facings", { ascending: false })
    .limit(50);

  const { data: comparison } = await db
    .from("planogram_comparisons")
    .select("id, compliance_percent")
    .eq("scan_id", scanId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let complianceLines: SharedComplianceLine[] = [];
  if (comparison?.id) {
    const { data: lines } = await db
      .from("planogram_comparison_lines")
      .select(
        "issue_type, expected_brand, expected_product, expected_qty, actual_brand, actual_product, actual_qty, severity, detail",
      )
      .eq("comparison_id", comparison.id as string)
      .limit(200);
    complianceLines = (lines ?? []).map((line) => ({
      issue_type: String(line.issue_type),
      expected_brand: line.expected_brand as string | null,
      expected_product: line.expected_product as string | null,
      expected_qty: line.expected_qty as number | null,
      actual_brand: line.actual_brand as string | null,
      actual_product: line.actual_product as string | null,
      actual_qty: line.actual_qty as number | null,
      severity: String(line.severity ?? "low"),
      detail: line.detail as string | null,
    }));
  }

  const downloads = await signedScanAssets(scanId, 3600);

  await db
    .from("scan_share_links")
    .update({ view_count: Number(link.view_count ?? 0) + 1 })
    .eq("id", link.id as string);

  const compliancePercent =
    comparison?.compliance_percent === null || comparison?.compliance_percent === undefined
      ? summary.planogram_compliance_percent
      : Number(comparison.compliance_percent);

  const metrics = (result?.metrics ?? {}) as Record<string, unknown>;
  const metricNum = (key: string): number | null =>
    typeof metrics[key] === "number" ? Number(metrics[key]) : null;
  const executionScore =
    metricNum("shelf_execution_score") ??
    (summary.shelf_health_score !== null ? summary.shelf_health_score : null);
  const facingsDetected =
    metricNum("total_facings") ?? metricNum("total_products") ?? summary.products_detected;

  return {
    scan_id: scanId,
    store_name: summary.store_name,
    location: summary.location,
    category: summary.category,
    sub_category: summary.sub_category,
    scanned_at: summary.scanned_at,
    status: summary.status,
    shelf_health_score: summary.shelf_health_score,
    shelf_execution_score: executionScore,
    osa_percent:
      scanRow?.osa_percent === null || scanRow?.osa_percent === undefined
        ? null
        : Number(scanRow.osa_percent),
    facings_detected: facingsDetected,
    products_detected: summary.products_detected,
    out_of_stock_count: Number(scanRow?.out_of_stock_count ?? 0),
    low_stock_count: Number(scanRow?.low_stock_count ?? 0),
    planogram_compliance_percent: summary.planogram_compliance_percent,
    executive_summary: (result?.executive_summary as string | null) ?? null,
    inventory: (products ?? []).map((row) => ({
      brand: (row.brand as string | null) ?? "Unknown",
      product: (row.name as string | null) ?? "Unknown product",
      quantity: Number(row.facings ?? 0),
      category: (row.category as string | null) ?? null,
      stock_status: (row.stock_status as string | null) ?? null,
      confidence: row.confidence === null ? null : Number(row.confidence),
    })),
    planogram_compliance:
      compliancePercent !== null || complianceLines.length
        ? { compliance_percent: compliancePercent, lines: complianceLines }
        : null,
    downloads,
    expires_at: link.expires_at as string,
  };
}


/** Confirms the signed-in user can share this scan, returning its org. */
export async function requireScanAccess(
  supabase: { from: (table: string) => any },
  scanId: string,
): Promise<{ orgId: string; status: string; assigneeId: string | null }> {
  const { data, error } = await supabase
    .from("shelf_scans")
    .select("id, org_id, status, assignment_id")
    .eq("id", scanId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("You do not have access to this scan.");

  let assigneeId: string | null = null;
  if (data.assignment_id) {
    const { data: assignment } = await supabase
      .from("scan_assignments")
      .select("assignee_id")
      .eq("id", data.assignment_id)
      .maybeSingle();
    assigneeId = (assignment?.assignee_id as string | null) ?? null;
  }

  return { orgId: data.org_id as string, status: String(data.status), assigneeId };
}

