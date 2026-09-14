/**
 * Calculated field evaluation for custom audit templates.
 */

import type { FieldValues, TemplateDefinition } from "./types";

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeCalculatedValues(
  definition: TemplateDefinition,
  values: FieldValues,
): FieldValues {
  const result: FieldValues = {};

  for (const field of definition.fields) {
    if (!field.calculated) continue;
    result[field.key] = evaluateFormula(field.formula ?? field.key, values);
  }

  for (const calc of definition.calculatedFields) {
    result[calc.key] = evaluateFormula(calc.formula, { ...values, ...result });
  }

  return result;
}

function evaluateFormula(formula: string, values: FieldValues): number | null {
  const f = formula.trim().toLowerCase();

  if (f === "actual_qty - expected_qty" || f.includes("actual") && f.includes("expected") && f.includes("-")) {
    const actual = Number(values.actual_qty);
    const expected = Number(values.expected_qty);
    if (isNaN(actual) || isNaN(expected)) return null;
    return actual - expected;
  }

  if (f.includes("((actual") && f.includes("/ expected")) {
    const actual = Number(values.actual_qty);
    const expected = Number(values.expected_qty);
    if (isNaN(actual) || isNaN(expected) || expected === 0) return null;
    return Math.round(((actual - expected) / expected) * 10000) / 100;
  }

  if (f.includes("expiry") && f.includes("audit")) {
    const expiry = parseDate(values.expiry_date);
    const audit = parseDate(values.audit_date) ?? new Date();
    if (!expiry) return null;
    audit.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    return daysBetween(expiry, audit);
  }

  return null;
}

export function computeQualityScore(
  definition: TemplateDefinition,
  values: FieldValues,
): number | null {
  if (!definition.scoring.enabled) return null;
  const weights = definition.scoring.weights ?? [];
  if (!weights.length) return null;

  let total = 0;
  let max = 0;
  for (const w of weights) {
    max += w.weight;
    const val = values[w.field];
    if (w.field === "qc_status" && val === "Pass") total += w.weight;
    else if (w.field === "qc_status" && val === "Fail") total += 0;
    else if (typeof val === "number") total += Math.min(w.weight, val);
    else if (Array.isArray(val) && val.length > 0) total += w.weight;
    else if (val) total += w.weight * 0.5;
  }

  if (max === 0) return null;
  const score = Math.round((total / max) * (definition.scoring.maxScore ?? 100));
  return score;
}
