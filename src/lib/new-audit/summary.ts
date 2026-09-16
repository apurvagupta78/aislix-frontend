import type { InputSchema } from "@/lib/audit-builder/field-roles";
import { FIELD_ROLE_BADGE_LABELS } from "@/lib/audit-builder/ensure-field-roles";
import { inferRoleFromField, type FieldRole } from "@/lib/audit-builder/field-roles";
import { STANDARD_FIELD_OPTIONS } from "@/lib/audit-builder/input-schema";
import type { TemplateDefinition } from "@/lib/audit-builder/types";

export type CaptureMethod = "digital" | "ai" | "ai_assisted";

export type StartChoice = "template" | "csv" | "custom" | null;

export const CAPTURE_METHOD_OPTIONS: {
  value: CaptureMethod;
  title: string;
  description: string;
}[] = [
  {
    value: "digital",
    title: "Digital Audit",
    description: "Employee enters the results in Aislix.",
  },
  {
    value: "ai",
    title: "AI Audit",
    description: "AI analyzes photos and identifies products, quantities and issues.",
  },
  {
    value: "ai_assisted",
    title: "AI-Assisted Audit",
    description: "AI suggests results and the employee confirms them.",
  },
];

export const ROLE_PILL_CLASS: Record<FieldRole, string> = {
  reference: "bg-sky-100 text-sky-800 border-sky-200",
  auditor_input: "bg-status-good-soft text-status-good-strong border-status-good/30",
  calculated: "bg-status-info-soft text-status-info-strong border-status-info/30",
  system: "bg-slate-100 text-slate-700 border-slate-200",
  evidence: "bg-status-evidence-soft text-status-evidence-strong border-status-evidence/30",
  ai_suggested: "bg-status-info-soft text-status-info-strong border-status-info/30",
  human_confirmed: "bg-status-good-soft text-status-good-strong border-status-good/30",
};

export function mapCaptureMethodToAuditMode(method: CaptureMethod): "digital" | "ai" {
  return method === "digital" ? "digital" : "ai";
}

export function resolveAuditorFillItems(input: {
  inputSchema?: InputSchema;
  templateDefinition?: TemplateDefinition | null;
}): { label: string; role: FieldRole }[] {
  const items: { label: string; role: FieldRole }[] = [];
  const seen = new Set<string>();

  if (input.inputSchema?.columnMappings.length) {
    for (const mapping of input.inputSchema.columnMappings) {
      if (mapping.fieldRole === "reference" || mapping.fieldRole === "calculated") continue;
      const label =
        mapping.columnName ||
        FIELD_ROLE_BADGE_LABELS[mapping.fieldRole];
      const key = `${mapping.fieldRole}:${label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ label, role: mapping.fieldRole });
    }
    return items;
  }

  if (input.templateDefinition?.fields.length) {
    for (const field of input.templateDefinition.fields) {
      const role = field.fieldRole ?? inferRoleFromField(field);
      if (role === "reference" || role === "calculated" || role === "system") continue;
      const label = field.label || field.key;
      const key = `${role}:${label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ label, role });
    }
  }

  return items;
}

export function labelForStandardMapping(mapping: string): string {
  return STANDARD_FIELD_OPTIONS.find((o) => o.value === mapping)?.label ?? mapping;
}
