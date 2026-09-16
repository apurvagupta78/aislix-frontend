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
} from "@/lib/audit-templates";

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
  patch.purpose_config = mergeInputSchemaIntoSnapshot(
    (patch.purpose_config as Record<string, unknown>) ?? {},
    input.inputSchema,
    input.dataset,
  );

  const created = await createAuditTemplate(patch);
  if (input.publish) {
    await publishAuditTemplate(created.id);
  }
  return created;
}
