/**
 * Digital Audit — expected vs actual variance with photo/GPS evidence.
 * Bypasses the AI vision pipeline; shares assignment + comparison tables with AI audits.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import { downloadCsvFile } from "@/lib/kpi-details-csv";
import {
  filterScopeItems,
  fetchPlanogramScopeItems,
  type PlanogramScopeItem,
  type ScopeType,
  type ScopeValues,
} from "@/lib/assignments";
import { ACCEPTED_TYPES, MAX_FILE_BYTES, validateScanFile } from "@/lib/scan-api";
import {
  EVIDENCE_PROOF_OPTIONS,
  type AuditEvidencePolicy,
  type EvidenceProof,
} from "@/lib/audit-evidence-policy";

export type AuditMode = "ai" | "digital";
export type SubmissionStatus =
  | "incomplete"
  | "submitted"
  | "pending_review"
  | "approved"
  | "rejected"
  | "flagged";

export type RcaCode =
  | "stock_sold"
  | "damaged"
  | "expired"
  | "missing"
  | "misplaced"
  | "receiving_pending"
  | "counting_error"
  | "system_inventory_incorrect"
  | "other";

export const RCA_OPTIONS: { code: RcaCode; label: string }[] = [
  { code: "stock_sold", label: "Stock sold" },
  { code: "damaged", label: "Damaged" },
  { code: "expired", label: "Expired" },
  { code: "missing", label: "Missing" },
  { code: "misplaced", label: "Misplaced" },
  { code: "receiving_pending", label: "Receiving pending" },
  { code: "counting_error", label: "Counting error" },
  { code: "system_inventory_incorrect", label: "System inventory incorrect" },
  { code: "other", label: "Other (theft, etc.)" },
];

export type DigitalAuditLine = {
  id: string;
  scan_id: string;
  match_key: string | null;
  sku: string | null;
  item_code: string | null;
  barcode: string | null;
  brand: string | null;
  product_name: string;
  category: string | null;
  sub_category: string | null;
  location: string;
  bin_key: string;
  expected_qty: number;
  system_qty: number | null;
  actual_qty: number | null;
  mrp_inr: number | null;
  variance_qty: number | null;
  variance_pct: number | null;
  variance_value_inr: number | null;
  rca_code: RcaCode | null;
  rca_notes: string | null;
  planogram_item_id: string | null;
};

export type AuditEvidenceKind = "bin" | "sku" | "after" | "barcode" | "proof";

export type AuditEvidence = {
  id: string;
  bin_key: string;
  kind: AuditEvidenceKind;
  /** Line id for sku/barcode evidence, bin for after photos, proof name for proof evidence. */
  target: string;
  storage_path: string;
  signed_url?: string;
  captured_at: string;
  lat?: number | null;
  lng?: number | null;
  media_type?: "image" | "video" | null;
  barcode_code?: string | null;
  barcode_method?: string | null;
};

export type DigitalAuditSession = {
  scan_id: string;
  assignment_id: string;
  store_id: string;
  store_name: string;
  submission_status: SubmissionStatus;
  lines: DigitalAuditLine[];
  evidence: AuditEvidence[];
  bins: string[];
  /** Evidence policy selected when the audit was assigned (null for legacy assignments). */
  policy: AuditEvidencePolicy | null;
  require_rca: boolean;
};

export const evidenceKey = {
  sku: (lineId: string) => `sku:${lineId}`,
  after: (bin: string) => `after:${bin}`,
  barcode: (lineId: string) => `barcode:${lineId}`,
  proof: (proof: EvidenceProof) => `proof:${proof}`,
};

export function parseEvidenceKey(key: string): { kind: AuditEvidenceKind; target: string } {
  const match = /^(sku|after|barcode|proof):(.+)$/.exec(key);
  if (!match) return { kind: "bin", target: key };
  return { kind: match[1] as AuditEvidenceKind, target: match[2]! };
}

export function evidenceKeyLabel(
  evidence: Pick<AuditEvidence, "kind" | "target" | "bin_key">,
  lines: DigitalAuditLine[] = [],
): string {
  const lineName = (id: string) => lines.find((l) => l.id === id)?.product_name ?? "SKU";
  switch (evidence.kind) {
    case "sku":
      return `SKU photo · ${lineName(evidence.target)}`;
    case "after":
      return `After photo · ${evidence.target === "default" ? "Main shelf" : evidence.target}`;
    case "barcode":
      return `Barcode · ${lineName(evidence.target)}`;
    case "proof":
      return (
        EVIDENCE_PROOF_OPTIONS.find((o) => o.value === evidence.target)?.label ?? evidence.target
      );
    default:
      return evidence.bin_key === "default" ? "Main shelf" : evidence.bin_key;
  }
}

function parseEvidencePolicy(raw: unknown): AuditEvidencePolicy | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<AuditEvidencePolicy>;
  if (!Array.isArray(value.requiredProof)) return null;
  const known = new Set(EVIDENCE_PROOF_OPTIONS.map((o) => o.value));
  return {
    level: value.level ?? "custom",
    requiredProof: value.requiredProof.filter((p): p is EvidenceProof => known.has(p)),
    captureSource: value.captureSource ?? "either",
    minimumPhotos: Math.max(0, Number(value.minimumPhotos) || 0),
    maximumEvidenceAgeMinutes: Number(value.maximumEvidenceAgeMinutes) || 0,
    qualityChecks: Array.isArray(value.qualityChecks) ? value.qualityChecks : [],
    reviewMode: value.reviewMode ?? "manager",
  };
}

export const DEFAULT_GEOFENCE_M = 200;

export function binKeyFromLocation(location: string): string {
  const trimmed = location.trim();
  return trimmed || "default";
}

export function computeLineVariance(
  expected: number,
  actual: number | null,
  mrp: number | null,
  opts?: { expectedMapped?: boolean; actualMapped?: boolean },
) {
  const expectedMapped = opts?.expectedMapped !== false;
  const actualMapped = opts?.actualMapped !== false;
  if (!expectedMapped || !actualMapped) {
    return { variance_qty: null, variance_pct: null, variance_value_inr: null };
  }
  if (actual === null || Number.isNaN(actual)) {
    return { variance_qty: null, variance_pct: null, variance_value_inr: null };
  }
  const variance_qty = actual - expected;
  // E=0, A=0 → 0%; E=0, A>0 → N/A (do not divide by zero)
  const variance_pct =
    expected > 0 ? (variance_qty / expected) * 100 : actual === 0 ? 0 : null;
  const variance_value_inr =
    mrp != null && !Number.isNaN(mrp) ? Math.round(variance_qty * mrp * 100) / 100 : null;
  return { variance_qty, variance_pct, variance_value_inr };
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function geofenceStatus(
  storeLat: number | null,
  storeLng: number | null,
  radiusM: number,
  submitLat: number | null,
  submitLng: number | null,
): "ok" | "warning" | "outside" | "unavailable" {
  if (submitLat == null || submitLng == null) return "unavailable";
  if (storeLat == null || storeLng == null) return "warning";
  const dist = haversineMeters(storeLat, storeLng, submitLat, submitLng);
  return dist <= radiusM ? "ok" : "outside";
}

function scopeItemToLine(
  item: PlanogramScopeItem & {
    id?: string;
    system_qty?: number | null;
    item_code?: string | null;
    barcode?: string | null;
    mrp_inr?: number | null;
  },
  scanId: string,
  assignmentId: string,
  orgId: string,
  storeId: string,
  userId: string,
) {
  const location = item.location || item.aisle || "";
  const bin = binKeyFromLocation(location);
  return {
    scan_id: scanId,
    assignment_id: assignmentId,
    org_id: orgId,
    store_id: storeId,
    planogram_item_id: item.id ?? null,
    match_key: item.match_key || null,
    sku: item.sku || null,
    item_code: item.item_code ?? null,
    barcode: item.barcode ?? null,
    brand: item.brand || null,
    product_name: item.product_name,
    category: item.category || null,
    sub_category: item.sub_category || null,
    location,
    bin_key: bin,
    expected_qty: item.expected_qty,
    system_qty: item.system_qty ?? null,
    actual_qty: null,
    mrp_inr: item.mrp_inr ?? null,
    entered_by: userId,
    source: "form" as const,
  };
}

async function fetchAssignmentForDigital(assignmentId: string) {
  const { data, error } = await supabase
    .from("scan_assignments")
    .select(
      "id, org_id, store_id, assignee_id, planogram_version_id, scope_type, scope_values, audit_mode, scan_id, stores:store_id (name, latitude, longitude, geofence_radius_m)",
    )
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) dbError(error, "Could not load this assignment.");
  if (!data) throw new Error("Assignment not found.");
  return data as {
    id: string;
    org_id: string;
    store_id: string;
    assignee_id: string;
    planogram_version_id: string | null;
    scope_type: ScopeType;
    scope_values: ScopeValues;
    audit_mode?: string;
    scan_id: string | null;
    stores?: {
      name?: string;
      latitude?: number | null;
      longitude?: number | null;
      geofence_radius_m?: number | null;
    } | null;
  };
}

/** Start or resume a digital audit for an assignment. */
export async function startOrResumeDigitalAudit(assignmentId: string): Promise<DigitalAuditSession> {
  const userId = await requireUserId();
  const assignment = await fetchAssignmentForDigital(assignmentId);
  if (assignment.assignee_id !== userId) {
    throw new Error("This digital audit is assigned to another team member.");
  }

  if (assignment.scan_id) {
    return loadDigitalAuditSession(assignment.scan_id);
  }

  const orgId = assignment.org_id;
  const { assertCanStartScan, hasPlatformBypass, mapLimitError } =
    await import("@/lib/subscription-limits");
  try {
    await assertCanStartScan(orgId);
  } catch (error) {
    const { data: auth } = await supabase.auth.getUser();
    if (!hasPlatformBypass(auth.user?.email)) throw error;
  }

  let items: Array<
    PlanogramScopeItem & {
      id?: string;
      system_qty?: number | null;
      item_code?: string | null;
      barcode?: string | null;
      mrp_inr?: number | null;
    }
  > = [];
  if (assignment.planogram_version_id) {
    const { data: rows, error: itemsErr } = await supabase
      .from("planogram_items")
      .select(
        "id, location, aisle, category, sub_category, brand, product_name, sku, expected_qty, match_key, mrp_inr, system_qty, item_code, barcode",
      )
      .eq("version_id", assignment.planogram_version_id);
    if (itemsErr) dbError(itemsErr, "Could not load expected products.");
    items = filterScopeItems(
      (rows ?? []).map((row) => ({
        location: String(row.location ?? ""),
        aisle: String(row.aisle ?? row.location ?? ""),
        category: String(row.category ?? ""),
        sub_category: String(row.sub_category ?? ""),
        brand: String(row.brand ?? ""),
        product_name: String(row.product_name ?? ""),
        sku: String(row.sku ?? ""),
        expected_qty: Number(row.expected_qty) || 0,
        match_key: String(row.match_key ?? ""),
        id: row.id as string,
        mrp_inr: row.mrp_inr == null ? null : Number(row.mrp_inr),
        system_qty: (row as { system_qty?: number | null }).system_qty ?? null,
        item_code: (row as { item_code?: string | null }).item_code ?? null,
        barcode: (row as { barcode?: string | null }).barcode ?? null,
      })),
      assignment.scope_type,
      assignment.scope_values,
    );
  } else {
    items = filterScopeItems(
      await fetchPlanogramScopeItems(assignment.planogram_version_id),
      assignment.scope_type,
      assignment.scope_values,
    );
  }
  if (!items.length) {
    throw new Error("This assignment has no expected products. Ask your manager to upload a CSV.");
  }

  const { data: scan, error: scanErr } = await supabase
    .from("shelf_scans")
    .insert({
      org_id: orgId,
      store_id: assignment.store_id,
      created_by: userId,
      assignment_id: assignmentId,
      status: "processing",
      audit_mode: "digital",
      submission_status: "incomplete",
      photo_count: 1,
      processing_started_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .select("id")
    .single();
  if (scanErr || !scan) {
    const mapped = await mapLimitError(scanErr, orgId);
    if (mapped !== scanErr) throw mapped;
    dbError(scanErr, "Could not start the digital audit.");
  }

  const scanId = scan.id as string;
  const lineRows = items.map((item) =>
    scopeItemToLine(
      item as PlanogramScopeItem & { id?: string },
      scanId,
      assignmentId,
      orgId,
      assignment.store_id,
      userId,
    ),
  );

  const { error: linesErr } = await supabase.from("digital_audit_lines").insert(lineRows);
  if (linesErr) dbError(linesErr, "Could not create audit lines.");

  await supabase
    .from("scan_assignments")
    .update({
      status: "in_progress",
      scan_id: scanId,
      approval_status: "incomplete",
    } as Record<string, unknown>)
    .eq("id", assignmentId);

  return loadDigitalAuditSession(scanId);
}

export async function loadDigitalAuditSession(scanId: string): Promise<DigitalAuditSession> {
  try {
    const { ensureCustomAuditReviewData } = await import("@/lib/custom-audit-review");
    // Cap backfill so AI/FNV scans without custom responses cannot hang Review forever.
    await Promise.race([
      ensureCustomAuditReviewData(scanId).catch(() => false),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 8_000)),
    ]);
  } catch {
    /* backfill module unavailable — still load the scan session */
  }

  const { data: scan, error } = await supabase
    .from("shelf_scans")
    .select(
      "id, assignment_id, store_id, submission_status, stores:store_id (name), scan_assignments:assignment_id (id)",
    )
    .eq("id", scanId)
    .maybeSingle();
  if (error || !scan) dbError(error, "Could not load this audit.");

  const assignmentId = (scan.assignment_id as string | null) ?? null;
  const [{ data: lines }, { data: evidence }, assignmentRes] = await Promise.all([
    supabase.from("digital_audit_lines").select("*").eq("scan_id", scanId).order("bin_key"),
    supabase.from("audit_evidence").select("*").eq("scan_id", scanId),
    assignmentId
      ? supabase
          .from("scan_assignments")
          .select("evidence_policy, require_rca, template_snapshot")
          .eq("id", assignmentId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const assignmentRow = (assignmentRes as { data: Record<string, unknown> | null }).data;
  const snapshot = assignmentRow?.template_snapshot as { evidence_policy?: unknown } | null;
  const policy =
    parseEvidencePolicy(assignmentRow?.evidence_policy) ??
    parseEvidencePolicy(snapshot?.evidence_policy);
  const requireRca = assignmentRow?.require_rca == null ? true : Boolean(assignmentRow.require_rca);

  const mappedLines = (lines ?? []).map(mapLineRow);
  const bins = [...new Set(mappedLines.map((l) => l.bin_key))];

  const evidenceRows = await Promise.all(
    (evidence ?? []).map(async (row) => {
      const path = (row.storage_path as string | null) ?? "";
      const binKey = row.bin_key as string;
      const parsed = parseEvidenceKey(binKey);
      const device = (row.device_info ?? {}) as {
        kind?: string;
        code?: string;
        method?: string;
        media_type?: "image" | "video";
      };
      let signedUrl: string | undefined;
      for (const bucket of path ? (["audit-evidence", "scan-images"] as const) : []) {
        try {
          const signed = await Promise.race([
            supabase.storage.from(bucket).createSignedUrl(path, 3600),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
          ]);
          if (signed && "data" in signed && signed.data?.signedUrl) {
            signedUrl = signed.data.signedUrl;
            break;
          }
        } catch {
          /* try next bucket */
        }
      }
      const evidence: AuditEvidence = {
        id: row.id as string,
        bin_key: binKey,
        kind: parsed.kind,
        target: parsed.target,
        storage_path: path,
        signed_url: signedUrl,
        captured_at: row.captured_at as string,
        lat: row.lat == null ? null : Number(row.lat),
        lng: row.lng == null ? null : Number(row.lng),
        media_type: path ? (device.media_type ?? "image") : null,
        barcode_code: parsed.kind === "barcode" ? (device.code ?? null) : null,
        barcode_method: parsed.kind === "barcode" ? (device.method ?? null) : null,
      };
      return evidence;
    }),
  );

  const store = (scan as { stores?: { name?: string } }).stores;

  return {
    scan_id: scanId,
    assignment_id: assignmentId ?? "",
    store_id: scan.store_id as string,
    store_name: store?.name ?? "Store",
    submission_status: ((scan as { submission_status?: string }).submission_status ??
      "incomplete") as SubmissionStatus,
    lines: mappedLines,
    evidence: evidenceRows,
    bins,
    policy,
    require_rca: requireRca,
  };
}

function mapLineRow(row: Record<string, unknown>): DigitalAuditLine {
  return {
    id: row.id as string,
    scan_id: row.scan_id as string,
    match_key: (row.match_key as string) ?? null,
    sku: (row.sku as string) ?? null,
    item_code: (row.item_code as string) ?? null,
    barcode: (row.barcode as string) ?? null,
    brand: (row.brand as string) ?? null,
    product_name: row.product_name as string,
    category: (row.category as string) ?? null,
    sub_category: (row.sub_category as string) ?? null,
    location: (row.location as string) ?? "",
    bin_key: (row.bin_key as string) ?? "default",
    expected_qty: Number(row.expected_qty) || 0,
    system_qty: row.system_qty == null ? null : Number(row.system_qty),
    actual_qty: row.actual_qty == null ? null : Number(row.actual_qty),
    mrp_inr: row.mrp_inr == null ? null : Number(row.mrp_inr),
    variance_qty: row.variance_qty == null ? null : Number(row.variance_qty),
    variance_pct: row.variance_pct == null ? null : Number(row.variance_pct),
    variance_value_inr:
      row.variance_value_inr == null ? null : Number(row.variance_value_inr),
    rca_code: (row.rca_code as RcaCode) ?? null,
    rca_notes: (row.rca_notes as string) ?? null,
    planogram_item_id: (row.planogram_item_id as string) ?? null,
  };
}

export async function updateDigitalAuditLine(input: {
  lineId: string;
  actual_qty: number;
  rca_code?: RcaCode | null;
  rca_notes?: string | null;
}): Promise<void> {
  const userId = await requireUserId();
  const { data: line, error: fetchErr } = await supabase
    .from("digital_audit_lines")
    .select("expected_qty, mrp_inr")
    .eq("id", input.lineId)
    .single();
  if (fetchErr || !line) dbError(fetchErr, "Could not update this line.");

  const expected = Number(line.expected_qty) || 0;
  const mrp = line.mrp_inr == null ? null : Number(line.mrp_inr);
  const vars = computeLineVariance(expected, input.actual_qty, mrp);

  const { error } = await supabase
    .from("digital_audit_lines")
    .update({
      actual_qty: input.actual_qty,
      ...vars,
      rca_code: input.rca_code ?? null,
      rca_notes: input.rca_notes?.trim() || null,
      entered_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.lineId);
  if (error) dbError(error, "Could not save the count.");
}

export async function uploadBinEvidence(input: {
  scanId: string;
  binKey: string;
  file: File;
  lat?: number | null;
  lng?: number | null;
  accuracyM?: number | null;
  /** Allow a short video (session recording proof) instead of a photo. */
  allowVideo?: boolean;
}): Promise<void> {
  const isVideo = Boolean(input.allowVideo) && isVideoFile(input.file);
  if (isVideo) {
    if (input.file.size > MAX_EVIDENCE_VIDEO_BYTES) {
      throw new Error("Session video is too large. Upload a clip under 100 MB.");
    }
  } else {
    const invalid = validateScanFile(input.file);
    if (invalid) throw new Error(invalid);
  }
  const orgId = await requireOrgId();
  const userId = await requireUserId();

  const ext = input.file.name.includes(".") ? input.file.name.split(".").pop() : isVideo ? "mp4" : "jpg";
  const safeKey = input.binKey.replace(/[^a-zA-Z0-9_-]+/g, "_");
  const storagePath = `${orgId}/${input.scanId}/evidence/${safeKey}-${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("scan-images")
    .upload(storagePath, input.file, { contentType: input.file.type, upsert: true });
  if (uploadErr) dbError(uploadErr, isVideo ? "Could not upload the session video." : "Could not upload the photo.");

  const { error: upsertErr } = await supabase.from("audit_evidence").upsert(
    {
      scan_id: input.scanId,
      org_id: orgId,
      bin_key: input.binKey,
      storage_path: storagePath,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      accuracy_m: input.accuracyM ?? null,
      captured_by: userId,
      device_info: {
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        media_type: isVideo ? "video" : "image",
        file_modified_at: input.file.lastModified
          ? new Date(input.file.lastModified).toISOString()
          : null,
      },
      captured_at: new Date().toISOString(),
    },
    { onConflict: "scan_id,bin_key" },
  );
  if (upsertErr) dbError(upsertErr, "Could not save evidence metadata.");

  if (parseEvidenceKey(input.binKey).kind !== "bin") return;

  // FNV QC: when this assignment is an FNV template, run Astra visual disposition.
  try {
    const { data: scanRow } = await supabase
      .from("shelf_scans")
      .select("assignment_id")
      .eq("id", input.scanId)
      .maybeSingle();
    const assignmentId = (scanRow as { assignment_id?: string | null } | null)?.assignment_id;
    if (assignmentId) {
      const { data: assignment } = await supabase
        .from("scan_assignments")
        .select("template_id")
        .eq("id", assignmentId)
        .maybeSingle();
      const templateId = (assignment as { template_id?: string | null } | null)?.template_id;
      let isFnv = false;
      if (templateId) {
        const { data: template } = await supabase
          .from("audit_templates")
          .select("template_type, audit_purpose, name")
          .eq("id", templateId)
          .maybeSingle();
        const t = template as {
          template_type?: string | null;
          audit_purpose?: string | null;
          name?: string | null;
        } | null;
        isFnv =
          t?.template_type === "fnv_qc_audit" ||
          t?.audit_purpose === "fnv_qc" ||
          Boolean(t?.name?.toLowerCase().includes("fnv"));
      }
      if (isFnv) {
        const { runFnvQcOnBinEvidence } = await import("@/lib/fnv-qc.functions");
        const lineHint = await supabase
          .from("digital_audit_lines")
          .select("product_name, category")
          .eq("scan_id", input.scanId)
          .eq("bin_key", input.binKey)
          .limit(1)
          .maybeSingle();
        await runFnvQcOnBinEvidence({
          data: {
            scanId: input.scanId,
            binKey: input.binKey,
            storagePath,
            productHint:
              (lineHint.data as { product_name?: string; category?: string } | null)?.product_name ??
              (lineHint.data as { category?: string } | null)?.category ??
              null,
          },
        });
      }
    }
  } catch (fnvError) {
    // Evidence is already stored; QC failure must not discard the photo.
    console.error("[digital-audit] FNV QC analysis failed", fnvError);
  }
}

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export const MAX_EVIDENCE_VIDEO_BYTES = 100 * 1024 * 1024;

export function isVideoFile(file: File): boolean {
  return file.type.toLowerCase().startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(file.name);
}

/** Record a barcode scan that confirms product identity for one audit line. */
export async function recordBarcodeConfirmation(input: {
  scanId: string;
  lineId: string;
  code: string;
  method: "camera" | "manual";
  lat?: number | null;
  lng?: number | null;
}): Promise<void> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const { error } = await supabase.from("audit_evidence").upsert(
    {
      scan_id: input.scanId,
      org_id: orgId,
      bin_key: evidenceKey.barcode(input.lineId),
      storage_path: "",
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      captured_by: userId,
      device_info: {
        kind: "barcode",
        code: input.code,
        method: input.method,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      },
      captured_at: new Date().toISOString(),
    },
    { onConflict: "scan_id,bin_key" },
  );
  if (error) dbError(error, "Could not save the barcode confirmation.");
}

/* ------------------------------------------------------------------ */
/* Actual-count import (CSV / Excel)                                   */
/* ------------------------------------------------------------------ */

const QTY_HEADERS = [
  "actual qty",
  "actual quantity",
  "actual",
  "actual count",
  "actual units",
  "actual stock",
  "counted qty",
  "counted quantity",
  "counted",
  "count",
  "physical qty",
  "physical quantity",
  "physical count",
  "physical stock",
  "on hand",
  "on hand qty",
  "stock count",
  "qty",
  "quantity",
];
const SKU_HEADERS = ["sku", "sku id", "skuid", "sku code", "article", "article code", "article no", "material"];
const ITEM_CODE_HEADERS = ["item code", "itemcode", "item no", "item number", "product code", "code"];
const BARCODE_HEADERS = ["barcode", "ean", "ean code", "upc", "gtin"];
const PRODUCT_HEADERS = [
  "product name",
  "product",
  "item name",
  "item",
  "description",
  "product description",
  "name",
];
const LOCATION_HEADERS = ["location", "bin", "shelf", "aisle", "bay", "bin location"];

function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/\(.*?\)/g, " ")
    .toLowerCase()
    .replace(/[_\-.#/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^'+/, "").replace(/\.0+$/, "");
}

function detectDelimiter(headerLine: string): string {
  const counts = [",", ";", "\t"].map((d) => ({ d, n: headerLine.split(d).length }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0]!.n > 1 ? counts[0]!.d : ",";
}

/** RFC-4180 style parser: quoted cells, escaped quotes, newlines inside quotes. */
export function parseDelimitedText(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c !== ""));
}

async function readCountFileMatrix(file: File): Promise<string[][]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]!];
    if (!sheet) throw new Error("The workbook has no sheets.");
    const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    return matrix
      .map((r) => (r ?? []).map((c) => (c == null ? "" : String(c).trim())))
      .filter((r) => r.some((c) => c !== ""));
  }
  return parseDelimitedText(await file.text());
}

export type ActualCountImportResult = {
  updated: number;
  totalRows: number;
  blankRows: number;
  unmatched: string[];
  invalid: string[];
  remainingUncounted: number;
};

function findColumn(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = headers.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

function lineCodes(line: DigitalAuditLine): string[] {
  return [line.sku, line.item_code, line.barcode].map(normalizeCode).filter(Boolean);
}

async function importActualMatrix(
  scanId: string,
  matrix: string[][],
): Promise<ActualCountImportResult> {
  if (matrix.length < 2) {
    throw new Error("The file has no data rows. Add one row per SKU under the header row.");
  }
  const headers = matrix[0]!.map(normalizeHeader);
  const qtyCol = findColumn(headers, QTY_HEADERS);
  if (qtyCol < 0) {
    throw new Error(
      'No actual-count column found. Add a column named "Actual Qty" (use "Download count sheet" for the exact format).',
    );
  }
  const skuCol = findColumn(headers, SKU_HEADERS);
  const itemCol = findColumn(headers, ITEM_CODE_HEADERS);
  const barcodeCol = findColumn(headers, BARCODE_HEADERS);
  const productCol = findColumn(headers, PRODUCT_HEADERS);
  const locationCol = findColumn(headers, LOCATION_HEADERS);
  if (skuCol < 0 && itemCol < 0 && barcodeCol < 0 && productCol < 0) {
    throw new Error(
      "No product identifier column found. Include SKU, Item Code, Barcode or Product Name.",
    );
  }

  const session = await loadDigitalAuditSession(scanId);
  const used = new Set<string>();
  const updates: Array<{ line: DigitalAuditLine; actual: number }> = [];
  const unmatched: string[] = [];
  const invalid: string[] = [];
  let blankRows = 0;
  const cell = (row: string[], col: number) => (col >= 0 ? (row[col] ?? "").trim() : "");

  for (const row of matrix.slice(1)) {
    const rawQty = cell(row, qtyCol).replace(/,/g, "");
    const rowCodes = [cell(row, skuCol), cell(row, itemCol), cell(row, barcodeCol)]
      .map(normalizeCode)
      .filter(Boolean);
    const product = cell(row, productCol).toLowerCase();
    const location = cell(row, locationCol).toLowerCase();
    const label = cell(row, productCol) || cell(row, skuCol) || cell(row, itemCol) || cell(row, barcodeCol) || "row";

    if (rawQty === "") {
      blankRows++;
      continue;
    }
    const actual = Number(rawQty);
    if (!Number.isFinite(actual) || actual < 0) {
      invalid.push(`${label} ("${rawQty}")`);
      continue;
    }

    const candidates = session.lines.filter((line) => {
      if (used.has(line.id)) return false;
      if (rowCodes.length && lineCodes(line).some((c) => rowCodes.includes(c))) return true;
      return !rowCodes.length && product !== "" && line.product_name.trim().toLowerCase() === product;
    });
    const byProductFallback =
      !candidates.length && rowCodes.length && product
        ? session.lines.filter(
            (line) => !used.has(line.id) && line.product_name.trim().toLowerCase() === product,
          )
        : [];
    const pool = candidates.length ? candidates : byProductFallback;
    const match =
      (location
        ? pool.find(
            (l) =>
              l.location.trim().toLowerCase() === location ||
              l.bin_key.trim().toLowerCase() === location,
          )
        : undefined) ?? pool[0];
    if (!match) {
      unmatched.push(label);
      continue;
    }
    used.add(match.id);
    updates.push({ line: match, actual });
  }

  if (!updates.length) {
    if (invalid.length) {
      throw new Error(`Actual counts must be non-negative numbers. Check: ${invalid.slice(0, 5).join(", ")}.`);
    }
    if (blankRows === matrix.length - 1) {
      throw new Error('The "Actual Qty" column is empty. Enter the counted quantity for each SKU.');
    }
    throw new Error(
      `None of the rows matched this audit's SKUs (${unmatched.slice(0, 5).join(", ")}). Match by SKU, Item Code, Barcode or Product Name.`,
    );
  }

  const BATCH = 8;
  for (let i = 0; i < updates.length; i += BATCH) {
    await Promise.all(
      updates.slice(i, i + BATCH).map(({ line, actual }) =>
        updateDigitalAuditLine({
          lineId: line.id,
          actual_qty: actual,
          rca_code: line.rca_code,
          rca_notes: line.rca_notes,
        }),
      ),
    );
  }

  const countedIds = new Set(updates.map((u) => u.line.id));
  const remainingUncounted = session.lines.filter(
    (l) => l.actual_qty === null && !countedIds.has(l.id),
  ).length;

  return {
    updated: updates.length,
    totalRows: matrix.length - 1,
    blankRows,
    unmatched,
    invalid,
    remainingUncounted,
  };
}

export async function importActualCountsFile(
  scanId: string,
  file: File,
): Promise<ActualCountImportResult> {
  return importActualMatrix(scanId, await readCountFileMatrix(file));
}

export async function importActualCsv(scanId: string, csvText: string): Promise<number> {
  const result = await importActualMatrix(scanId, parseDelimitedText(csvText));
  return result.updated;
}

/** Count sheet for field teams: every assigned SKU with an Actual Qty column to fill. */
export function downloadActualCountSheet(session: DigitalAuditSession): void {
  const headers = ["Location", "Product Name", "SKU", "Item Code", "Barcode", "Expected Qty", "Actual Qty"];
  const rows = session.lines.map((line) =>
    [
      line.location,
      line.product_name,
      line.sku ?? "",
      line.item_code ?? "",
      line.barcode ?? "",
      line.expected_qty,
      line.actual_qty ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );
  const safeStore = session.store_name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadCsvFile(`count-sheet-${safeStore || "audit"}.csv`, [headers.join(","), ...rows].join("\n"));
}

/* ------------------------------------------------------------------ */
/* Evidence requirements + submit validation                           */
/* ------------------------------------------------------------------ */

export type EvidenceRequirement = {
  id: EvidenceProof | "minimum_photos";
  label: string;
  hint: string;
  done: number;
  total: number;
  ok: boolean;
  /** Missing targets (bins or product names) for inline guidance. */
  missing: string[];
};

function lineHasVariance(line: DigitalAuditLine): boolean {
  if (line.actual_qty === null) return false;
  const v = computeLineVariance(line.expected_qty, line.actual_qty, line.mrp_inr);
  return v.variance_qty !== null && v.variance_qty !== 0;
}

export function lineNeedsSkuPhoto(session: DigitalAuditSession, line: DigitalAuditLine): boolean {
  const proofs = session.policy?.requiredProof ?? [];
  if (proofs.includes("per_sku_photo")) return true;
  return proofs.includes("variance_photo") && lineHasVariance(line);
}

export function lineNeedsBarcode(session: DigitalAuditSession, line: DigitalAuditLine): boolean {
  return Boolean(session.policy?.requiredProof.includes("barcode") && line.barcode?.trim());
}

const binLabel = (bin: string) => (bin === "default" ? "Main shelf" : bin);

export function evaluateEvidenceRequirements(
  session: DigitalAuditSession,
  opts: { hasGps: boolean },
): EvidenceRequirement[] {
  const keys = new Set(session.evidence.map((e) => e.bin_key));
  const proofs = new Set<EvidenceProof>(session.policy?.requiredProof ?? []);
  proofs.add("context_photo");
  const labelOf = (p: EvidenceProof) =>
    EVIDENCE_PROOF_OPTIONS.find((o) => o.value === p)?.label ?? p;
  const out: EvidenceRequirement[] = [];

  for (const proof of EVIDENCE_PROOF_OPTIONS.map((o) => o.value)) {
    if (!proofs.has(proof)) continue;
    switch (proof) {
      case "context_photo": {
        const missing = session.bins.filter((b) => !keys.has(b));
        out.push({
          id: proof,
          label: labelOf(proof),
          hint: "One shelf photo per shelf / bin.",
          done: session.bins.length - missing.length,
          total: session.bins.length,
          ok: missing.length === 0,
          missing: missing.map(binLabel),
        });
        break;
      }
      case "per_sku_photo": {
        const missing = session.lines.filter((l) => !keys.has(evidenceKey.sku(l.id)));
        out.push({
          id: proof,
          label: labelOf(proof),
          hint: "Add a photo on every SKU line.",
          done: session.lines.length - missing.length,
          total: session.lines.length,
          ok: missing.length === 0,
          missing: missing.map((l) => l.product_name),
        });
        break;
      }
      case "variance_photo": {
        const varianceLines = session.lines.filter(lineHasVariance);
        const missing = varianceLines.filter((l) => !keys.has(evidenceKey.sku(l.id)));
        out.push({
          id: proof,
          label: labelOf(proof),
          hint: varianceLines.length
            ? "Add a photo on every SKU where actual differs from expected."
            : "No variances so far — required only when actual differs from expected.",
          done: varianceLines.length - missing.length,
          total: varianceLines.length,
          ok: missing.length === 0,
          missing: missing.map((l) => l.product_name),
        });
        break;
      }
      case "before_after": {
        const missing = session.bins.filter((b) => !keys.has(evidenceKey.after(b)));
        out.push({
          id: proof,
          label: labelOf(proof),
          hint: "Shelf photo is the before; add an after photo per shelf / bin.",
          done: session.bins.length - missing.length,
          total: session.bins.length,
          ok: missing.length === 0,
          missing: missing.map(binLabel),
        });
        break;
      }
      case "barcode": {
        const needLines = session.lines.filter((l) => l.barcode?.trim());
        const missing = needLines.filter((l) => !keys.has(evidenceKey.barcode(l.id)));
        out.push({
          id: proof,
          label: labelOf(proof),
          hint: needLines.length
            ? "Scan the barcode of each SKU that has one."
            : "No assigned SKU has a barcode on file — nothing to scan.",
          done: needLines.length - missing.length,
          total: needLines.length,
          ok: missing.length === 0,
          missing: missing.map((l) => l.product_name),
        });
        break;
      }
      case "gps":
        out.push({
          id: proof,
          label: labelOf(proof),
          hint: opts.hasGps ? "Location captured." : "Allow location access in your browser.",
          done: opts.hasGps ? 1 : 0,
          total: 1,
          ok: opts.hasGps,
          missing: opts.hasGps ? [] : ["Location"],
        });
        break;
      case "device_metadata":
        out.push({
          id: proof,
          label: labelOf(proof),
          hint: "Captured automatically with every photo and on submit.",
          done: 1,
          total: 1,
          ok: true,
          missing: [],
        });
        break;
      case "live_session_video":
      case "quarantine_contents":
      case "sealed_container": {
        const has = keys.has(evidenceKey.proof(proof));
        out.push({
          id: proof,
          label: labelOf(proof),
          hint:
            proof === "live_session_video"
              ? "Upload a short video of the audit walk."
              : proof === "quarantine_contents"
                ? "Photo of removed or held stock."
                : "Photo of the sealed bag / container showing the seal ID.",
          done: has ? 1 : 0,
          total: 1,
          ok: has,
          missing: has ? [] : [labelOf(proof)],
        });
        break;
      }
    }
  }

  const minimum = session.policy?.minimumPhotos ?? 0;
  const photoCount = session.evidence.filter((e) => e.storage_path).length;
  if (minimum > 1) {
    out.push({
      id: "minimum_photos",
      label: `Minimum ${minimum} photos`,
      hint: "Total photos across the audit.",
      done: Math.min(photoCount, minimum),
      total: minimum,
      ok: photoCount >= minimum,
      missing: photoCount >= minimum ? [] : [`${minimum - photoCount} more photo(s)`],
    });
  }
  return out;
}

export type SubmitValidation = {
  ok: boolean;
  missingSkus: string[];
  missingBins: string[];
  missingRca: string[];
  missingOtherNotes: string[];
  requirements: EvidenceRequirement[];
  unmetRequirements: EvidenceRequirement[];
};

export function validateDigitalAuditSubmit(
  session: DigitalAuditSession,
  opts: { hasGps?: boolean } = {},
): SubmitValidation {
  const missingSkus = session.lines
    .filter((l) => l.actual_qty === null)
    .map((l) => l.product_name);
  const evidenceKeys = new Set(session.evidence.map((e) => e.bin_key));
  const missingBins = session.bins.filter((b) => !evidenceKeys.has(b));
  const missingRca = session.require_rca
    ? session.lines.filter((l) => lineHasVariance(l) && !l.rca_code).map((l) => l.product_name)
    : [];
  const missingOtherNotes = session.lines.filter((l) => l.rca_code === "other" && !l.rca_notes?.trim());
  const requirements = evaluateEvidenceRequirements(session, { hasGps: Boolean(opts.hasGps) });
  const unmetRequirements = requirements.filter((r) => !r.ok && r.id !== "context_photo");
  return {
    ok:
      missingSkus.length === 0 &&
      missingBins.length === 0 &&
      missingRca.length === 0 &&
      missingOtherNotes.length === 0 &&
      unmetRequirements.length === 0,
    missingSkus,
    missingBins,
    missingRca,
    missingOtherNotes: missingOtherNotes.map((l) => l.product_name),
    requirements,
    unmetRequirements,
  };
}

export async function submitDigitalAudit(input: {
  scanId: string;
  assignmentId: string;
  lat?: number | null;
  lng?: number | null;
}): Promise<void> {
  const session = await loadDigitalAuditSession(input.scanId);
  const validation = validateDigitalAuditSubmit(session, {
    hasGps: input.lat != null && input.lng != null,
  });
  if (!validation.ok) {
    const parts: string[] = [];
    if (validation.missingSkus.length) {
      parts.push(`Missing counts for ${validation.missingSkus.length} SKU(s).`);
    }
    if (validation.missingBins.length) {
      parts.push(`Missing shelf photos for: ${validation.missingBins.join(", ")}.`);
    }
    if (validation.missingRca.length) {
      parts.push(`Select a reason for variance on ${validation.missingRca.length} SKU(s).`);
    }
    if (validation.missingOtherNotes.length) {
      parts.push("Notes are required when RCA is Other.");
    }
    for (const req of validation.unmetRequirements) {
      parts.push(`${req.label}: ${req.done}/${req.total} done.`);
    }
    throw new Error(parts.join(" "));
  }

  const assignment = await fetchAssignmentForDigital(input.assignmentId);
  const store = assignment.stores;
  const radius = store?.geofence_radius_m ?? DEFAULT_GEOFENCE_M;
  const geo = geofenceStatus(
    store?.latitude ?? null,
    store?.longitude ?? null,
    radius,
    input.lat ?? null,
    input.lng ?? null,
  );

  const now = new Date().toISOString();
  await supabase
    .from("shelf_scans")
    .update({
      submission_status: "pending_review",
      submitted_at: now,
      submitted_lat: input.lat ?? null,
      submitted_lng: input.lng ?? null,
      geofence_status: geo,
      locked_at: now,
      device_info: { userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null },
    } as Record<string, unknown>)
    .eq("id", input.scanId);

  await supabase
    .from("scan_assignments")
    .update({
      approval_status: "pending_review",
      assignment_state: "submitted",
      status: "completed",
      completed_at: now,
      updated_at: now,
    } as Record<string, unknown>)
    .eq("id", input.assignmentId);

  try {
    const { notifyManagersAuditSubmitted } = await import("@/lib/audit-alerts");
    const { data: profile } = await supabase.auth.getUser();
    await notifyManagersAuditSubmitted({
      assignmentId: input.assignmentId,
      scanId: input.scanId,
      storeName: session.store_name,
      assigneeName: profile.user?.email ?? "Auditor",
    });
  } catch (e) {
    console.error("[digital-audit] submit notification failed", e);
  }

  try {
    const { syncFindingsForScan } = await import("@/lib/findings");
    const { recordActivity } = await import("@/lib/audit-activity");
    await syncFindingsForScan(input.scanId);
    await recordActivity({
      scanId: input.scanId,
      eventType: "audit_submitted",
      summary: "Digital audit submitted and locked",
    });
  } catch (e) {
    console.error("[digital-audit] finding sync failed", e);
  }
}

export async function computeAndPersistDigitalComparison(scanId: string): Promise<number | null> {
  const { data: lines } = await supabase.from("digital_audit_lines").select("*").eq("scan_id", scanId);
  if (!lines?.length) return null;

  const { data: scan } = await supabase
    .from("shelf_scans")
    .select("org_id, store_id, assignment_id")
    .eq("id", scanId)
    .single();
  if (!scan) return null;

  let matched = 0;
  let totalExpected = 0;
  const comparisonLines: Record<string, unknown>[] = [];

  for (const row of lines) {
    const expected = Number(row.expected_qty) || 0;
    const actual = row.actual_qty == null ? 0 : Number(row.actual_qty);
    totalExpected += expected;
    const variance = actual - expected;
    let issue_type = "correct";
    if (variance < 0) issue_type = "missing";
    else if (variance > 0) issue_type = "qty_mismatch";
    if (variance === 0) matched += expected;
    else matched += Math.min(expected, actual);

    comparisonLines.push({
      issue_type,
      expected_brand: row.brand,
      expected_product: row.product_name,
      expected_qty: expected,
      actual_brand: row.brand,
      actual_product: row.product_name,
      actual_qty: actual,
      severity: Math.abs(variance) >= 3 ? "critical" : variance !== 0 ? "warning" : "info",
      detail:
        variance !== 0
          ? `Variance ${variance}${row.rca_code ? ` · ${row.rca_code}` : ""}`
          : null,
    });
  }

  const compliance =
    totalExpected > 0 ? Math.round((matched / totalExpected) * 10000) / 100 : 100;

  const totalVarianceValue = lines.reduce((sum, row) => {
    const v = row.variance_value_inr == null ? 0 : Number(row.variance_value_inr);
    return sum + v;
  }, 0);

  const { data: comparison, error: cmpErr } = await supabase
    .from("planogram_comparisons")
    .insert({
      assignment_id: scan.assignment_id,
      scan_id: scanId,
      org_id: scan.org_id,
      store_id: scan.store_id,
      compliance_percent: compliance,
      summary: {
        expected: totalExpected,
        found: lines.reduce((s, r) => s + (Number(r.actual_qty) || 0), 0),
        variance_value_inr: totalVarianceValue,
        audit_mode: "digital",
      },
    })
    .select("id")
    .single();
  if (cmpErr) dbError(cmpErr, "Could not save comparison.");

  const comparisonId = comparison!.id as string;
  if (comparisonLines.length) {
    await supabase.from("planogram_comparison_lines").insert(
      comparisonLines.map((line) => ({ ...line, comparison_id: comparisonId })),
    );
  }

  await supabase
    .from("shelf_scans")
    .update({
      status: "completed",
      submission_status: "approved",
      planogram_compliance_percent: compliance,
      processing_completed_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("id", scanId);

  return compliance;
}

export async function reviewDigitalAudit(input: {
  scanId: string;
  assignmentId: string;
  action: "approved" | "rejected" | "flagged";
  rejectMode?: "reopen_same" | "new_assignment";
  comment?: string;
}): Promise<void> {
  const userId = await requireUserId();
  const orgId = await requireOrgId();

  await supabase.from("audit_approvals").insert({
    scan_id: input.scanId,
    assignment_id: input.assignmentId,
    org_id: orgId,
    reviewer_id: userId,
    action: input.action,
    reject_mode: input.rejectMode ?? null,
    comment: input.comment?.trim() || null,
  });

  if (input.action === "approved") {
    try {
      const { enrichDigitalLinesWithAiSuggestions } = await import("@/lib/ai-assisted-audit");
      await enrichDigitalLinesWithAiSuggestions(input.scanId);
    } catch (e) {
      console.error("[digital-audit] AI-assisted enrichment failed", e);
    }

    await computeAndPersistDigitalComparison(input.scanId);
    try {
      const { syncFindingsForScan } = await import("@/lib/findings");
      const { recordActivity } = await import("@/lib/audit-activity");
      await syncFindingsForScan(input.scanId);
      await recordActivity({
        scanId: input.scanId,
        eventType: "audit_approved",
        summary: "Manager approved the audit and synced findings",
      });
    } catch (e) {
      console.error("[digital-audit] finding sync after approval failed", e);
    }

    const session = await loadDigitalAuditSession(input.scanId);
    const totalVariance = session.lines.reduce((s, l) => s + Math.abs(l.variance_value_inr ?? 0), 0);
    const critical = session.lines.filter(
      (l) => Math.abs(l.variance_value_inr ?? 0) >= 10_000,
    ).length;
    try {
      const { notifyManagersVarianceException } = await import("@/lib/audit-alerts");
      await notifyManagersVarianceException({
        assignmentId: input.assignmentId,
        scanId: input.scanId,
        storeName: session.store_name,
        totalVarianceInr: totalVariance,
        criticalCount: critical,
      });
    } catch (e) {
      console.error("[digital-audit] exception notification failed", e);
    }

    await supabase
      .from("scan_assignments")
      .update({
        status: "completed",
        approval_status: "approved",
        completed_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq("id", input.assignmentId);
    return;
  }

  const submissionStatus = input.action === "flagged" ? "flagged" : "rejected";
  await supabase
    .from("shelf_scans")
    .update({ submission_status: submissionStatus } as Record<string, unknown>)
    .eq("id", input.scanId);

  if (input.action === "rejected" && input.rejectMode === "reopen_same") {
    await supabase
      .from("scan_assignments")
      .update({
        approval_status: "incomplete",
        status: "in_progress",
      } as Record<string, unknown>)
      .eq("id", input.assignmentId);
  } else if (input.action === "rejected" && input.rejectMode === "new_assignment") {
    await supabase
      .from("scan_assignments")
      .update({
        approval_status: "rejected",
        status: "needs_correction",
      } as Record<string, unknown>)
      .eq("id", input.assignmentId);
  } else {
    await supabase
      .from("scan_assignments")
      .update({ approval_status: submissionStatus } as Record<string, unknown>)
      .eq("id", input.assignmentId);
  }
}

export function lookupLineByBarcode(lines: DigitalAuditLine[], barcode: string): DigitalAuditLine | undefined {
  const key = normalizeKey(barcode);
  return lines.find(
    (l) => normalizeKey(l.barcode) === key || normalizeKey(l.sku) === key || normalizeKey(l.item_code) === key,
  );
}

function csvEscape(value: string | number | undefined | null): string {
  let s = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build expected-products CSV for digital audit assignment (manager download). */
export function buildExpectedAuditCsv(
  rows: Array<{
    location?: string;
    category?: string;
    sub_category?: string;
    brand?: string;
    product_name: string;
    sku?: string;
    item_code?: string;
    barcode?: string;
    expected_qty?: number;
    system_qty?: number | null;
    mrp_inr?: number | null;
  }>,
): string {
  const headers = [
    "Location",
    "Category",
    "Sub Category",
    "Brand",
    "Product Name",
    "SKU",
    "Item Code",
    "Barcode",
    "Expected Qty",
    "System Qty",
    "MRP INR",
  ];
  const lines = rows.map((row) =>
    [
      row.location ?? "",
      row.category ?? "",
      row.sub_category ?? "",
      row.brand ?? "",
      row.product_name,
      row.sku ?? "",
      row.item_code ?? "",
      row.barcode ?? "",
      row.expected_qty ?? 0,
      row.system_qty ?? "",
      row.mrp_inr ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

export function downloadExpectedAuditCsv(
  filename: string,
  rows: Parameters<typeof buildExpectedAuditCsv>[0],
): void {
  downloadCsvFile(filename, buildExpectedAuditCsv(rows));
}
