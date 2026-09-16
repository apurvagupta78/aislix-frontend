import type { AuditInputDataset } from "@/lib/audit-input-dataset";
import type { AuditTemplate } from "@/lib/audit-templates";
import { templateToDefinition } from "@/lib/audit-templates";
import type { TemplateDefinition, TemplateField } from "./types";
import type { AuditDataInputMode } from "./audit-data-modes";
import {
  inferRoleFromField,
  mappingToTemplateFieldKey,
  type ColumnMapping,
  type InputSchema,
  type TemplateFieldBinding,
} from "./field-roles";
import { mergeInputSchemaIntoSnapshot } from "./input-schema";

export function getRepeatableSectionKey(def: TemplateDefinition): string {
  return def.sections.find((s) => s.repeatable)?.key ?? def.sections[0]?.key ?? "records";
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function templateFieldForMapping(field: TemplateField, mapping: ColumnMapping): boolean {
  if (mapping.aislixMapping !== "custom" && field.standardConcept === mapping.aislixMapping) {
    return true;
  }
  if (mapping.aislixMapping !== "custom") {
    const mappedKey = mappingToTemplateFieldKey(mapping.aislixMapping);
    if (mappedKey && field.key === mappedKey) return true;
    if (field.type === mapping.aislixMapping) return true;
  }
  return normalizeLabel(field.label) === normalizeLabel(mapping.columnName);
}

export function buildTemplateFieldBindings(
  def: TemplateDefinition,
  inputSchema: InputSchema,
): TemplateFieldBinding[] {
  const bindings: TemplateFieldBinding[] = [];
  for (const mapping of inputSchema.columnMappings) {
    const match = def.fields.find((f) => templateFieldForMapping(f, mapping));
    if (match) {
      bindings.push({
        columnId: mapping.columnId,
        templateFieldKey: match.key,
        standardConcept:
          mapping.aislixMapping !== "custom" ? String(mapping.aislixMapping) : undefined,
      });
    }
  }
  return bindings;
}

/** Mark template fields supplied by manager CSV as read-only reference. */
export function applyReferenceRolesFromCsv(
  template: AuditTemplate,
  inputSchema: InputSchema,
): AuditTemplate {
  const def = templateToDefinition(template);
  const referenceMappings = inputSchema.columnMappings.filter((m) => m.fieldRole === "reference");

  const field_definitions = template.field_definitions.map((field) => {
    const fromCsv = referenceMappings.some((m) => templateFieldForMapping(field, m));
    if (!fromCsv) return field;
    return {
      ...field,
      fieldRole: "reference" as const,
      config: { ...field.config, readOnly: true },
    };
  });

  return { ...template, field_definitions };
}

export function buildMergedTemplateSnapshot(input: {
  template: AuditTemplate;
  inputSchema: InputSchema;
  dataset: AuditInputDataset;
  dataInputMode: AuditDataInputMode;
}): Record<string, unknown> {
  const { template, inputSchema, dataset, dataInputMode } = input;
  const def = templateToDefinition(template);
  const sectionKey = getRepeatableSectionKey(def);

  let snapshot = { ...(template as unknown as Record<string, unknown>) };

  const hasDataset =
    dataInputMode !== "template_only" &&
    dataInputMode !== "master_data" &&
    (dataset.rows.length > 0 || inputSchema.columnMappings.length > 0);

  if (hasDataset) {
    const enrichedSchema: InputSchema = {
      ...inputSchema,
      sectionKey,
      templateFieldBindings: buildTemplateFieldBindings(def, inputSchema),
    };
    const withReference = applyReferenceRolesFromCsv(template, enrichedSchema);
    snapshot = {
      ...withReference,
      field_definitions: withReference.field_definitions,
    } as Record<string, unknown>;
    snapshot = mergeInputSchemaIntoSnapshot(snapshot, enrichedSchema, dataset);
  }

  return snapshot;
}

export function detectStoreColumnMapping(inputSchema: InputSchema): ColumnMapping | undefined {
  return inputSchema.columnMappings.find(
    (m) =>
      m.aislixMapping === "store" ||
      ["store", "store_name", "outlet", "location"].includes(normalizeLabel(m.columnName)),
  );
}

function rowStoreValue(row: AuditInputDataset["rows"][0], mapping: ColumnMapping): string {
  return (row.values[mapping.columnId] ?? "").trim();
}

/** Filter CSV rows to a single store when a Store column is mapped. */
export function filterDatasetForStore(
  dataset: AuditInputDataset,
  inputSchema: InputSchema,
  storeId: string,
  storeName?: string,
): AuditInputDataset {
  const storeColumn = detectStoreColumnMapping(inputSchema);
  if (!storeColumn) return dataset;

  const aliases = new Set(
    [storeName, storeId].filter(Boolean).map((v) => normalizeLabel(String(v))),
  );

  const rows = dataset.rows.filter((row) => {
    const cell = normalizeLabel(rowStoreValue(row, storeColumn));
    if (!cell) return true;
    return aliases.has(cell) || cell.includes(normalizeLabel(storeName ?? storeId));
  });

  return rows.length ? { ...dataset, rows } : dataset;
}

export function buildCsvTemplateDownload(
  def: TemplateDefinition,
  templateName: string,
): { filename: string; content: string } {
  const headers: string[] = [];
  const hints: string[] = [];

  for (const field of def.fields) {
    if (field.system) continue;
    const role = field.fieldRole ?? inferRoleFromField(field);
    const tag =
      role === "reference"
        ? "REFERENCE"
        : role === "calculated"
          ? "CALCULATED"
          : role === "evidence"
            ? "EVIDENCE"
            : "AUDITOR";
    headers.push(field.label);
    hints.push(tag);
  }

  const lines = [
    `# ${templateName} — CSV template`,
    `# REFERENCE = manager prefills; AUDITOR = filled during execution; CALCULATED = auto-computed`,
    headers.join(","),
    hints.join(","),
    headers.map(() => "").join(","),
  ];

  return {
    filename: `${templateName.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_template.csv`,
    content: lines.join("\n"),
  };
}

export function downloadCsvTemplateBlob(def: TemplateDefinition, templateName: string): void {
  const { filename, content } = buildCsvTemplateDownload(def, templateName);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
