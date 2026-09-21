/**
 * Conditional logic and rules engine for custom audits.
 */

import type { AuditResponseValue, FieldValues, RuleCondition, TemplateField, TemplateRule } from "./types";

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export function evaluateCondition(condition: RuleCondition, values: FieldValues): boolean {
  const raw = values[condition.field];
  const val = raw as AuditResponseValue;

  switch (condition.operator) {
    case "eq":
      return String(val ?? "") === String(condition.value ?? "");
    case "neq":
      return String(val ?? "") !== String(condition.value ?? "");
    case "gt":
      return Number(val) > Number(condition.value);
    case "gte":
      return Number(val) >= Number(condition.value);
    case "lt":
      return Number(val) < Number(condition.value);
    case "lte":
      return Number(val) <= Number(condition.value);
    case "is_empty":
      return val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0);
    case "is_not_empty":
      return !(val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0));
    case "before_today": {
      const d = parseDate(val);
      if (!d) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return d < today;
    }
    case "within_days": {
      const d = parseDate(val);
      if (!d) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const days = daysBetween(d, today);
      return days >= 0 && days <= Number(condition.value ?? 0);
    }
    default:
      return false;
  }
}

export function getEffectiveRequiredFields(
  fields: TemplateField[],
  rules: TemplateRule[],
  values: FieldValues,
): Set<string> {
  const required = new Set<string>();

  for (const rule of rules) {
    if (!evaluateCondition(rule.when, values)) continue;
    for (const action of rule.then) {
      if (action.action === "require_field") {
        required.add(action.field);
        // Published templates may use shortened keys (e.g. severity) while rules
        // reference the canonical type name (defect_severity).
        for (const field of fields) {
          if (field.key === action.field || field.type === action.field) {
            required.add(field.key);
          }
        }
      }
    }
  }

  return required;
}

export function getMinImagesFromRules(
  rules: TemplateRule[],
  values: FieldValues,
  fieldKey: string,
  baseMin: number,
): number {
  let min = baseMin;
  for (const rule of rules) {
    if (!evaluateCondition(rule.when, values)) continue;
    for (const action of rule.then) {
      if (action.action === "min_images" && action.field === fieldKey) {
        min = Math.max(min, action.value);
      }
    }
  }
  return min;
}

export function isFieldVisible(field: TemplateField, values: FieldValues): boolean {
  if (!field.visibleWhen) return true;
  if (field.visibleWhen.equals !== undefined) {
    return evaluateCondition(
      { field: field.visibleWhen.field, operator: "eq", value: field.visibleWhen.equals },
      values,
    );
  }
  if (field.visibleWhen.notEquals !== undefined) {
    return evaluateCondition(
      { field: field.visibleWhen.field, operator: "neq", value: field.visibleWhen.notEquals },
      values,
    );
  }
  if (field.visibleWhen.in) {
    return field.visibleWhen.in.some((v) =>
      evaluateCondition({ field: field.visibleWhen!.field, operator: "eq", value: v }, values),
    );
  }
  return true;
}

export function ruleToPlainLanguage(rule: TemplateRule): string {
  return rule.label || `${rule.when.field} ${rule.when.operator} → actions`;
}
