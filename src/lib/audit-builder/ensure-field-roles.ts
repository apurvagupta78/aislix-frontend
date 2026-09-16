import { inferRoleFromField, type FieldRole } from "./field-roles";
import type { TemplateDefinition, TemplateField } from "./types";

export const FIELD_ROLE_BADGE_LABELS: Record<FieldRole, string> = {
  reference: "REFERENCE",
  auditor_input: "AUDITOR INPUT",
  calculated: "CALCULATED",
  system: "SYSTEM",
  evidence: "EVIDENCE",
  ai_suggested: "AI SUGGESTED",
  human_confirmed: "HUMAN CONFIRMED",
};

/** Resolve the effective role for any template field. */
export function resolveFieldRole(field: TemplateField): FieldRole {
  return field.fieldRole ?? inferRoleFromField(field);
}

/** Roles that do not count toward auditor completion work. */
export function isNonExecutableFieldRole(role: FieldRole): boolean {
  return role === "reference" || role === "calculated" || role === "system";
}

/** Roles the auditor must actively complete when required. */
export function isExecutableFieldRole(role: FieldRole): boolean {
  return (
    role === "auditor_input" ||
    role === "evidence" ||
    role === "human_confirmed" ||
    role === "ai_suggested"
  );
}

/** Normalize legacy flags into explicit universal field roles. */
export function ensureFieldRole(field: TemplateField): TemplateField {
  const role = resolveFieldRole(field);
  const readOnly =
    role === "reference" ||
    role === "calculated" ||
    role === "system" ||
    field.config.readOnly === true;

  return {
    ...field,
    fieldRole: role,
    calculated: role === "calculated" || field.calculated === true,
    system: role === "system" || field.system === true,
    config: {
      ...field.config,
      readOnly: role === "reference" || role === "calculated" || role === "system" ? true : readOnly,
      ...(role === "evidence" && field.config.minImages == null ? { minImages: 1 } : {}),
      ...(role === "ai_suggested" && field.config.requireHumanConfirmation == null
        ? { requireHumanConfirmation: true }
        : {}),
    },
  };
}

export function ensureFieldRoles(fields: TemplateField[]): TemplateField[] {
  return fields.map(ensureFieldRole);
}

export function ensureDefinitionFieldRoles(definition: TemplateDefinition): TemplateDefinition {
  return {
    ...definition,
    fields: ensureFieldRoles(definition.fields),
  };
}

export type RequiredInputsSummary = {
  executableFieldCount: number;
  evidenceRequiredCount: number;
  aiConfirmationCount: number;
  fieldLabels: string[];
  evidenceLabels: string[];
  aiLabels: string[];
};

export function summarizeRequiredInputs(definition: TemplateDefinition): RequiredInputsSummary {
  const fields = ensureFieldRoles(definition.fields).filter((f) => !f.system);
  const executable = fields.filter((f) => {
    const role = resolveFieldRole(f);
    return isExecutableFieldRole(role) && f.required;
  });
  const evidence = fields.filter((f) => resolveFieldRole(f) === "evidence" && f.required);
  const ai = fields.filter((f) => {
    const role = resolveFieldRole(f);
    return (
      (role === "ai_suggested" || role === "human_confirmed") &&
      (f.required || f.config.requireHumanConfirmation)
    );
  });

  return {
    executableFieldCount: executable.length,
    evidenceRequiredCount: evidence.length,
    aiConfirmationCount: ai.length,
    fieldLabels: executable.map((f) => f.label),
    evidenceLabels: evidence.map((f) => f.label),
    aiLabels: ai.map((f) => f.label),
  };
}
