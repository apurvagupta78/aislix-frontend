import type { AuditInputDataset } from "@/lib/audit-input-dataset";
import type { AuditSubjectType, StandardFieldConcept, TemplateDefinition, TemplateField } from "./types";
import {
  defaultAuditorFills,
  inferColumnRole,
  mappingToTemplateFieldKey,
  type ColumnMapping,
  type InputSchema,
} from "./field-roles";
import { field, resetFieldCounter, sec } from "@/lib/audit-engine/template-factory/helpers";
import { assembleTemplate } from "@/lib/audit-engine/template-factory/helpers";
import { ensureFieldRoles } from "./ensure-field-roles";

export const STANDARD_FIELD_OPTIONS: Array<{ value: StandardFieldConcept | "custom"; label: string }> = [
  { value: "sku_id", label: "SKU ID" },
  { value: "product_name", label: "Product Name" },
  { value: "expected_quantity", label: "Expected Quantity" },
  { value: "actual_quantity", label: "Actual Quantity" },
  { value: "variance_units", label: "Quantity Variance" },
  { value: "variance_percent", label: "Variance %" },
  { value: "mrp", label: "MRP" },
  { value: "potential_value_variance", label: "Potential Value Variance" },
  { value: "expiry_date", label: "Expiry Date" },
  { value: "days_remaining", label: "Days Remaining" },
  { value: "expected_facing", label: "Expected Facing" },
  { value: "actual_facing", label: "Actual Facing" },
  { value: "facing_compliance", label: "Facing Compliance" },
  { value: "planogram_compliance", label: "Planogram Compliance" },
  { value: "qc_status", label: "QC Status" },
  { value: "oos", label: "Out of Stock" },
  { value: "stacking_compliance", label: "Stacking Compliance" },
  { value: "visible_unit_compliance", label: "Visible Unit Compliance" },
  { value: "placement_compliance", label: "Placement Compliance" },
  { value: "custom", label: "Custom (no standard mapping)" },
];

export function buildDefaultColumnMappings(dataset: AuditInputDataset): ColumnMapping[] {
  return dataset.columns.map((col) => {
    const inferred = inferColumnRole(col.name);
    const role = inferred.role;
    return {
      columnId: col.id,
      columnName: col.name,
      dataType: col.type,
      fieldRole: role,
      aislixMapping: inferred.mapping,
      auditorFills: defaultAuditorFills(role),
      required: role === "reference" || role === "auditor_input",
      evidenceRequired: false,
      autoSuggested: true,
      aiEnabled: inferred.mapping === "expiry_date",
    };
  });
}

export function buildInputSchema(
  dataset: AuditInputDataset,
  subjectType: AuditSubjectType = "sku",
  columnMappings?: ColumnMapping[],
): InputSchema {
  return {
    subjectType,
    columnMappings: columnMappings ?? buildDefaultColumnMappings(dataset),
    preserveAllColumns: true,
  };
}

function dataTypeToFieldType(dataType: ColumnMapping["dataType"], role: ColumnMapping["fieldRole"]): TemplateField["type"] {
  if (role === "evidence") return "multiple_images";
  switch (dataType) {
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "yes_no";
    case "date":
      return "expiry_date";
    case "datetime":
      return "datetime";
    default:
      return "short_text";
  }
}

/** Build a runtime template definition from CSV column configuration. */
export function buildTemplateFromInputSchema(
  inputSchema: InputSchema,
  dataset: AuditInputDataset,
  opts: { name: string; operatingModel: TemplateDefinition["operatingModel"] },
): TemplateDefinition {
  resetFieldCounter();
  const sectionKey = "records";
  const fields: TemplateField[] = inputSchema.columnMappings.map((mapping, order) => {
    const key =
      mapping.aislixMapping !== "custom"
        ? mappingToTemplateFieldKey(mapping.aislixMapping) || mapping.columnName.toLowerCase().replace(/\s+/g, "_")
        : mapping.columnName.toLowerCase().replace(/\s+/g, "_");

    const isCalculated = mapping.fieldRole === "calculated";
    const isReference = mapping.fieldRole === "reference";
    const isSystem = mapping.fieldRole === "system";

    return field(sectionKey, order, dataTypeToFieldType(mapping.dataType, mapping.fieldRole), mapping.columnName, {
      key,
      required: mapping.required,
      fieldRole: mapping.fieldRole,
      calculated: isCalculated,
      system: isSystem,
      standardConcept: mapping.aislixMapping !== "custom" ? mapping.aislixMapping : undefined,
      config: {
        readOnly: isReference || isCalculated || isSystem,
        ...(mapping.evidenceRequired ? { minImages: 1, cameraRequired: true } : {}),
      },
    });
  });

  return assembleTemplate({
    sections: [sec(sectionKey, "Audit Records", 0, { repeatable: true, repeatBy: inputSchema.subjectType })],
    fields: ensureFieldRoles(fields),
    auditLevel: inputSchema.subjectType === "store" ? "one_per_audit" : `one_per_${inputSchema.subjectType}` as TemplateDefinition["auditLevel"],
    operatingModel: opts.operatingModel,
    purpose: "custom",
    subjectType: inputSchema.subjectType,
  });
}

function resolveFieldKey(
  mapping: ColumnMapping,
  inputSchema: InputSchema,
): string {
  const binding = inputSchema.templateFieldBindings?.find((b) => b.columnId === mapping.columnId);
  if (binding?.templateFieldKey) return binding.templateFieldKey;
  if (mapping.aislixMapping !== "custom") {
    return (
      mappingToTemplateFieldKey(mapping.aislixMapping) ||
      mapping.columnName.toLowerCase().replace(/\s+/g, "_")
    );
  }
  return mapping.columnName.toLowerCase().replace(/\s+/g, "_");
}

/** Pre-fill manager CSV values into response map (reference + optional auditor pre-fill). */
export function hydrateReferenceValuesFromDataset(
  inputSchema: InputSchema,
  dataset: AuditInputDataset,
  sectionKey = "records",
): Record<string, Record<number, Record<string, unknown>>> {
  const targetSection = inputSchema.sectionKey ?? sectionKey;
  const responses: Record<string, Record<number, Record<string, unknown>>> = {
    [targetSection]: {},
  };

  dataset.rows.forEach((row, recordIndex) => {
    const record: Record<string, unknown> = {};
    for (const mapping of inputSchema.columnMappings) {
      const raw = row.values[mapping.columnId]?.trim() ?? "";
      if (!raw) continue;

      const key = resolveFieldKey(mapping, inputSchema);

      if (
        mapping.fieldRole === "reference" ||
        mapping.fieldRole === "system" ||
        mapping.fieldRole === "auditor_input"
      ) {
        record[key] = raw;
      }
    }
    responses[targetSection]![recordIndex] = record;
  });

  return responses;
}

export function mergeInputSchemaIntoSnapshot(
  snapshot: Record<string, unknown>,
  inputSchema: InputSchema,
  dataset: AuditInputDataset,
): Record<string, unknown> {
  return {
    ...snapshot,
    purpose_config: {
      ...((snapshot.purpose_config as Record<string, unknown>) ?? {}),
      inputSchema,
      input_dataset: dataset,
    },
  };
}
