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
  type ResponseMap,
} from "@/lib/custom-audit-shared";
import { syncFindingsForScan } from "@/lib/findings";
import type { InputSchema } from "@/lib/audit-builder/field-roles";
import type { AuditInputDataset } from "@/lib/audit-input-dataset";
import { hydrateReferenceValuesFromDataset } from "@/lib/audit-builder/input-schema";

export type CustomAuditSession = {
  assignmentId: string;
  template: AuditTemplate;
  definition: TemplateDefinition;
  storeName: string | null;
  dueAt: string | null;
  status: string;
  inputSchema?: InputSchema;
  inputDataset?: AuditInputDataset;
};

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
  const inputDataset =
    (purposeConfig.input_dataset as AuditInputDataset | undefined) ??
    ((templateSnapshot?.input_dataset as AuditInputDataset | undefined) ?? undefined);

  return {
    assignmentId,
    template,
    definition: templateToDefinition(template),
    storeName: storeRow?.name ?? null,
    dueAt: (assignment.due_at as string) ?? null,
    status: assignment.status as string,
    inputSchema,
    inputDataset,
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

  for (const [idxStr, values] of Object.entries(hydrated[sectionKey] ?? {})) {
    const idx = Number(idxStr);
    merged[sectionKey] = merged[sectionKey] ?? {};
    merged[sectionKey][idx] = {
      ...(merged[sectionKey][idx] ?? {}),
      ...values,
    };
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
    device_info: {},
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
    const labels = completion.missing.map((m) => m.label).join(", ");
    throw new Error(`Audit incomplete (${completion.percent}%). Missing: ${labels}`);
  }

  for (const rec of records) {
    const errs = validateRecord(session.definition, rec);
    if (errs.length) throw new Error(errs.join("; "));
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
      try {
        const { ensureFnvQcForScan, runFnvQcOnBinEvidence } = await import(
          "@/lib/fnv-qc.functions"
        );
        const evidenceDrafts = collectCustomAuditEvidenceDrafts(session.definition, responses);
        const lineHint =
          buildRecordContexts(session.definition, responses)[0]?.values ?? {};
        const productHint =
          String(lineHint.item_name ?? lineHint.product ?? lineHint.sku ?? lineHint.sku_id ?? "") ||
          null;
        for (const evidence of evidenceDrafts) {
          await runFnvQcOnBinEvidence({
            data: {
              scanId,
              binKey: evidence.bin_key,
              storagePath: evidence.storage_path,
              storageBucket: "audit-evidence",
              productHint,
            },
          });
        }
        // DB fallback covers drafts that missed image fields or prior null QC rows.
        await ensureFnvQcForScan({ data: { scanId, productHint } });
      } catch (fnvError) {
        console.error("[custom-audit] FNV QC analysis failed", fnvError);
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
