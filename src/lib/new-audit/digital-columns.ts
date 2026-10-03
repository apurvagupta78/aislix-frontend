import type { AuditDataColumn, AuditDataType, AuditInputDataset } from "@/lib/audit-input-dataset";
import type { ColumnMapping, InputSchema, TemplateFieldBinding } from "@/lib/audit-builder/field-roles";
import type { TemplateDefinition } from "@/lib/audit-builder/types";
import { buildTemplateFromInputSchema } from "@/lib/audit-builder/input-schema";
import { DIGITAL_CSV_TEMPLATE_SOURCE } from "@/lib/audit-templates";

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

/** Template definition for a Digital Audit upload: provided columns read-only, auditee columns editable. */
export function buildDigitalTemplateDefinition(
  inputSchema: InputSchema,
  dataset: AuditInputDataset,
  opts: { name: string; operatingModel: TemplateDefinition["operatingModel"] },
): TemplateDefinition {
  const def = buildTemplateFromInputSchema(inputSchema, dataset, opts);
  const keyOf = new Map(
    (inputSchema.templateFieldBindings ?? []).map((b) => [b.columnId, b.templateFieldKey] as const),
  );
  const byLabel = new Map(inputSchema.columnMappings.map((m) => [m.columnName, m] as const));
  return {
    ...def,
    fields: def.fields.map((field) => {
      const mapping = byLabel.get(field.label);
      const key = mapping ? keyOf.get(mapping.columnId) : undefined;
      if (!mapping || !key) return field;
      return {
        ...field,
        key,
        type: fieldTypeFor(mapping.fieldRole, mapping.dataType),
        standardConcept: undefined,
      };
    }),
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
};

export type DigitalColumnsAudit = {
  filename: string | null;
  columns: DigitalResultColumn[];
  rows: DigitalResultRow[];
};

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
): DigitalColumnsAudit | null {
  const columns = digitalResultColumns(snapshot);
  if (!columns) return null;
  const purpose = snapshot!.purpose_config as Record<string, unknown>;
  const schema = purpose.inputSchema as InputSchema;
  const dataset = purpose.input_dataset as AuditInputDataset | undefined;
  const sectionKey = schema.sectionKey ?? "records";
  const columnIdOf = new Map(
    (schema.templateFieldBindings ?? []).map((b) => [b.templateFieldKey, b.columnId] as const),
  );
  const saved = new Map<string, unknown>();
  for (const r of responses) {
    if (r.section_key === sectionKey) saved.set(`${r.record_index}:${r.field_key}`, r.value);
  }

  const rows = (dataset?.rows ?? []).map((row, index) => ({
    index,
    values: Object.fromEntries(
      columns.map((c) => {
        const fromFile = cellText(row.values[columnIdOf.get(c.key) ?? ""]);
        const key = `${index}:${c.key}`;
        if (c.role === "reference") return [c.key, fromFile];
        return [c.key, saved.has(key) ? cellText(saved.get(key)) : fromFile];
      }),
    ),
  }));
  return { filename: dataset?.filename ?? null, columns, rows };
}

/** Load a submitted Digital Audit upload's columns and values; null for any other kind of scan. */
export async function fetchDigitalColumnsAudit(scanId: string): Promise<DigitalColumnsAudit | null> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data: scan, error } = await supabase
    .from("shelf_scans")
    .select("template_snapshot")
    .eq("id", scanId)
    .maybeSingle();
  if (error || !scan) return null;
  const snapshot = scan.template_snapshot as Record<string, unknown> | null;
  if (!digitalResultColumns(snapshot)) return null;
  const { data: responses } = await supabase
    .from("audit_responses")
    .select("section_key, record_index, field_key, value")
    .eq("scan_id", scanId);
  return buildDigitalColumnsAudit(snapshot, responses ?? []);
}

/** Numeric value of a cell, or null when it is empty / not a number (₹, commas and spaces allowed). */
export function numericCell(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[₹$€£,\s]/g, "");
  if (!cleaned || !/^-?(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
