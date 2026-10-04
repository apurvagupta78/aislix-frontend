/**
 * Custom audit execution — responses, submission, findings integration.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import { isImageField } from "@/lib/audit-builder/field-library";
import { applyRuleActions, computeCompletion, validateRecord } from "@/lib/audit-builder/validation";
import type { AuditResponseValue, FieldConfig, TemplateDefinition, TemplateField } from "@/lib/audit-builder/types";
import {
  fetchAuditTemplate,
  templateToDefinition,
  type AuditTemplate,
} from "@/lib/audit-templates";
import {
  AUDIT_EVIDENCE_BUCKET,
  AUDIT_EVIDENCE_REF_PREFIX,
  buildRecordContexts,
  isAuditEvidenceRef,
  isScanImagesRef,
  SCAN_IMAGES_BUCKET,
  SCAN_IMAGES_REF_PREFIX,
  type ResponseMap,
} from "@/lib/custom-audit-shared";
import {
  AUDIT_EVIDENCE_SECTION,
  DEVICE_METADATA_KEY,
  GPS_KEY,
  parseDeviceMetadata,
  parseGps,
} from "@/lib/audit-engine/grid-evidence";
import { syncFindingsForScan } from "@/lib/findings";
import { AuditSubmitError, describeMissingCells } from "@/lib/audit-engine/submit-readiness";
import type { InputSchema } from "@/lib/audit-builder/field-roles";
import { readStoredDataset, type AuditInputDataset } from "@/lib/audit-input-dataset";
import { hydrateReferenceValuesFromDataset } from "@/lib/audit-builder/input-schema";
import type { AuditEvidencePolicy } from "@/lib/audit-evidence-policy";
import type { Json } from "@/integrations/supabase/types";

export type CustomAuditSession = {
  assignmentId: string;
  template: AuditTemplate;
  definition: TemplateDefinition;
  storeName: string | null;
  dueAt: string | null;
  status: string;
  inputSchema?: InputSchema;
  inputDataset?: AuditInputDataset;
  assignerName?: string | null;
  assigneeName?: string | null;
  instructions?: string | null;
  auditName?: string | null;
  auditDescription?: string | null;
  createdAt?: string | null;
  evidencePolicy?: Partial<AuditEvidencePolicy> | null;
  requireRca?: boolean;
};

async function profileNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", unique);
  return new Map(
    (data ?? []).map((p) => [p.id as string, ((p.full_name as string | null) || (p.email as string | null) || "").trim()]),
  );
}

export type { ResponseMap } from "@/lib/custom-audit-shared";
export {
  AUDIT_EVIDENCE_BUCKET,
  AUDIT_EVIDENCE_REF_PREFIX,
  buildRecordContexts,
  isAuditEvidenceRef,
} from "@/lib/custom-audit-shared";

function responsesToMap(
  rows: { section_key: string; record_index: number; field_key: string; value: unknown }[],
): ResponseMap {
  const map: ResponseMap = {};
  for (const row of rows) {
    if (!map[row.section_key]) map[row.section_key] = {};
    if (!map[row.section_key][row.record_index]) map[row.section_key][row.record_index] = {};
    map[row.section_key][row.record_index][row.field_key] = row.value as AuditResponseValue;
  }
  return map;
}

export async function loadCustomAuditSession(
  assignmentId: string,
): Promise<CustomAuditSession | null> {
  const orgId = await requireOrgId();
  const { data: assignment, error } = await supabase
    .from("scan_assignments")
    .select("*, stores(name)")
    .eq("org_id", orgId)
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) dbError(error, "Could not load assignment.");
  if (!assignment) {
    // Self-schedule / recurring creates an audit_schedules row first. Opening that
    // UUID under /audit/:id used to show a blank failure — explain the wait state.
    const { data: schedule } = await supabase
      .from("audit_schedules")
      .select("id, name, status, publish_at, next_run_at, assignment_mode")
      .eq("org_id", orgId)
      .eq("id", assignmentId)
      .maybeSingle();
    if (schedule) {
      const when =
        (schedule.publish_at as string | null) ||
        (schedule.next_run_at as string | null);
      const whenLabel = when ? new Date(when).toLocaleString() : "the scheduled time";
      throw new Error(
        `“${(schedule.name as string | null) || "This audit"}” is scheduled for ${whenLabel}. ` +
          "It will appear in My Work after it publishes — this link is not an open assignment yet.",
      );
    }
    return null;
  }

  const templateSnapshot = assignment.template_snapshot as Record<string, unknown> | null;
  let template: AuditTemplate | null = null;

  if (templateSnapshot && templateSnapshot.id) {
    template = templateSnapshot as unknown as AuditTemplate;
  } else if (assignment.template_id) {
    template = await fetchAuditTemplate(assignment.template_id as string);
  }

  if (!template) return null;

  const storeRow = assignment.stores as { name?: string } | null;
  const purposeConfig = (template.purpose_config ?? {}) as Record<string, unknown>;
  const inputSchema = purposeConfig.inputSchema as InputSchema | undefined;
  const inputDataset = readStoredDataset(purposeConfig.input_dataset ?? templateSnapshot?.input_dataset);
  const assignerId = assignment.assigner_id as string;
  const assigneeId = assignment.assignee_id as string;
  const names = await profileNames([assignerId, assigneeId]).catch(() => new Map<string, string>());
  const scopeValues = (assignment.scope_values ?? {}) as Record<string, unknown>;
  const scopeText = (key: string) =>
    typeof scopeValues[key] === "string" ? (scopeValues[key] as string).trim() || null : null;

  return {
    assignmentId,
    template,
    definition: templateToDefinition(template),
    storeName: storeRow?.name ?? null,
    dueAt: (assignment.due_at as string) ?? null,
    status: assignment.status as string,
    inputSchema,
    inputDataset,
    assignerName: names.get(assignerId) || null,
    assigneeName: names.get(assigneeId) || null,
    instructions: (assignment.instructions as string | null) ?? null,
    auditName: scopeText("audit_name"),
    auditDescription: scopeText("audit_description"),
    createdAt: (assignment.created_at as string | null) ?? null,
    evidencePolicy: (assignment.evidence_policy as Partial<AuditEvidencePolicy> | null) ?? null,
    requireRca: (assignment as { require_rca?: boolean | null }).require_rca === true,
  };
}

/** Merge manager-provided CSV reference values into saved responses. */
export function mergeInputDatasetIntoResponses(
  session: CustomAuditSession,
  responses: ResponseMap,
): ResponseMap {
  if (!session.inputSchema || !session.inputDataset?.rows.length) return responses;

  const sectionKey = session.definition.sections.find((s) => s.repeatable)?.key ?? "records";
  const hydrated = hydrateReferenceValuesFromDataset(
    session.inputSchema,
    session.inputDataset,
    sectionKey,
  );
  const merged: ResponseMap = { ...responses };
  // Provided values always come from the file; pre-filled auditee values only until the auditee saves one.
  const editableKeys = new Set(
    session.definition.fields
      .filter((f) => f.section === sectionKey && f.fieldRole === "auditor_input")
      .map((f) => f.key),
  );

  for (const [idxStr, values] of Object.entries(hydrated[sectionKey] ?? {})) {
    const idx = Number(idxStr);
    merged[sectionKey] = { ...(merged[sectionKey] ?? {}) };
    const saved = merged[sectionKey][idx] ?? {};
    const next = { ...saved };
    for (const [key, value] of Object.entries(values)) {
      if (editableKeys.has(key) && saved[key] !== undefined && saved[key] !== null) continue;
      next[key] = value as AuditResponseValue;
    }
    merged[sectionKey][idx] = next;
  }
  return merged;
}

export async function fetchCustomAuditResponses(assignmentId: string): Promise<ResponseMap> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("audit_responses")
    .select("section_key, record_index, field_key, value")
    .eq("org_id", orgId)
    .eq("assignment_id", assignmentId);
  if (error) {
    if (error.code === "42P01") return {};
    dbError(error, "Could not load audit responses.");
  }
  return responsesToMap(data ?? []);
}

export async function saveCustomAuditField(input: {
  assignmentId: string;
  templateId: string;
  templateVersion: number;
  sectionKey: string;
  recordIndex: number;
  field: TemplateField;
  value: AuditResponseValue;
  aiSuggested?: unknown;
  humanConfirmed?: boolean;
}): Promise<void> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();

  const { error } = await supabase.from("audit_responses").upsert(
    {
      org_id: orgId,
      assignment_id: input.assignmentId,
      template_id: input.templateId,
      template_version: input.templateVersion,
      section_key: input.sectionKey,
      record_index: input.recordIndex,
      field_key: input.field.key,
      field_type: input.field.type,
      field_config: input.field.config as FieldConfig,
      value: input.value,
      ai_suggested: input.aiSuggested ?? null,
      human_confirmed: input.humanConfirmed ?? false,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "assignment_id,section_key,record_index,field_key" },
  );
  if (error) {
    if (error.code === "42P01") {
      throw new Error("Custom audit responses not available. Apply audit builder migration.");
    }
    dbError(error, "Could not save field.");
  }
}

/** Save many cells at once (e.g. an uploaded filled copy); same row shape as saveCustomAuditField. */
export async function saveCustomAuditFields(input: {
  assignmentId: string;
  templateId: string;
  templateVersion: number;
  sectionKey: string;
  items: Array<{ recordIndex: number; field: TemplateField; value: AuditResponseValue }>;
}): Promise<void> {
  if (!input.items.length) return;
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const rows = input.items.map((item) => ({
    org_id: orgId,
    assignment_id: input.assignmentId,
    template_id: input.templateId,
    template_version: input.templateVersion,
    section_key: input.sectionKey,
    record_index: item.recordIndex,
    field_key: item.field.key,
    field_type: item.field.type,
    field_config: item.field.config as unknown as Json,
    value: item.value as Json,
    ai_suggested: null,
    human_confirmed: false,
    updated_by: userId,
    updated_at: now,
  }));
  for (let start = 0; start < rows.length; start += 500) {
    const { error } = await supabase
      .from("audit_responses")
      .upsert(rows.slice(start, start + 500), { onConflict: "assignment_id,section_key,record_index,field_key" });
    if (error) dbError(error, "Could not save uploaded values.");
  }
}

/** Obsolete shelf_scans columns — must never appear on custom audit submit payloads. */
export const OBSOLETE_SHELF_SCAN_SUBMIT_COLUMNS = ["collection_method", "user_id"] as const;

/** Live shelf_scans.photo_count CHECK requires >= 1. */
export const MIN_SHELF_SCAN_PHOTO_COUNT = 1;

/** Count uploaded evidence images across all custom audit response rows. */
export function countEvidencePhotosInResponses(
  definition: TemplateDefinition,
  responses: ResponseMap,
): number {
  let count = 0;
  for (const field of definition.fields) {
    if (!isImageField(field.type)) continue;
    const sectionData = responses[field.section] ?? {};
    for (const recordValues of Object.values(sectionData)) {
      const val = recordValues[field.key];
      if (!val) continue;
      if (Array.isArray(val)) count += val.filter((item) => Boolean(item)).length;
      else if (typeof val === "string" && val.trim()) count += 1;
    }
  }
  return count;
}

/** Build a shelf_scans insert row for custom/universal audit submission (live schema). */
export function buildCustomAuditShelfScanInsert(input: {
  orgId: string;
  storeId: string | null | undefined;
  userId: string;
  assignmentId: string;
  templateId: string;
  templateVersion: number;
  templateSnapshot: Record<string, unknown>;
  workflowSubmission?: "direct" | "manager_approval" | "regional_approval";
  evidencePhotoCount?: number;
  deviceInfo?: Record<string, unknown>;
}): Record<string, unknown> {
  const submittedAt = new Date().toISOString();
  const directApproval = input.workflowSubmission === "direct";
  return {
    org_id: input.orgId,
    store_id: input.storeId ?? null,
    created_by: input.userId,
    assignment_id: input.assignmentId,
    status: "completed",
    audit_mode: "digital",
    submission_status: directApproval ? "approved" : "pending_review",
    submitted_at: submittedAt,
    template_id: input.templateId,
    template_version: input.templateVersion,
    template_snapshot: input.templateSnapshot,
    photo_count: Math.max(MIN_SHELF_SCAN_PHOTO_COUNT, input.evidencePhotoCount ?? 0),
    category_selections: {},
    device_info: input.deviceInfo ?? {},
  };
}

/** Device, time and location details captured during the audit, stamped with the submit time. */
export function buildSubmitDeviceInfo(responses: ResponseMap): Record<string, unknown> {
  const audit = responses[AUDIT_EVIDENCE_SECTION]?.[0] ?? {};
  const device = parseDeviceMetadata(audit[DEVICE_METADATA_KEY]);
  const gps = parseGps(audit[GPS_KEY]);
  return {
    ...(device ?? {}),
    submittedAt: new Date().toISOString(),
    ...(typeof navigator !== "undefined" && !device ? { userAgent: navigator.userAgent } : {}),
    ...(gps ? { gps } : {}),
  };
}

export async function submitCustomAudit(input: {
  assignmentId: string;
  session: CustomAuditSession;
  responses: ResponseMap;
  testMode?: boolean;
}): Promise<{ scanId: string | null; findingsCount: number }> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const { session, responses, assignmentId, testMode } = input;
  const records = buildRecordContexts(session.definition, responses);
  const completion = computeCompletion(session.definition, records);

  if (!completion.complete) {
    throw new AuditSubmitError(
      "This audit isn't finished yet.",
      describeMissingCells(session.definition, completion.missing, records),
    );
  }

  const repeatableKey = session.definition.sections.find((s) => s.repeatable)?.key ?? null;
  const rowOrder = records.filter((r) => r.sectionKey === repeatableKey).map((r) => r.recordIndex);
  const valueProblems: string[] = [];
  for (const rec of records) {
    const errs = validateRecord(session.definition, rec);
    if (!errs.length) continue;
    const where = rec.sectionKey === repeatableKey ? `Row ${rowOrder.indexOf(rec.recordIndex) + 1}: ` : "";
    valueProblems.push(...errs.map((e) => `${where}${e}.`));
  }
  if (valueProblems.length) {
    throw new AuditSubmitError("Some values need fixing before you can submit.", valueProblems);
  }

  let scanId: string | null = null;

  if (!testMode) {
    const { assertCanStartScan, hasPlatformBypass, mapLimitError } =
      await import("@/lib/subscription-limits");
    try {
      await assertCanStartScan(orgId);
    } catch (error) {
      const { data: auth } = await supabase.auth.getUser();
      if (!hasPlatformBypass(auth.user?.email)) throw error;
    }

    const { data: assignmentRow } = await supabase
      .from("scan_assignments")
      .select("store_id")
      .eq("id", assignmentId)
      .single();

    const directApproval = session.definition.workflow.submission === "direct";
    const evidencePhotoCount = countEvidencePhotosInResponses(session.definition, responses);
    const scanInsert = buildCustomAuditShelfScanInsert({
      orgId,
      storeId: assignmentRow?.store_id as string | null | undefined,
      userId,
      assignmentId,
      templateId: session.template.id,
      templateVersion: session.template.version,
      templateSnapshot: session.template as unknown as Record<string, unknown>,
      workflowSubmission: session.definition.workflow.submission,
      evidencePhotoCount,
      deviceInfo: buildSubmitDeviceInfo(responses),
    });

    const { data: scan, error: scanErr } = await supabase
      .from("shelf_scans")
      .insert(scanInsert)
      .select("id")
      .single();
    if (scanErr) {
      const mapped = await mapLimitError(scanErr, orgId);
      if (mapped !== scanErr) throw mapped;
      dbError(scanErr, "Could not create audit record.");
    }
    scanId = scan!.id as string;

    const { error: linkErr } = await supabase
      .from("audit_responses")
      .update({ scan_id: scanId })
      .eq("assignment_id", assignmentId);
    if (linkErr) dbError(linkErr, "Could not link audit responses to scan.");

    const { persistCustomAuditReviewData, collectCustomAuditEvidenceDrafts } = await import(
      "@/lib/custom-audit-review"
    );
    await persistCustomAuditReviewData({
      definition: session.definition,
      responses,
      ctx: {
        scanId,
        assignmentId,
        orgId,
        storeId: (assignmentRow?.store_id as string) ?? "",
        userId,
      },
    });

    // FNV QC: after lines+evidence persist, run Astra from DB-authoritative evidence rows.
    const isFnv =
      session.template.template_type === "fnv_qc_audit" ||
      session.template.audit_purpose === "fnv_qc" ||
      Boolean(session.template.name?.toLowerCase().includes("fnv")) ||
      session.definition.purpose === "fnv_qc";
    if (isFnv) {
      const { ensureFnvQcForScan, runFnvQcOnBinEvidence } = await import(
        "@/lib/fnv-qc.functions"
      );
      const evidenceDrafts = collectCustomAuditEvidenceDrafts(session.definition, responses);
      const lineHint =
        buildRecordContexts(session.definition, responses)[0]?.values ?? {};
      const productHint =
        String(lineHint.item_name ?? lineHint.product ?? lineHint.sku ?? lineHint.sku_id ?? "") ||
        null;
      let ran = 0;
      for (const evidence of evidenceDrafts) {
        const out = await runFnvQcOnBinEvidence({
          data: {
            scanId,
            binKey: evidence.bin_key,
            storagePath: evidence.storage_path,
            storageBucket: "audit-evidence",
            productHint,
          },
        });
        if (out?.skipped === "not_fnv") {
          throw new Error("FNV QC skipped: template was not classified as FNV on the server.");
        }
        if (out?.result) ran += 1;
      }
      const ensured = await ensureFnvQcForScan({ data: { scanId, productHint } });
      ran += ensured?.ran ?? 0;
      if (ensured?.skipped === "no_evidence" && evidenceDrafts.length === 0) {
        throw new Error("FNV QC requires at least one evidence image before submit.");
      }
      if (ran === 0 && ensured?.skipped !== "already_complete") {
        throw new Error("FNV QC did not persist a disposition. Re-upload evidence and submit again.");
      }
    }

    await supabase
      .from("scan_assignments")
      .update({
        status: "completed",
        scan_id: scanId,
        approval_status: directApproval ? "approved" : "pending_review",
      })
      .eq("id", assignmentId);

    try {
      await syncFindingsForScan(scanId);
    } catch {
      /* findings sync is best-effort */
    }
  }

  let findingsCount = 0;
  for (const rec of records) {
    const { findings } = applyRuleActions(session.definition.rules, rec.values);
    findingsCount += findings.length;
  }

  return { scanId, findingsCount };
}

export async function resolveAuditEvidenceUrl(stored: string): Promise<string> {
  if (isScanImagesRef(stored)) {
    const { data } = await supabase.storage
      .from(SCAN_IMAGES_BUCKET)
      .createSignedUrl(stored.slice(SCAN_IMAGES_REF_PREFIX.length), 3600);
    return data?.signedUrl ?? stored;
  }
  if (!isAuditEvidenceRef(stored)) return stored;
  const path = stored.slice(AUDIT_EVIDENCE_REF_PREFIX.length);
  const { data, error } = await supabase.storage
    .from(AUDIT_EVIDENCE_BUCKET)
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return stored;
  return data.signedUrl;
}

export async function uploadCustomAuditImage(
  assignmentId: string,
  file: File,
): Promise<string> {
  const orgId = await requireOrgId();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${orgId}/custom-audit/${assignmentId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(AUDIT_EVIDENCE_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) dbError(error, "Could not upload image.");
  return `${AUDIT_EVIDENCE_REF_PREFIX}${path}`;
}

export const MAX_CUSTOM_AUDIT_VIDEO_BYTES = 100 * 1024 * 1024;

export async function uploadCustomAuditVideo(assignmentId: string, file: File): Promise<string> {
  if (file.size > MAX_CUSTOM_AUDIT_VIDEO_BYTES) {
    throw new Error("Session video is too large. Upload a clip under 100 MB.");
  }
  const orgId = await requireOrgId();
  const ext = (file.name.split(".").pop() ?? "mp4").toLowerCase();
  const contentType = file.type || (ext === "mov" ? "video/quicktime" : ext === "webm" ? "video/webm" : "video/mp4");
  const path = `${orgId}/custom-audit/${assignmentId}/video-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(SCAN_IMAGES_BUCKET).upload(path, file, {
    upsert: false,
    contentType,
  });
  if (error) dbError(error, "Could not upload the session video.");
  return `${SCAN_IMAGES_REF_PREFIX}${path}`;
}
