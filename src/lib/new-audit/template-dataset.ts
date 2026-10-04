import type { ColumnMapping } from "@/lib/audit-builder/field-roles";
import { resolveFieldRole } from "@/lib/audit-builder/ensure-field-roles";
import { getRepeatableSectionKey } from "@/lib/audit-builder/template-csv-merge";
import type { FieldType, TemplateDefinition, TemplateField } from "@/lib/audit-builder/types";
import type { AuditDataColumn, AuditDataType, AuditInputDataset } from "@/lib/audit-input-dataset";
import { digitalColumnMapping, type DigitalColumnRole } from "@/lib/new-audit/digital-columns";

/** Filled in by the audit itself (location step, auditor, device) — never a line column. */
const CONTEXT_TYPES = new Set<FieldType>([
  "store",
  "warehouse",
  "auditor",
  "manager",
  "gps",
  "audit_id",
  "timestamp",
  "audit_source",
  "audit_date",
]);

/** Line identity / expectation fields the manager normally supplies up front. */
const PROVIDED_TYPES = new Set<FieldType>([
  "sku_id",
  "item_code",
  "item_name",
  "brand",
  "category",
  "subcategory",
  "variant",
  "expected_qty",
  "sku_selector",
  "shelf",
  "rack",
  "bin",
]);
const PROVIDED_CONCEPTS = new Set(["expected_quantity", "expected_facing", "mrp", "product_name", "sku_id"]);

const NUMBER_TYPES = new Set<FieldType>([
  "expected_qty",
  "actual_qty",
  "qty_variance",
  "damaged_qty",
  "expired_qty",
  "temperature",
  "weight",
  "measurement",
  "custom_numeric",
  "quality_score",
  "number",
  "currency",
  "percentage",
]);
const DATE_TYPES = new Set<FieldType>(["mfg_date", "expiry_date", "best_before_date", "date"]);

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** True when the template repeats per line (SKU, shelf, unit…) rather than being a one-off checklist. */
const TEMPLATE_COLUMN_PREFIX = "tpl-";

/** Columns that come from the template keep their name; columns the manager added can be edited. */
export function isTemplateColumn(columnId: string): boolean {
  return columnId.startsWith(TEMPLATE_COLUMN_PREFIX);
}

export function templateHasLines(def: TemplateDefinition): boolean {
  return def.sections.some((s) => s.repeatable);
}

/** Fields shown as columns in the template lines table, in template order. */
export function templateLineFields(def: TemplateDefinition): TemplateField[] {
  const sectionKey = getRepeatableSectionKey(def);
  const seen = new Set<string>();
  return def.fields
    .filter((f) => f.section === sectionKey && !CONTEXT_TYPES.has(f.type))
    .filter((f) => {
      const role = resolveFieldRole(f);
      return role !== "system" && role !== "calculated" && role !== "evidence";
    })
    .sort((a, b) => a.order - b.order)
    .filter((f) => {
      const name = normalize(f.label);
      if (!name || seen.has(name)) return false;
      seen.add(name);
      return true;
    });
}

export function defaultRoleForField(field: TemplateField): DigitalColumnRole {
  if (field.fieldRole === "reference" || field.config.readOnly) return "reference";
  if (PROVIDED_TYPES.has(field.type)) return "reference";
  if (field.standardConcept && PROVIDED_CONCEPTS.has(String(field.standardConcept))) return "reference";
  return "auditor_input";
}

function dataTypeFor(field: TemplateField): AuditDataType {
  if (NUMBER_TYPES.has(field.type)) return "number";
  if (DATE_TYPES.has(field.type)) return "date";
  return "text";
}

/**
 * Empty lines table built from a template's line fields. Column names equal field labels so
 * `buildMergedTemplateSnapshot` binds every column back to its template field.
 */
export function buildTemplateDataset(
  def: TemplateDefinition,
  templateName: string,
): { dataset: AuditInputDataset; mappings: ColumnMapping[] } {
  const fields = templateLineFields(def);
  const columns: AuditDataColumn[] = fields.map((f) => ({
    id: `${TEMPLATE_COLUMN_PREFIX}${crypto.randomUUID()}`,
    name: f.label.trim(),
    type: dataTypeFor(f),
  }));
  const roles = fields.map(defaultRoleForField);
  const expectedIdx = fields.findIndex(
    (f, i) => roles[i] === "reference" && (f.type === "expected_qty" || f.standardConcept === "expected_quantity"),
  );
  const mappings = columns.map((column, i) => {
    const field = fields[i]!;
    const pairsWithExpected =
      expectedIdx >= 0 && (field.type === "actual_qty" || field.standardConcept === "actual_quantity");
    return digitalColumnMapping(column, roles[i]!, pairsWithExpected ? columns[expectedIdx]!.id : undefined);
  });
  return {
    dataset: { source: "csv", filename: templateName, columns, rows: [] },
    mappings,
  };
}

/**
 * Copy rows from an uploaded file into the template columns, matching headers by name.
 * File columns the template doesn't have are kept as extra columns after the template ones.
 */
export function fillTemplateDataset(
  template: AuditInputDataset,
  file: AuditInputDataset,
): { dataset: AuditInputDataset; matched: string[]; added: string[] } {
  const byName = new Map(template.columns.map((c) => [normalize(c.name), c]));
  const sourceFor = new Map<string, string>();
  const matched: string[] = [];
  const extra: AuditDataColumn[] = [];
  for (const column of file.columns) {
    const name = normalize(column.name);
    const target = byName.get(name);
    if (target && !sourceFor.has(target.id)) {
      sourceFor.set(target.id, column.id);
      matched.push(target.name);
    } else if (name && !byName.has(name)) {
      const added = { id: column.id, name: column.name.trim(), type: column.type };
      byName.set(name, added);
      extra.push(added);
      sourceFor.set(added.id, column.id);
    }
  }
  const columns = [...template.columns, ...extra];
  const rows = file.rows
    .map((row) => ({
      id: crypto.randomUUID(),
      values: Object.fromEntries(
        columns.map((c) => {
          const from = sourceFor.get(c.id);
          return [c.id, from ? (row.values[from] ?? "").trim() : ""];
        }),
      ),
    }))
    .filter((row) => Object.values(row.values).some((v) => v));
  return { dataset: { ...template, columns, rows }, matched, added: extra.map((c) => c.name) };
}
