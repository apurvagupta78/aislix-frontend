import type { AuditInputDataset } from "@/lib/audit-input-dataset";
import type { AuditTemplate } from "@/lib/audit-templates";
import type { AuditDataInputMode } from "./audit-data-modes";
import type { InputSchema } from "./field-roles";
import type { AuditPurpose, OperatingModel } from "./types";

export function extractSavedInputSchema(template: AuditTemplate): InputSchema | null {
  const raw = template.purpose_config?.inputSchema as InputSchema | undefined;
  if (!raw?.columnMappings?.length) return null;
  return raw;
}

export function extractSavedInputDataset(template: AuditTemplate): AuditInputDataset | null {
  const dataset = template.purpose_config?.input_dataset as AuditInputDataset | undefined;
  return dataset ?? null;
}

export function templateHasSavedCsvConfig(template: AuditTemplate): boolean {
  return Boolean(extractSavedInputSchema(template));
}

export type SavedTemplateHydration = {
  operatingModel?: OperatingModel;
  auditPurpose?: AuditPurpose;
  method: "digital" | "ai";
  inputSchema?: InputSchema;
  dataset?: AuditInputDataset;
  dataInputMode?: AuditDataInputMode;
};

export function hydrateFromSavedTemplate(template: AuditTemplate): SavedTemplateHydration {
  const inputSchema = extractSavedInputSchema(template);
  const dataset = extractSavedInputDataset(template);
  const hasRows = (dataset?.rows.length ?? 0) > 0;

  return {
    operatingModel: template.operating_model ?? undefined,
    auditPurpose: template.audit_purpose ?? undefined,
    method: template.audit_mode === "ai" ? "ai" : "digital",
    inputSchema: inputSchema ?? undefined,
    dataset: dataset ?? undefined,
    dataInputMode: inputSchema
      ? hasRows
        ? "template_only"
        : "template_plus_csv"
      : undefined,
  };
}
