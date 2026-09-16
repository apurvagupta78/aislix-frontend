/**
 * Materialize custom/universal audit responses into digital_audit_lines + audit_evidence
 * so Review & Approval and sync_findings_for_scan use the same tables as digital audits.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireUserId } from "@/lib/db/context";
import { isImageField } from "@/lib/audit-builder/field-library";
import type { AuditResponseValue, TemplateDefinition, TemplateField } from "@/lib/audit-builder/types";
import {
  AUDIT_EVIDENCE_REF_PREFIX,
  buildRecordContexts,
  isAuditEvidenceRef,
  type ResponseMap,
} from "@/lib/custom-audit-shared";
import { fetchAuditTemplate, templateToDefinition, type AuditTemplate } from "@/lib/audit-templates";
import { syncFindingsForScan } from "@/lib/findings";
import {
  RCA_OPTIONS,
  binKeyFromLocation,
  computeLineVariance,
  type RcaCode,
} from "@/lib/digital-audit";

export type CustomAuditLineDraft = {
  sectionKey: string;
  recordIndex: number;
  sku: string | null;
  item_code: string | null;
  barcode: string | null;
  product_name: string;
  category: string | null;
  brand: string | null;
  location: string;
  bin_key: string;
  expected_qty: number;
  system_qty: number | null;
  actual_qty: number | null;
  mrp_inr: number | null;
  rca_code: RcaCode | null;
  rca_notes: string | null;
};

export type CustomAuditReviewContext = {
  scanId: string;
  assignmentId: string;
  orgId: string;
  storeId: string;
  userId: string;
};

export type CustomAuditEvidenceDraft = {
  bin_key: string;
  storage_path: string;
};

function asString(value: AuditResponseValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "number" && !Number.isNaN(value)) return String(value);
  return null;
}

function asNumber(value: AuditResponseValue): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function normalizeRcaCode(value: AuditResponseValue): RcaCode | null {
  const raw = asString(value);
  if (!raw) return null;
  const lower = raw.toLowerCase().replace(/\s+/g, "_");
  const byCode = RCA_OPTIONS.find((o) => o.code === lower);
  if (byCode) return byCode.code;
  const byLabel = RCA_OPTIONS.find((o) => o.label.toLowerCase() === raw.toLowerCase());
  return byLabel?.code ?? null;
}

export function stripAuditEvidenceRef(stored: string): string {
  return isAuditEvidenceRef(stored) ? stored.slice(AUDIT_EVIDENCE_REF_PREFIX.length) : stored;
}

export function normalizeImagePaths(value: AuditResponseValue): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  const single = asString(value);
  return single ? [single] : [];
}

function applyFieldToDraft(
  draft: CustomAuditLineDraft,
  field: TemplateField,
  value: AuditResponseValue,
): void {
  switch (field.type) {
    case "sku_id":
    case "sku_selector":
      draft.sku = asString(value) ?? draft.sku;
      break;
    case "item_code":
      draft.item_code = asString(value) ?? draft.item_code;
      break;
    case "barcode_scanner":
    case "qr_scanner":
      draft.barcode = asString(value) ?? draft.barcode;
      break;
    case "item_name":
    case "short_text":
      if (field.label.toLowerCase().includes("product") || field.key.includes("product")) {
        draft.product_name = asString(value) ?? draft.product_name;
      }
      break;
    case "brand":
      draft.brand = asString(value) ?? draft.brand;
      break;
    case "category":
    case "subcategory":
      draft.category = asString(value) ?? draft.category;
      break;
    case "store":
    case "warehouse":
    case "shelf":
    case "rack":
    case "bin":
      draft.location = asString(value) ?? draft.location;
      draft.bin_key = binKeyFromLocation(draft.location);
      break;
    case "expected_qty":
      draft.expected_qty = asNumber(value) ?? draft.expected_qty;
      break;
    case "actual_qty":
      draft.actual_qty = asNumber(value) ?? draft.actual_qty;
      break;
    case "currency":
      if (field.label.toLowerCase().includes("mrp") || field.key.includes("mrp")) {
        draft.mrp_inr = asNumber(value) ?? draft.mrp_inr;
      }
      break;
    case "rca":
      draft.rca_code = normalizeRcaCode(value) ?? draft.rca_code;
      break;
    case "notes":
    case "long_text":
      if (field.label.toLowerCase().includes("rca") || field.key.includes("rca")) {
        draft.rca_notes = asString(value) ?? draft.rca_notes;
      }
      break;
    default:
      break;
  }
}

/** Build review line drafts from saved custom audit responses. */
export function buildDigitalAuditLineDraftsFromResponses(
  definition: TemplateDefinition,
  responses: ResponseMap,
): CustomAuditLineDraft[] {
  const records = buildRecordContexts(definition, responses);
  return records.map((rec) => {
    const draft: CustomAuditLineDraft = {
      sectionKey: rec.sectionKey,
      recordIndex: rec.recordIndex,
      sku: null,
      item_code: null,
      barcode: null,
      product_name: "Audit line",
      category: null,
      brand: null,
      location: "",
      bin_key: "default",
      expected_qty: 0,
      system_qty: null,
      actual_qty: null,
      mrp_inr: null,
      rca_code: null,
      rca_notes: null,
    };

    for (const field of definition.fields) {
      if (field.section !== rec.sectionKey) continue;
      const val = rec.values[field.key];
      if (val === null || val === undefined || val === "") continue;
      applyFieldToDraft(draft, field, val);
    }

    if (!draft.product_name || draft.product_name === "Audit line") {
      draft.product_name = draft.sku ?? `Record ${rec.recordIndex + 1}`;
    }
    if (!draft.location) {
      draft.bin_key = `record-${rec.recordIndex}`;
    } else {
      draft.bin_key = binKeyFromLocation(draft.location);
    }
    return draft;
  });
}

export function buildDigitalAuditLineRow(
  draft: CustomAuditLineDraft,
  ctx: CustomAuditReviewContext,
): Record<string, unknown> {
  const variance = computeLineVariance(draft.expected_qty, draft.actual_qty, draft.mrp_inr);
  return {
    scan_id: ctx.scanId,
    assignment_id: ctx.assignmentId,
    org_id: ctx.orgId,
    store_id: ctx.storeId,
    sku: draft.sku,
    item_code: draft.item_code,
    barcode: draft.barcode,
    brand: draft.brand,
    product_name: draft.product_name,
    category: draft.category,
    location: draft.location,
    bin_key: draft.bin_key,
    expected_qty: draft.expected_qty,
    system_qty: draft.system_qty,
    actual_qty: draft.actual_qty,
    mrp_inr: draft.mrp_inr,
    rca_code: draft.rca_code,
    rca_notes: draft.rca_notes,
    ...variance,
    entered_by: ctx.userId,
    source: "form",
  };
}

export function collectCustomAuditEvidenceDrafts(
  definition: TemplateDefinition,
  responses: ResponseMap,
): CustomAuditEvidenceDraft[] {
  const entries: CustomAuditEvidenceDraft[] = [];
  for (const field of definition.fields) {
    if (!isImageField(field.type)) continue;
    const sectionData = responses[field.section] ?? {};
    for (const [idxStr, recordValues] of Object.entries(sectionData)) {
      const paths = normalizeImagePaths(recordValues[field.key]);
      paths.forEach((stored, imageIndex) => {
        const binKey =
          paths.length > 1 ? `record-${idxStr}-${imageIndex}` : `record-${idxStr}`;
        entries.push({
          bin_key: binKey,
          storage_path: stripAuditEvidenceRef(stored),
        });
      });
    }
  }
  return entries;
}

export async function persistCustomAuditReviewData(input: {
  definition: TemplateDefinition;
  responses: ResponseMap;
  ctx: CustomAuditReviewContext;
}): Promise<{ lineCount: number; evidenceCount: number }> {
  const lineDrafts = buildDigitalAuditLineDraftsFromResponses(input.definition, input.responses);
  if (lineDrafts.length) {
    const lineRows = lineDrafts.map((draft) => buildDigitalAuditLineRow(draft, input.ctx));
    const { error: lineErr } = await supabase.from("digital_audit_lines").insert(lineRows);
    if (lineErr) dbError(lineErr, "Could not save audit review lines.");
  }

  const userId = input.ctx.userId || (await requireUserId());
  const evidenceDrafts = collectCustomAuditEvidenceDrafts(input.definition, input.responses);
  if (evidenceDrafts.length) {
    const evidenceRows = evidenceDrafts.map((entry) => ({
      scan_id: input.ctx.scanId,
      org_id: input.ctx.orgId,
      bin_key: entry.bin_key,
      storage_path: entry.storage_path,
      captured_by: userId,
    }));
    const { error: evidenceErr } = await supabase.from("audit_evidence").upsert(evidenceRows, {
      onConflict: "scan_id,bin_key",
    });
    if (evidenceErr) dbError(evidenceErr, "Could not save audit evidence.");
  }

  return { lineCount: lineDrafts.length, evidenceCount: evidenceDrafts.length };
}

async function fetchAuditResponsesForScan(
  scanId: string,
  assignmentId: string,
): Promise<{ section_key: string; record_index: number; field_key: string; value: unknown }[]> {
  const byScan = await supabase
    .from("audit_responses")
    .select("section_key, record_index, field_key, value")
    .eq("scan_id", scanId);
  if (byScan.error) dbError(byScan.error, "Could not load audit responses.");
  if (byScan.data?.length) return byScan.data;

  const byAssignment = await supabase
    .from("audit_responses")
    .select("section_key, record_index, field_key, value")
    .eq("assignment_id", assignmentId);
  if (byAssignment.error) dbError(byAssignment.error, "Could not load audit responses.");
  return byAssignment.data ?? [];
}

function definitionFromTemplateSnapshot(snapshot: AuditTemplate | null): TemplateDefinition | null {
  if (!snapshot) return null;
  if (snapshot.field_definitions?.length) return templateToDefinition(snapshot);
  if (snapshot.sections?.length) {
    return templateToDefinition({
      ...snapshot,
      field_definitions: snapshot.field_definitions ?? [],
    });
  }
  return null;
}

async function resolveReviewDefinition(input: {
  templateSnapshot: AuditTemplate | null;
  templateId: string | null;
}): Promise<TemplateDefinition | null> {
  const fromSnapshot = definitionFromTemplateSnapshot(input.templateSnapshot);
  if (fromSnapshot?.fields.length) return fromSnapshot;
  if (!input.templateId) return fromSnapshot;
  const template = await fetchAuditTemplate(input.templateId);
  return template ? templateToDefinition(template) : fromSnapshot;
}

/** Backfill review tables for scans submitted before materialization existed. */
export async function ensureCustomAuditReviewData(scanId: string): Promise<boolean> {
  const { data: existingLines } = await supabase
    .from("digital_audit_lines")
    .select("id")
    .eq("scan_id", scanId)
    .limit(1);
  if (existingLines?.length) return false;

  const { data: scan, error: scanErr } = await supabase
    .from("shelf_scans")
    .select("id, org_id, store_id, assignment_id, template_id, template_snapshot, created_by")
    .eq("id", scanId)
    .maybeSingle();
  if (scanErr || !scan?.assignment_id) return false;

  let storeId = scan.store_id as string | null;
  if (!storeId) {
    const { data: assignment } = await supabase
      .from("scan_assignments")
      .select("store_id")
      .eq("id", scan.assignment_id)
      .maybeSingle();
    storeId = (assignment?.store_id as string | null) ?? null;
  }
  if (!storeId) return false;

  const responses = await fetchAuditResponsesForScan(scanId, scan.assignment_id as string);
  if (!responses.length) return false;

  const snapshot = scan.template_snapshot as AuditTemplate | null;
  const definition = await resolveReviewDefinition({
    templateSnapshot: snapshot,
    templateId: (scan.template_id as string | null) ?? null,
  });
  if (!definition?.fields.length) return false;

  const responseMap: ResponseMap = {};
  for (const row of responses) {
    const section = row.section_key as string;
    const idx = row.record_index as number;
    responseMap[section] = responseMap[section] ?? {};
    responseMap[section][idx] = responseMap[section][idx] ?? {};
    responseMap[section][idx][row.field_key as string] = row.value as AuditResponseValue;
  }

  await persistCustomAuditReviewData({
    definition,
    responses: responseMap,
    ctx: {
      scanId,
      assignmentId: scan.assignment_id as string,
      orgId: scan.org_id as string,
      storeId,
      userId: (scan.created_by as string) ?? "",
    },
  });
  try {
    await syncFindingsForScan(scanId);
  } catch {
    /* best-effort backfill */
  }
  return true;
}
