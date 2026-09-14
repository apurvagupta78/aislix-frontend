/**
 * Validation and completion engine for custom audit templates.
 */

import type {
  AuditResponseValue,
  CompletionItem,
  CompletionResult,
  FieldConfig,
  TemplateDefinition,
  TemplateField,
  TemplateRule,
} from "./types";
import { evaluateCondition, getEffectiveRequiredFields } from "./rules-engine";
import { computeCalculatedValues } from "./calculated-fields";
import { isImageField } from "./field-library";

export type FieldValues = Record<string, AuditResponseValue>;

export type RecordContext = {
  sectionKey: string;
  recordIndex: number;
  values: FieldValues;
};

function isEmpty(value: AuditResponseValue): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function validateFieldConfig(
  field: TemplateField,
  value: AuditResponseValue,
  config: FieldConfig,
): string | null {
  if (isEmpty(value)) return null;

  if (typeof value === "number" || (typeof value === "string" && !isNaN(Number(value)))) {
    const num = Number(value);
    if (config.min !== undefined && num < config.min) {
      return `${field.label} cannot be less than ${config.min}`;
    }
    if (config.max !== undefined && num > config.max) {
      return `${field.label} cannot exceed ${config.max}`;
    }
  }

  if (typeof value === "string") {
    if (config.minLength !== undefined && value.length < config.minLength) {
      return `${field.label} must be at least ${config.minLength} characters`;
    }
    if (config.maxLength !== undefined && value.length > config.maxLength) {
      return `${field.label} must be at most ${config.maxLength} characters`;
    }
    if (config.pattern) {
      try {
        if (!new RegExp(config.pattern).test(value)) {
          return `${field.label} format is invalid`;
        }
      } catch {
        /* ignore bad pattern */
      }
    }
  }

  if (isImageField(field.type)) {
    const images = Array.isArray(value) ? value : value ? [value] : [];
    if (config.minImages !== undefined && images.length < config.minImages) {
      return `${field.label} requires at least ${config.minImages} image(s)`;
    }
    if (config.maxImages !== undefined && images.length > config.maxImages) {
      return `${field.label} allows at most ${config.maxImages} image(s)`;
    }
  }

  return null;
}

export function validateCrossFieldRules(
  fields: TemplateField[],
  values: FieldValues,
): string[] {
  const errors: string[] = [];
  const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));

  const mfg = values.mfg_date ?? values.mfg_date;
  const expiry = values.expiry_date;
  if (mfg && expiry && String(expiry) < String(mfg)) {
    errors.push("Expiry Date cannot be before Manufacturing Date");
  }

  const expected = Number(values.expected_qty);
  const actual = Number(values.actual_qty);
  if (!isNaN(expected) && !isNaN(actual) && actual < 0) {
    errors.push("Actual Qty cannot be negative");
  }

  const variance = values.qty_variance ?? (actual - expected);
  if (
    byKey.rca &&
    !isEmpty(variance as AuditResponseValue) &&
    Number(variance) !== 0 &&
    isEmpty(values.rca as AuditResponseValue)
  ) {
    /* handled by conditional required */
  }

  return errors;
}

export function computeCompletion(
  definition: TemplateDefinition,
  records: RecordContext[],
): CompletionResult {
  const missing: CompletionItem[] = [];
  let totalRequired = 0;
  let filledRequired = 0;

  const repeatableSections = new Set(
    definition.sections.filter((s) => s.repeatable).map((s) => s.key),
  );

  for (const section of definition.sections) {
    const sectionFields = definition.fields
      .filter((f) => f.section === section.key && !f.system && !f.calculated)
      .sort((a, b) => a.order - b.order);

    const sectionRecords = records.filter((r) => r.sectionKey === section.key);
    const recordList =
      sectionRecords.length > 0
        ? sectionRecords
        : repeatableSections.has(section.key)
          ? [{ sectionKey: section.key, recordIndex: 0, values: {} }]
          : [{ sectionKey: section.key, recordIndex: 0, values: {} }];

    for (const rec of recordList) {
      const computed = computeCalculatedValues(definition, rec.values);
      const allValues = { ...rec.values, ...computed };
      const effectiveRequired = getEffectiveRequiredFields(
        definition.fields,
        definition.rules,
        allValues,
      );

      for (const field of sectionFields) {
        if (field.visibleWhen) {
          const visible = evaluateCondition(
            { field: field.visibleWhen.field, operator: "eq", value: field.visibleWhen.equals },
            allValues,
          );
          if (!visible) continue;
        }

        const isRequired = field.required || effectiveRequired.has(field.key);
        if (!isRequired) continue;

        totalRequired += 1;
        const val = allValues[field.key];
        if (isEmpty(val as AuditResponseValue)) {
          missing.push({
            sectionKey: rec.sectionKey,
            recordIndex: rec.recordIndex,
            fieldKey: field.key,
            label: `${field.label}${recordList.length > 1 ? ` — record ${rec.recordIndex + 1}` : ""}`,
          });
        } else {
          filledRequired += 1;
        }
      }
    }
  }

  const percent =
    totalRequired === 0 ? 100 : Math.round((filledRequired / totalRequired) * 100);

  return {
    percent,
    complete: missing.length === 0,
    missing,
  };
}

export function validateRecord(
  definition: TemplateDefinition,
  record: RecordContext,
): string[] {
  const errors: string[] = [];
  const computed = computeCalculatedValues(definition, record.values);
  const allValues = { ...record.values, ...computed };
  const effectiveRequired = getEffectiveRequiredFields(
    definition.fields,
    definition.rules,
    allValues,
  );

  for (const field of definition.fields) {
    if (field.section !== record.sectionKey) continue;
    if (field.calculated || field.system) continue;

    if (field.visibleWhen) {
      const visible = evaluateCondition(
        { field: field.visibleWhen.field, operator: "eq", value: field.visibleWhen.equals },
        allValues,
      );
      if (!visible) continue;
    }

    const val = allValues[field.key] as AuditResponseValue;
    const isRequired = field.required || effectiveRequired.has(field.key);

    if (isRequired && isEmpty(val)) {
      errors.push(`${field.label} is required`);
      continue;
    }

    const configErr = validateFieldConfig(field, val, field.config);
    if (configErr) errors.push(configErr);
  }

  errors.push(...validateCrossFieldRules(definition.fields, allValues));
  return errors;
}

export function summarizePublish(definition: TemplateDefinition): {
  fieldCount: number;
  requiredCount: number;
  ruleCount: number;
  evidenceCount: number;
  aiFeatureCount: number;
} {
  const requiredCount = definition.fields.filter((f) => f.required).length;
  const evidenceCount = definition.fields.filter((f) => isImageField(f.type)).length;
  const aiFeatureCount = Object.values(definition.ai.features ?? {}).filter(
    (f) => f.enabled,
  ).length;

  return {
    fieldCount: definition.fields.length,
    requiredCount,
    ruleCount: definition.rules.length,
    evidenceCount,
    aiFeatureCount,
  };
}

export function applyRuleActions(
  rules: TemplateRule[],
  values: FieldValues,
): { findings: { findingType: string; severity: string }[] } {
  const findings: { findingType: string; severity: string }[] = [];

  for (const rule of rules) {
    if (!evaluateCondition(rule.when, values)) continue;
    for (const action of rule.then) {
      if (action.action === "create_finding") {
        findings.push({
          findingType: action.findingType,
          severity: action.severity,
        });
      }
    }
  }

  return { findings };
}
