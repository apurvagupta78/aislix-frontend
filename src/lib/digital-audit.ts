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

export type AuditEvidence = {
  id: string;
  bin_key: string;
  storage_path: string;
  signed_url?: string;
  captured_at: string;
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
};

export const DEFAULT_GEOFENCE_M = 200;

export function binKeyFromLocation(location: string): string {
  const trimmed = location.trim();
  return trimmed || "default";
}

export function computeLineVariance(expected: number, actual: number | null, mrp: number | null) {
  if (actual === null || Number.isNaN(actual)) {
    return { variance_qty: null, variance_pct: null, variance_value_inr: null };
  }
  const variance_qty = actual - expected;
  const variance_pct = expected > 0 ? (variance_qty / expected) * 100 : actual === 0 ? 0 : 100;
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
      photo_count: 0,
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
  const { data: scan, error } = await supabase
    .from("shelf_scans")
    .select(
      "id, assignment_id, store_id, submission_status, stores:store_id (name), scan_assignments:assignment_id (id)",
    )
    .eq("id", scanId)
    .maybeSingle();
  if (error || !scan) dbError(error, "Could not load this audit.");

  const [{ data: lines }, { data: evidence }] = await Promise.all([
    supabase.from("digital_audit_lines").select("*").eq("scan_id", scanId).order("bin_key"),
    supabase.from("audit_evidence").select("*").eq("scan_id", scanId),
  ]);

  const mappedLines = (lines ?? []).map(mapLineRow);
  const bins = [...new Set(mappedLines.map((l) => l.bin_key))];

  const evidenceRows = await Promise.all(
    (evidence ?? []).map(async (row) => {
      const path = row.storage_path as string;
      const { data: signed } = await supabase.storage.from("scan-images").createSignedUrl(path, 3600);
      return {
        id: row.id as string,
        bin_key: row.bin_key as string,
        storage_path: path,
        signed_url: signed?.signedUrl,
        captured_at: row.captured_at as string,
      };
    }),
  );

  const store = (scan as { stores?: { name?: string } }).stores;

  return {
    scan_id: scanId,
    assignment_id: (scan.assignment_id as string) ?? "",
    store_id: scan.store_id as string,
    store_name: store?.name ?? "Store",
    submission_status: ((scan as { submission_status?: string }).submission_status ??
      "incomplete") as SubmissionStatus,
    lines: mappedLines,
    evidence: evidenceRows,
    bins,
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
}): Promise<void> {
  const invalid = validateScanFile(input.file);
  if (invalid) throw new Error(invalid);
  const orgId = await requireOrgId();
  const userId = await requireUserId();

  const ext = input.file.name.includes(".") ? input.file.name.split(".").pop() : "jpg";
  const storagePath = `${orgId}/${input.scanId}/evidence/${input.binKey}-${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("scan-images")
    .upload(storagePath, input.file, { contentType: input.file.type, upsert: true });
  if (uploadErr) dbError(uploadErr, "Could not upload the shelf photo.");

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
      device_info: { userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null },
      captured_at: new Date().toISOString(),
    },
    { onConflict: "scan_id,bin_key" },
  );
  if (upsertErr) dbError(upsertErr, "Could not save evidence metadata.");
}

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Match CSV row to audit line by sku, item_code, or product_name+location. */
function matchCsvRowToLine(
  row: Record<string, string>,
  lines: DigitalAuditLine[],
): DigitalAuditLine | undefined {
  const sku = normalizeKey(row["sku"] ?? row["sku id"] ?? row["skuid"]);
  const itemCode = normalizeKey(row["item code"] ?? row["item_code"]);
  const product = normalizeKey(row["product name"] ?? row["product_name"] ?? row["product"]);
  const location = normalizeKey(row["location"] ?? row["bin"] ?? row["shelf"]);

  return lines.find((line) => {
    if (sku && normalizeKey(line.sku) === sku) return true;
    if (itemCode && normalizeKey(line.item_code) === itemCode) return true;
    if (product && normalizeKey(line.product_name) === product) {
      if (!location) return true;
      return normalizeKey(line.location) === location || normalizeKey(line.bin_key) === location;
    }
    return false;
  });
}

export async function importActualCsv(scanId: string, csvText: string): Promise<number> {
  const session = await loadDigitalAuditSession(scanId);
  const rows = parseSimpleCsv(csvText);
  if (!rows.length) throw new Error("The CSV file is empty.");

  let updated = 0;
  for (const row of rows) {
    const line = matchCsvRowToLine(row, session.lines);
    if (!line) continue;
    const qtyRaw = row["actual qty"] ?? row["actual_qty"] ?? row["qty"] ?? row["actual"];
    const actual = Number(qtyRaw);
    if (Number.isNaN(actual)) continue;
    await updateDigitalAuditLine({
      lineId: line.id,
      actual_qty: actual,
      rca_code: line.rca_code,
      rca_notes: line.rca_notes,
    });
    updated++;
  }
  return updated;
}

function parseSimpleCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
}

export type SubmitValidation = {
  ok: boolean;
  missingSkus: string[];
  missingBins: string[];
  missingRca: string[];
};

export function validateDigitalAuditSubmit(session: DigitalAuditSession): SubmitValidation {
  const missingSkus = session.lines
    .filter((l) => l.actual_qty === null)
    .map((l) => l.product_name);
  const evidenceBins = new Set(session.evidence.map((e) => e.bin_key));
  const missingBins = session.bins.filter((b) => !evidenceBins.has(b));
  const missingRca = session.lines
    .filter((l) => {
      if (l.actual_qty === null) return false;
      const v = computeLineVariance(l.expected_qty, l.actual_qty, l.mrp_inr);
      return v.variance_qty !== 0 && !l.rca_code;
    })
    .map((l) => l.product_name);
  const missingOtherNotes = session.lines.filter((l) => l.rca_code === "other" && !l.rca_notes?.trim());
  return {
    ok: missingSkus.length === 0 && missingBins.length === 0 && missingRca.length === 0 && missingOtherNotes.length === 0,
    missingSkus,
    missingBins,
    missingRca,
    missingOtherNotes: missingOtherNotes.map((l) => l.product_name),
  };
}

export async function submitDigitalAudit(input: {
  scanId: string;
  assignmentId: string;
  lat?: number | null;
  lng?: number | null;
}): Promise<void> {
  const session = await loadDigitalAuditSession(input.scanId);
  const validation = validateDigitalAuditSubmit(session);
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
    .update({ approval_status: "pending_review" } as Record<string, unknown>)
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
