/**
 * Custom audit execution — responses, submission, findings integration.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import { applyRuleActions, computeCompletion, validateRecord } from "@/lib/audit-builder/validation";
import type { AuditResponseValue, FieldConfig, TemplateDefinition, TemplateField } from "@/lib/audit-builder/types";
import {
  fetchAuditTemplate,
  templateToDefinition,
  type AuditTemplate,
} from "@/lib/audit-templates";
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

export type ResponseMap = Record<string, Record<number, Record<string, AuditResponseValue>>>;

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
  if (!assignment) return null;

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

export function buildRecordContexts(
  definition: TemplateDefinition,
  responses: ResponseMap,
) {
  const records: { sectionKey: string; recordIndex: number; values: Record<string, AuditResponseValue> }[] = [];

  for (const section of definition.sections) {
    const sectionData = responses[section.key] ?? { 0: {} };
    const indices = Object.keys(sectionData).map(Number).sort((a, b) => a - b);
    const idxList = indices.length ? indices : [0];
    for (const idx of idxList) {
      records.push({
        sectionKey: section.key,
        recordIndex: idx,
        values: sectionData[idx] ?? {},
      });
    }
  }
  return records;
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
    const { data: assignmentRow } = await supabase
      .from("scan_assignments")
      .select("store_id")
      .eq("id", assignmentId)
      .single();

    const { data: scan, error: scanErr } = await supabase
      .from("shelf_scans")
      .insert({
        org_id: orgId,
        store_id: assignmentRow?.store_id,
        user_id: userId,
        status: "completed",
        template_id: session.template.id,
        template_version: session.template.version,
        template_snapshot: session.template as unknown as Record<string, unknown>,
        collection_method: "digital",
      })
      .select("id")
      .single();
    if (scanErr) dbError(scanErr, "Could not create audit record.");
    scanId = scan!.id as string;

    await supabase
      .from("audit_responses")
      .update({ scan_id: scanId })
      .eq("assignment_id", assignmentId);

    await supabase
      .from("scan_assignments")
      .update({
        status: "completed",
        approval_status:
          session.definition.workflow.submission === "direct" ? "approved" : "pending",
      })
      .eq("id", assignmentId);
  }

  let findingsCount = 0;
  for (const rec of records) {
    const { findings } = applyRuleActions(session.definition.rules, rec.values);
    findingsCount += findings.length;
  }

  if (scanId && findingsCount > 0) {
    try {
      await syncFindingsForScan(scanId);
    } catch {
      /* findings sync is best-effort */
    }
  }

  return { scanId, findingsCount };
}

/** Supabase Storage bucket for universal/custom audit evidence uploads. */
export const AUDIT_EVIDENCE_BUCKET = "audit-evidence";
/** Persisted reference prefix — private bucket paths are re-signed on display. */
export const AUDIT_EVIDENCE_REF_PREFIX = "audit-evidence://";

export function isAuditEvidenceRef(value: string): boolean {
  return value.startsWith(AUDIT_EVIDENCE_REF_PREFIX);
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
