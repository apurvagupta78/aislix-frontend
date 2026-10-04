import {
  readStoredDataset,
  type AuditDataColumn,
  type AuditDataType,
  type AuditInputDataset,
} from "@/lib/audit-input-dataset";
import type { ColumnMapping, InputSchema, TemplateFieldBinding } from "@/lib/audit-builder/field-roles";
import type { AuditResponseValue, TemplateDefinition, TemplateField } from "@/lib/audit-builder/types";
import { buildTemplateFromInputSchema } from "@/lib/audit-builder/input-schema";
import { DIGITAL_CSV_TEMPLATE_SOURCE } from "@/lib/audit-templates";
import type { AuditEvidencePolicy, EvidenceProof } from "@/lib/audit-evidence-policy";
import {
  BARCODE_SCAN_KEY,
  VARIANCE_NOTE_KEY,
  VARIANCE_REASON_KEY,
  gridEvidenceColumns,
  type GridEvidenceColumns,
} from "@/lib/audit-engine/grid-evidence";
import type { ResponseMap } from "@/lib/custom-audit-shared";
import {
  EXPIRY_SCAN_STATUS_KEY,
  localIsoDate,
  rowExpiryState,
  type ExpiryStatus,
  type RowExpiry,
} from "@/lib/audit-engine/expiry-evidence";
import { policyNearExpiryDays } from "@/lib/audit-evidence-policy";

export { DIGITAL_CSV_TEMPLATE_SOURCE };

/** The two roles a manager can give a column in a Digital Audit upload. */
export type DigitalColumnRole = "reference" | "auditor_input";

const AUDITEE_HEADER =
  /^(actual|counted|physical|found|observed|auditee|remark|note|comment|condition|shelf_|displayed|photo|evidence)/;
const PRODUCT_HEADER = /^(product|product_name|item|item_name|description|item_description|sku_name|article_name)$/;

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function suggestRole(column: AuditDataColumn, dataset: AuditInputDataset): DigitalColumnRole {
  const empty = dataset.rows.every((row) => !(row.values[column.id] ?? "").trim());
  if (empty) return "auditor_input";
  return AUDITEE_HEADER.test(slug(column.name)) ? "auditor_input" : "reference";
}

export function digitalColumnMapping(
  column: AuditDataColumn,
  role: DigitalColumnRole,
  compareWithColumnId?: string,
): ColumnMapping {
  return {
    columnId: column.id,
    columnName: column.name,
    dataType: column.type,
    fieldRole: role,
    aislixMapping: "custom",
    auditorFills: role === "auditor_input",
    required: role === "auditor_input",
    evidenceRequired: false,
    autoSuggested: false,
    ...(role === "auditor_input" && compareWithColumnId ? { compareWithColumnId } : {}),
  };
}

/**
 * Keep the manager's role / pairing choices for columns that still exist and suggest a role
 * for new ones. Pairings to removed or non-provided columns are dropped.
 */
export function syncDigitalMappings(
  dataset: AuditInputDataset,
  previous: ColumnMapping[] = [],
): ColumnMapping[] {
  const prior = new Map(previous.map((m) => [m.columnId, m]));
  const roles = new Map<string, DigitalColumnRole>(
    dataset.columns.map((c) => {
      const role = prior.get(c.id)?.fieldRole;
      return [c.id, role === "reference" || role === "auditor_input" ? role : suggestRole(c, dataset)];
    }),
  );
  return dataset.columns.map((column) => {
    const role = roles.get(column.id)!;
    const pair = prior.get(column.id)?.compareWithColumnId;
    const validPair = pair && roles.get(pair) === "reference" ? pair : undefined;
    return digitalColumnMapping(column, role, validPair);
  });
}

export function buildDigitalInputSchema(dataset: AuditInputDataset, mappings: ColumnMapping[]): InputSchema {
  const used = new Set<string>();
  let productBound = false;
  const templateFieldBindings: TemplateFieldBinding[] = mappings.map((m, index) => {
    let key = slug(m.columnName) || `column_${index + 1}`;
    if (!productBound && m.fieldRole === "reference" && PRODUCT_HEADER.test(key)) {
      key = "item_name";
      productBound = true;
    }
    let unique = key;
    for (let n = 2; used.has(unique); n += 1) unique = `${key}_${n}`;
    used.add(unique);
    return { columnId: m.columnId, templateFieldKey: unique };
  });
  return {
    subjectType: "sku",
    columnMappings: mappings,
    preserveAllColumns: true,
    sectionKey: "records",
    templateFieldBindings,
  };
}

function fieldTypeFor(role: ColumnMapping["fieldRole"], dataType: AuditDataType) {
  if (role === "auditor_input" && (dataType === "number" || dataType === "integer")) return "number" as const;
  return "short_text" as const;
}

export type DigitalRowEvidence = "required" | "on_mismatch" | "optional" | "off";

function rowEvidenceFields(sectionKey: string, order: number, mode: DigitalRowEvidence): TemplateField[] {
  if (mode === "off") return [];
  const system = (key: string, label: string, offset: number): TemplateField => ({
    id: `field_${key}`,
    key,
    type: "short_text",
    label,
    section: sectionKey,
    order: order + offset,
    required: false,
    config: { readOnly: true },
    fieldRole: "system",
    system: true,
  });
  return [
    {
      id: "field_evidence_photo",
      key: "evidence_photo",
      type: "multiple_images",
      label: "Evidence",
      section: sectionKey,
      order,
      required: mode === "required",
      config: { maxImages: 6, galleryAllowed: true },
      fieldRole: "evidence",
    },
    system("evidence_status", "Evidence validation", 1),
    system("evidence_flags", "Evidence flags", 2),
  ];
}

/** Template definition for a Digital Audit upload: provided columns read-only, auditee columns editable. */
export function buildDigitalTemplateDefinition(
  inputSchema: InputSchema,
  dataset: AuditInputDataset,
  opts: {
    name: string;
    operatingModel: TemplateDefinition["operatingModel"];
    rowEvidence?: DigitalRowEvidence;
  },
): TemplateDefinition {
  const def = buildTemplateFromInputSchema(inputSchema, dataset, opts);
  const keyOf = new Map(
    (inputSchema.templateFieldBindings ?? []).map((b) => [b.columnId, b.templateFieldKey] as const),
  );
  const byLabel = new Map(inputSchema.columnMappings.map((m) => [m.columnName, m] as const));
  const fields = def.fields.map((field) => {
    const mapping = byLabel.get(field.label);
    const key = mapping ? keyOf.get(mapping.columnId) : undefined;
    if (!mapping || !key) return field;
    return {
      ...field,
      key,
      type: fieldTypeFor(mapping.fieldRole, mapping.dataType),
      standardConcept: undefined,
    };
  });
  const sectionKey = def.sections.find((s) => s.repeatable)?.key ?? "records";
  const nextOrder = Math.max(-1, ...fields.map((f) => f.order)) + 1;
  return {
    ...def,
    fields: [...fields, ...rowEvidenceFields(sectionKey, nextOrder, opts.rowEvidence ?? "off")],
  };
}

export type DigitalResultColumn = {
  key: string;
  label: string;
  role: DigitalColumnRole;
  /** Field key of the provided column this auditee column is compared with. */
  compareWithKey?: string;
};

/** Read column roles and pairings back from a submitted audit's template snapshot. */
export function digitalResultColumns(snapshot: Record<string, unknown> | null | undefined): DigitalResultColumn[] | null {
  const purpose = (snapshot?.purpose_config ?? null) as Record<string, unknown> | null;
  if (!purpose || purpose.source !== DIGITAL_CSV_TEMPLATE_SOURCE) return null;
  const schema = purpose.inputSchema as InputSchema | undefined;
  if (!schema?.columnMappings?.length) return null;
  const keyOf = new Map(
    (schema.templateFieldBindings ?? []).map((b) => [b.columnId, b.templateFieldKey] as const),
  );
  return schema.columnMappings
    .filter((m) => keyOf.has(m.columnId))
    .map((m) => ({
      key: keyOf.get(m.columnId)!,
      label: m.columnName,
      role: m.fieldRole === "auditor_input" ? "auditor_input" : "reference",
      ...(m.compareWithColumnId && keyOf.has(m.compareWithColumnId)
        ? { compareWithKey: keyOf.get(m.compareWithColumnId)! }
        : {}),
    }));
}

export type DigitalResultRow = {
  index: number;
  /** field key → value; auditee keys are null when not filled. */
  values: Record<string, string | null>;
  photos: string[];
  /** Saved evidence check: status then reasons, e.g. ["needs_review", "Duplicate photo"]. */
  evidence: string[] | null;
  barcodeExpected?: string | null;
  barcodeScanned?: string | null;
  varianceReason?: string | null;
  varianceNote?: string | null;
  /** Expiry dates evidence; set only when the policy required it. */
  expiry?: RowExpiry | null;
};

/** Everything the auditee captured for the evidence the manager required. */
export type DigitalAuditEvidence = {
  requiredProof: EvidenceProof[];
  requireRca: boolean;
  dataset: AuditInputDataset | null;
  columns: GridEvidenceColumns;
  shelfColumnName: string | null;
  barcodeColumnName: string | null;
  responses: ResponseMap;
  deviceInfo: Record<string, unknown> | null;
};

export type DigitalColumnsAudit = {
  filename: string | null;
  columns: DigitalResultColumn[];
  rows: DigitalResultRow[];
  rowEvidence: DigitalRowEvidence;
  evidence?: DigitalAuditEvidence;
};

/** Expiry is judged against the day the audit was submitted, so results don't change as time passes. */
export function auditDayOf(deviceInfo: Record<string, unknown> | null | undefined): string {
  const submitted = deviceInfo?.submittedAt;
  const at = typeof submitted === "string" ? new Date(submitted) : null;
  return localIsoDate(at && !Number.isNaN(at.getTime()) ? at : new Date());
}

function cellText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : null;
  const text = String(value).trim();
  return text ? text : null;
}

/**
 * Join the uploaded file (provided values) with what the auditee saved, row by row.
 * `responses` are audit_responses rows for the scan.
 */
export function buildDigitalColumnsAudit(
  snapshot: Record<string, unknown> | null | undefined,
  responses: Array<{ section_key: string; record_index: number; field_key: string; value: unknown }>,
  extra?: {
    evidencePolicy?: Partial<AuditEvidencePolicy> | null;
    requireRca?: boolean;
    deviceInfo?: Record<string, unknown> | null;
  },
): DigitalColumnsAudit | null {
  const columns = digitalResultColumns(snapshot);
  if (!columns) return null;
  const purpose = snapshot!.purpose_config as Record<string, unknown>;
  const schema = purpose.inputSchema as InputSchema;
  const dataset = readStoredDataset(purpose.input_dataset);
  const sectionKey = schema.sectionKey ?? "records";
  const columnIdOf = new Map(
    (schema.templateFieldBindings ?? []).map((b) => [b.templateFieldKey, b.columnId] as const),
  );
  const saved = new Map<string, unknown>();
  for (const r of responses) {
    if (r.section_key === sectionKey) saved.set(`${r.record_index}:${r.field_key}`, r.value);
  }

  const responseMap: ResponseMap = {};
  for (const r of responses) {
    const section = (responseMap[r.section_key] ??= {});
    const record = (section[r.record_index] ??= {});
    record[r.field_key] = r.value as AuditResponseValue;
  }
  const policy = extra?.evidencePolicy ?? (snapshot?.evidence_policy as Partial<AuditEvidencePolicy> | undefined) ?? null;
  const needsExpiry = Array.isArray(policy?.requiredProof) && policy.requiredProof.includes("expiry_date");
  const today = auditDayOf(extra?.deviceInfo);
  const nearDays = policyNearExpiryDays(policy);
  const expiryOf = (index: number): RowExpiry | null => {
    if (!needsExpiry) return null;
    const values = responseMap[sectionKey]?.[index] ?? {};
    const state = rowExpiryState(values, today, nearDays);
    const raw = values[EXPIRY_SCAN_STATUS_KEY];
    const savedStatus = raw === "expired" || raw === "near_expiry" || raw === "ok" ? (raw as ExpiryStatus) : null;
    return savedStatus && state.status !== "expired" ? { ...state, status: savedStatus } : state;
  };

  const asList = (value: unknown) => (Array.isArray(value) ? value.map(String).filter(Boolean) : []);
  const evidenceColumns = gridEvidenceColumns(purpose);
  const rows = (dataset?.rows ?? []).map((row, index) => {
    const evidence = asList(saved.get(`${index}:evidence_status`));
    const barcodeExpected = evidenceColumns.barcodeColumnId
      ? cellText(row.values[evidenceColumns.barcodeColumnId])
      : null;
    return {
      barcodeExpected,
      barcodeScanned: cellText(saved.get(`${index}:${BARCODE_SCAN_KEY}`)),
      varianceReason: cellText(saved.get(`${index}:${VARIANCE_REASON_KEY}`)),
      varianceNote: cellText(saved.get(`${index}:${VARIANCE_NOTE_KEY}`)),
      index,
      values: Object.fromEntries(
        columns.map((c) => {
          const fromFile = cellText(row.values[columnIdOf.get(c.key) ?? ""]);
          const key = `${index}:${c.key}`;
          if (c.role === "reference") return [c.key, fromFile];
          return [c.key, saved.has(key) ? cellText(saved.get(key)) : fromFile];
        }),
      ),
      photos: asList(saved.get(`${index}:evidence_photo`)),
      evidence: evidence.length ? evidence : null,
      expiry: expiryOf(index),
    };
  });
  const mode = purpose.rowEvidence;
  const rowEvidence: DigitalRowEvidence =
    mode === "required" || mode === "on_mismatch" || mode === "optional" ? mode : "off";
  const columnName = (id: string | null) => (id ? dataset?.columns.find((c) => c.id === id)?.name ?? null : null);
  return {
    filename: dataset?.filename ?? null,
    columns,
    rows,
    rowEvidence,
    evidence: {
      requiredProof: Array.isArray(policy?.requiredProof) ? policy.requiredProof : [],
      requireRca: Boolean(extra?.requireRca),
      dataset: dataset ?? null,
      columns: evidenceColumns,
      shelfColumnName: columnName(evidenceColumns.shelfColumnId),
      barcodeColumnName: columnName(evidenceColumns.barcodeColumnId),
      responses: responseMap,
      deviceInfo: extra?.deviceInfo ?? null,
    },
  };
}

/** Load a submitted Digital Audit upload's columns and values; null for any other kind of scan. */
export async function fetchDigitalColumnsAudit(scanId: string): Promise<DigitalColumnsAudit | null> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data: scan, error } = await supabase
    .from("shelf_scans")
    .select("template_snapshot, assignment_id, device_info")
    .eq("id", scanId)
    .maybeSingle();
  if (error || !scan) return null;
  const snapshot = scan.template_snapshot as Record<string, unknown> | null;
  if (!digitalResultColumns(snapshot)) return null;
  const assignmentId = (scan as { assignment_id?: string | null }).assignment_id;
  const [{ data: responses }, assignment] = await Promise.all([
    supabase.from("audit_responses").select("section_key, record_index, field_key, value").eq("scan_id", scanId),
    assignmentId
      ? supabase.from("scan_assignments").select("evidence_policy, require_rca").eq("id", assignmentId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const assignmentRow = assignment.data as { evidence_policy?: unknown; require_rca?: boolean | null } | null;
  return buildDigitalColumnsAudit(snapshot, responses ?? [], {
    evidencePolicy: (assignmentRow?.evidence_policy as Partial<AuditEvidencePolicy> | null) ?? null,
    requireRca: assignmentRow?.require_rca === true,
    deviceInfo: ((scan as { device_info?: unknown }).device_info as Record<string, unknown> | null) ?? null,
  });
}

/** Numeric value of a cell, or null when it is empty / not a number (₹, commas and spaces allowed). */
export function numericCell(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[₹$€£,\s]/g, "");
  if (!cleaned || !/^-?(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
