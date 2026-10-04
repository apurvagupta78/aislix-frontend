/**
 * Persist CSV column configuration as a reusable customer audit template.
 */

import type { AuditInputDataset } from "@/lib/audit-input-dataset";
import type { CalculatedFieldDef, OperatingModel } from "./types";
import type { InputSchema } from "./field-roles";
import {
  buildTemplateFromInputSchema,
  mergeInputSchemaIntoSnapshot,
} from "./input-schema";
import {
  createAuditTemplate,
  definitionToPatch,
  publishAuditTemplate,
  type AuditTemplate,
  type AuditTemplateInput,
} from "@/lib/audit-templates";
import {
  buildDigitalTemplateDefinition,
  DIGITAL_CSV_TEMPLATE_SOURCE,
  type DigitalRowEvidence,
} from "@/lib/new-audit/digital-columns";

function buildCalculatedFields(inputSchema: InputSchema): CalculatedFieldDef[] {
  const concepts = new Set(
    inputSchema.columnMappings.map((m) => m.aislixMapping).filter((m) => m !== "custom"),
  );
  const calculated: CalculatedFieldDef[] = [];
  if (concepts.has("expected_quantity") && concepts.has("actual_quantity")) {
    calculated.push({
      key: "variance_units",
      label: "Variance (units)",
      formula: "actual_quantity - expected_quantity",
    });
    calculated.push({
      key: "variance_percent",
      label: "Variance %",
      formula:
        "expected_quantity != 0 ? ((actual_quantity - expected_quantity) / expected_quantity) * 100 : 0",
    });
  }
  if (concepts.has("expiry_date")) {
    calculated.push({
      key: "days_remaining",
      label: "Days Remaining",
      formula: "days_until(expiry_date)",
    });
  }
  return calculated;
}

export async function saveCustomCsvAsTemplate(input: {
  name: string;
  inputSchema: InputSchema;
  dataset: AuditInputDataset;
  operatingModel: OperatingModel;
  publish?: boolean;
}): Promise<AuditTemplate> {
  const def = buildTemplateFromInputSchema(input.inputSchema, input.dataset, {
    name: input.name.trim(),
    operatingModel: input.operatingModel,
  });
  def.calculatedFields = buildCalculatedFields(input.inputSchema);

  const patch = definitionToPatch(def);
  patch.name = input.name.trim();
  patch.template_type = "custom";
  patch.visibility = "private";
  patch.purpose_config = mergeInputSchemaIntoSnapshot(patch, input.inputSchema, input.dataset)
    .purpose_config as Record<string, unknown>;

  const created = await createAuditTemplate(patch);
  if (input.publish) {
    await publishAuditTemplate(created.id);
  }
  return created;
}

/**
 * Digital Audit file upload: one private template per audit so assignments, responses and
 * scans can reference it. Hidden from template lists via purpose_config.source.
 */
export async function createDigitalCsvAuditTemplate(input: {
  name: string;
  inputSchema: InputSchema;
  dataset: AuditInputDataset;
  operatingModel: OperatingModel;
  rowEvidence?: DigitalRowEvidence;
  shelfColumnId?: string | null;
  barcodeColumnId?: string | null;
}): Promise<AuditTemplate> {
  const rowEvidence = input.rowEvidence ?? "optional";
  const def = buildDigitalTemplateDefinition(input.inputSchema, input.dataset, {
    name: input.name.trim(),
    operatingModel: input.operatingModel,
    rowEvidence,
  });
  const patch = definitionToPatch(def);
  patch.name = input.name.trim();
  patch.template_type = "custom";
  patch.audit_mode = "digital";
  patch.visibility = "private";
  patch.evidence_required = false;
  patch.purpose_config = {
    ...((patch.purpose_config as Record<string, unknown>) ?? {}),
    source: DIGITAL_CSV_TEMPLATE_SOURCE,
    inputSchema: input.inputSchema,
    input_dataset: input.dataset,
    rowEvidence,
    ...(input.shelfColumnId ? { shelfColumnId: input.shelfColumnId } : {}),
    ...(input.barcodeColumnId ? { barcodeColumnId: input.barcodeColumnId } : {}),
  };
  return createAuditTemplate(patch as AuditTemplateInput);
}
