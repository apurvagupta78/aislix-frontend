import type { AuditDataType } from "@/lib/audit-input-dataset";
import type { AuditSubjectType, StandardFieldConcept, TemplateField } from "./types";

/** Who provides / how a field is populated during audit execution. */
export type FieldRole =
  | "reference"
  | "auditor_input"
  | "calculated"
  | "system"
  | "evidence"
  | "ai_suggested"
  | "human_confirmed";

export const FIELD_ROLE_LABELS: Record<FieldRole, string> = {
  reference: "Reference / Manager Provided",
  auditor_input: "Auditor Input",
  calculated: "Calculated",
  system: "System Generated",
  evidence: "Evidence",
  ai_suggested: "AI Suggested",
  human_confirmed: "Human Confirmed",
};

export type ColumnMapping = {
  columnId: string;
  columnName: string;
  dataType: AuditDataType;
  fieldRole: FieldRole;
  /** Maps to StandardFieldConcept or custom field key */
  aislixMapping: StandardFieldConcept | string | "custom";
  auditorFills: boolean;
  required: boolean;
  evidenceRequired: boolean;
  /** True when role/mapping was inferred from header — manager should confirm */
  autoSuggested?: boolean;
  /** Optional AI assist (e.g. OCR on expiry) during execution */
  aiEnabled?: boolean;
};

export type TemplateFieldBinding = {
  columnId: string;
  templateFieldKey: string;
  standardConcept?: string;
};

export type InputSchema = {
  subjectType: AuditSubjectType;
  columnMappings: ColumnMapping[];
  /** Preserve raw CSV columns even when unmapped */
  preserveAllColumns: boolean;
  /** Repeatable section key from the selected template */
  sectionKey?: string;
  templateFieldBindings?: TemplateFieldBinding[];
};

export function defaultAuditorFills(role: FieldRole): boolean {
  return role === "auditor_input" || role === "human_confirmed";
}

export function isFieldReadOnlyForAuditor(field: TemplateField): boolean {
  const role = field.fieldRole ?? inferRoleFromField(field);
  return (
    role === "reference" ||
    role === "calculated" ||
    role === "system" ||
    field.config.readOnly === true ||
    field.calculated === true ||
    field.system === true
  );
}

export function inferRoleFromField(field: TemplateField): FieldRole {
  if (field.system) return "system";
  if (field.calculated) return "calculated";
  if (field.type.includes("image") || field.type === "video" || field.type === "document") {
    return "evidence";
  }
  if (field.config.aiFeature || field.config.requireHumanConfirmation) {
    return field.config.requireHumanConfirmation ? "human_confirmed" : "ai_suggested";
  }
  if (field.config.readOnly || field.masterDataSource) return "reference";
  return "auditor_input";
}

/** Infer field role from CSV column header heuristics. */
export function inferColumnRole(columnName: string): {
  role: FieldRole;
  mapping: StandardFieldConcept | string;
} {
  const n = columnName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");

  const reference: Record<string, StandardFieldConcept | string> = {
    sku: "sku_id",
    sku_id: "sku_id",
    item_code: "sku_id",
    barcode: "sku_id",
    product: "product_name",
    product_name: "product_name",
    item_name: "product_name",
    expected: "expected_quantity",
    expected_qty: "expected_quantity",
    expected_quantity: "expected_quantity",
    mrp: "mrp",
    planogram_position: "planogram_compliance",
    expected_facing: "expected_facing",
    batch: "custom",
    target_temperature: "custom",
    store: "store",
    store_name: "store",
    outlet: "outlet",
    location: "custom",
  };

  const auditor: Record<string, StandardFieldConcept | string> = {
    actual: "actual_quantity",
    actual_qty: "actual_quantity",
    actual_quantity: "actual_quantity",
    actual_facing: "actual_facing",
    expiry: "expiry_date",
    expiry_date: "expiry_date",
    qc_status: "qc_status",
    remarks: "custom",
    notes: "custom",
    condition: "custom",
    displayed_price: "price_compliance",
  };

  const calculated: Record<string, StandardFieldConcept | string> = {
    variance: "variance_units",
    variance_pct: "variance_percent",
    variance_percent: "variance_percent",
    days_remaining: "days_remaining",
  };

  if (reference[n]) return { role: "reference", mapping: reference[n]! };
  if (auditor[n]) return { role: "auditor_input", mapping: auditor[n]! };
  if (calculated[n]) return { role: "calculated", mapping: calculated[n]! };

  return { role: "auditor_input", mapping: "custom" };
}

export function mappingToTemplateFieldKey(mapping: StandardFieldConcept | string): string {
  if (mapping === "custom") return "";
  const map: Partial<Record<StandardFieldConcept, string>> = {
    sku_id: "sku_id",
    product_name: "item_name",
    expected_quantity: "expected_qty",
    actual_quantity: "actual_qty",
    variance_units: "qty_variance",
    variance_percent: "qty_variance_pct",
    mrp: "mrp",
    expiry_date: "expiry_date",
    days_remaining: "expiry_days_remaining",
    expected_facing: "expected_facing",
    actual_facing: "actual_facing",
    qc_status: "qc_status",
    oos: "oos",
  };
  return map[mapping as StandardFieldConcept] ?? String(mapping);
}
