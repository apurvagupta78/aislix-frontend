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
  audit_name: string | null;
  audit_description: string | null;
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
      "id, org_id, status, shelf_label, category, sub_category, sub_category_label, sub_category_custom, notes, created_at, shelf_health_score, total_products, planogram_compliance_percent, assignment_id, stores(name)",
    )
    .eq("id", scanId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Audit not found.");

  const row = data as Record<string, any>;
  const category = (row["category"] as string | null) ?? null;
  const subCategory =
    (row["sub_category_custom"] as string | null) ||
    (row["sub_category_label"] as string | null) ||
    (row["sub_category"] as string | null) ||
    null;
  const location = (row["shelf_label"] as string | null) ?? null;

  let auditName: string | null = null;
  let auditDescription: string | null = null;
  const assignmentId = (row["assignment_id"] as string | null) ?? null;
  if (assignmentId) {
    const { data: assignment } = await db
      .from("scan_assignments")
      .select("instructions, campaign_id, scope_values")
      .eq("id", assignmentId)
      .maybeSingle();
    const scopeValues =
      assignment?.scope_values &&
      typeof assignment.scope_values === "object" &&
      !Array.isArray(assignment.scope_values)
        ? (assignment.scope_values as Record<string, unknown>)
        : {};
    auditName =
      typeof scopeValues.audit_name === "string" ? scopeValues.audit_name.trim() || null : null;
    auditDescription =
      typeof scopeValues.audit_description === "string"
        ? scopeValues.audit_description.trim() || null
        : null;

    const campaignId = assignment?.campaign_id as string | null;
    if (campaignId) {
      const { data: campaign } = await db
        .from("assignment_campaigns")
        .select("name, audit_purpose, instructions")
        .eq("id", campaignId)
        .maybeSingle();
      if (!auditName && campaign?.name) auditName = String(campaign.name).trim() || null;
      if (!auditDescription) {
        auditDescription =
          (campaign?.audit_purpose as string | null)?.trim() ||
          (campaign?.instructions as string | null)?.trim() ||
          null;
      }
    }

    const instructions = (assignment?.instructions as string | null)?.trim() || "";
    if (instructions) {
      const singleShortLine = instructions.length <= 120 && !instructions.includes("\n");
      if (!auditName && singleShortLine) auditName = instructions;
      else if (!auditDescription) auditDescription = instructions;
    }
  }

  if (!auditName) {
    auditName = [category, subCategory].filter(Boolean).join(" · ") || "Shelf audit";
  }
  if (!auditDescription) {
    const notes = (row["notes"] as string | null)?.trim();
    auditDescription = notes || (location ? `Shelf photo audit · ${location}` : null);
  }

  return {
    org_id: row["org_id"] as string,
    store_name: (row["stores"]?.name as string | null) ?? null,
    location,
    category,
    sub_category: subCategory,
    audit_name: auditName,
    audit_description: auditDescription,
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

function backendApiUrl(): string {
  return (
    (typeof process !== "undefined" && process.env["AISLIX_AI_API_URL"]) ||
    (typeof process !== "undefined" && process.env["VITE_AISLIX_API_URL"]) ||
    "https://aislix-backend-production.up.railway.app"
  ).replace(/\/+$/, "");
}

function normalizeDemoInventory(
  rows: Array<Record<string, unknown>> | undefined,
): Array<Record<string, unknown>> {
  return (rows ?? []).map((row) => ({
    ...row,
    product_name:
      row.product_name ??
      row.product ??
      row.name ??
      "Unknown product",
  }));
}

function demoSessionFromStoredRow(row: Record<string, unknown>): DemoLandingSession {
  const stored =
    row.scan_result && typeof row.scan_result === "object" && !Array.isArray(row.scan_result)
      ? (row.scan_result as Record<string, unknown>)
      : {};
  const inventory = normalizeDemoInventory(
    (stored.inventory as Array<Record<string, unknown>> | undefined) ??
      (stored.products as Array<Record<string, unknown>> | undefined),
  );
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
    inventory,
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

/** Upsert a completed demo session so /share/:token can resolve it later. */
export async function persistDemoShareSession(
  sessionToken: string,
  snapshot: Record<string, unknown>,
): Promise<void> {
  const token = sessionToken.trim();
  if (!token) throw new Error("Missing demo session.");

  const db = await admin();
  const scanId =
    typeof snapshot.scan_id === "string" && snapshot.scan_id.trim()
      ? snapshot.scan_id.trim()
      : "demo";
  const now = new Date().toISOString();

  const { error } = await db.from("landing_demo_sessions").upsert(
    {
      session_token: token,
      scan_id: scanId,
      scan_status: "completed",
      scan_error: null,
      scan_result: snapshot as never,
      sample_id: (snapshot.sample_id as string | null | undefined) ?? null,
      category: (snapshot.category as string | null | undefined) ?? null,
      updated_at: now,
    },
    { onConflict: "session_token" },
  );
  if (error) throw new Error(error.message);
}

async function fetchBackendLandingSession(token: string): Promise<DemoLandingSession | null> {
  const backendUrl = backendApiUrl();
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
    return demoSessionFromStoredRow(row as Record<string, unknown>);
  }

  return fetchBackendLandingSession(token);
}

export type PublicShareLoaderData = {
  report: import("@/lib/scan-share").SharedScanPayload | null;
  demoSession: import("@/lib/landing-scan-api").LandingScanResult | null;
};

/** Resolve workspace share tokens and demo landing session tokens for /share/:token. */
export async function resolvePublicShare(token: string): Promise<PublicShareLoaderData> {
  try {
    const report = await loadSharedScan(token);
    return { report, demoSession: null };
  } catch {
    const demoSession = await loadDemoLandingSession(token);
    if (demoSession) {
      return {
        report: null,
        demoSession: demoSession as import("@/lib/landing-scan-api").LandingScanResult,
      };
    }
    throw new Error("expired_or_invalid");
  }
}

/** Build a ScanResult-shaped payload so /share can render AiAuditResultsPage. */
function buildSharedAuditResult(input: {
  scanId: string;
  summary: Awaited<ReturnType<typeof scanShareSummary>>;
  metrics: Record<string, unknown>;
  executiveSummary: string | null;
  inventory: SharedScanPayload["inventory"];
  downloads: SignedScanAssets;
  planogramPercent: number | null;
}): import("@/lib/scan-results").ScanResult {
  const metrics = input.metrics;
  const analysisMode = String(metrics.analysis_mode ?? "").toLowerCase();
  const shelfOnly = ["shelf_only", "no_planogram", "image_only_shelf_analysis"].includes(
    analysisMode,
  );
  const hasPlanogramBlock = Boolean(
    metrics.aislix_planogram_analysis || metrics.astra_planogram_analysis,
  );
  const planogramRequested =
    !shelfOnly &&
    (hasPlanogramBlock ||
      analysisMode === "planogram_comparison" ||
      analysisMode === "with_planogram" ||
      input.planogramPercent != null);

  const result: import("@/lib/scan-results").ScanResult = {
    scan_id: input.scanId,
    created_at: input.summary.scanned_at ?? undefined,
    status: input.summary.status as import("@/lib/scan-results").ScanStatus,
    store: input.summary.store_name ?? undefined,
    location: input.summary.location ?? undefined,
    scan_category: input.summary.category ?? undefined,
    scan_sub_category: input.summary.sub_category ?? undefined,
    analysis_mode: analysisMode || undefined,
    executive_summary: input.executiveSummary ?? undefined,
    metrics,
    summary: {
      total_products: input.summary.products_detected,
      unique_skus: input.inventory.length,
      unique_brands: new Set(input.inventory.map((r) => r.brand)).size,
      low_stock_products: input.inventory.filter((r) => r.quantity > 0 && r.quantity <= 2).length,
      average_confidence: 0,
      processing_time_ms: 0,
      total_facings: input.inventory.reduce((n, row) => n + (row.quantity || 0), 0),
      ...(input.summary.shelf_health_score != null
        ? { shelf_health_score: input.summary.shelf_health_score }
        : {}),
      ...(input.planogramPercent != null ? { shelf_compliance: input.planogramPercent } : {}),
    },
    inventory: input.inventory.map((row, index) => ({
      id: `share-${index}`,
      brand: row.brand,
      product: row.product,
      quantity: row.quantity,
      confidence: row.confidence ?? 0,
      category: row.category ?? undefined,
    })),
    planogram: {
      requested: planogramRequested,
      percent: input.planogramPercent,
      sku_match_percent: input.planogramPercent,
      qty_compliance_percent: null,
      summary: {},
    },
    downloads: {
      ...(input.downloads.pdf_url ? { pdf_url: input.downloads.pdf_url } : {}),
      ...(input.downloads.annotated_image_url
        ? { annotated_image_url: input.downloads.annotated_image_url }
        : {}),
      ...(input.downloads.csv_url ? { csv_url: input.downloads.csv_url } : {}),
    },
    ...(input.downloads.annotated_image_url
      ? { annotated_image_url: input.downloads.annotated_image_url }
      : {}),
  };

  const attach = (key: keyof typeof result, metricKey: string) => {
    const block = metrics[metricKey];
    if (block && typeof block === "object" && !Array.isArray(block)) {
      (result as Record<string, unknown>)[key as string] = block;
    }
  };
  attach("astra_planogram_analysis", "astra_planogram_analysis");
  attach("astra_shelf_analysis", "astra_shelf_analysis");
  attach("astra_cv_analysis", "astra_cv_analysis");
  attach("aislix_shelf_analysis", "aislix_shelf_analysis");
  attach("aislix_planogram_analysis", "aislix_planogram_analysis");
  if (Array.isArray(metrics.visible_prices)) {
    result.astra_visible_prices = metrics.visible_prices as Array<Record<string, unknown>>;
  }
  if (Array.isArray(metrics.visible_promotions)) {
    result.astra_visible_promotions = metrics.visible_promotions as Array<Record<string, unknown>>;
  }
  if (Array.isArray(metrics.shelf_issues)) {
    result.astra_shelf_issues = metrics.shelf_issues as Array<Record<string, unknown>>;
  }
  if (metrics.retail_intelligence && typeof metrics.retail_intelligence === "object") {
    result.retail_intelligence =
      metrics.retail_intelligence as import("@/lib/scan-results").ScanResult["retail_intelligence"];
  }
  return result;
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

  const inventory = (products ?? []).map((row) => ({
    brand: (row.brand as string | null) ?? "Unknown",
    product: (row.name as string | null) ?? "Unknown product",
    quantity: Number(row.facings ?? 0),
    category: (row.category as string | null) ?? null,
    stock_status: (row.stock_status as string | null) ?? null,
    confidence: row.confidence === null ? null : Number(row.confidence),
  }));

  const executiveSummary = (result?.executive_summary as string | null) ?? null;
  const audit_result = buildSharedAuditResult({
    scanId,
    summary,
    metrics,
    executiveSummary,
    inventory,
    downloads,
    planogramPercent: compliancePercent,
  });

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
    executive_summary: executiveSummary,
    inventory,
    planogram_compliance:
      compliancePercent !== null || complianceLines.length
        ? { compliance_percent: compliancePercent, lines: complianceLines }
        : null,
    downloads,
    expires_at: link.expires_at as string,
    audit_result,
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
  if (!data) throw new Error("You do not have access to this audit.");

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

