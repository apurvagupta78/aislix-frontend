import {
  createAuditTemplate,
  definitionToPatch,
  fetchAuditTemplate,
  fetchAuditTemplates,
  publishAuditTemplate,
  updateAuditTemplate,
  type AuditTemplate,
} from "@/lib/audit-templates";
import type { OperatingModel } from "@/lib/audit-builder/types";
import { fetchHierarchyProfiles, seedHierarchyProfiles } from "@/lib/hierarchy";
import {
  getSystemTemplateSpec,
  STARTER_TEMPLATE_LIBRARY,
  type SystemTemplateSpec,
} from "@/lib/audit-engine/template-factory";

const profileIdByModel = new Map<OperatingModel, string>();

function specDedupeKey(spec: SystemTemplateSpec): string {
  return `${spec.operatingModel}:${spec.name}`;
}

function defaultHierarchyBindings(model: OperatingModel): Record<string, string> {
  switch (model) {
    case "warehouse":
      return { warehouse: "warehouse", zone: "zone", aisle: "aisle", rack: "rack", bin: "bin" };
    case "dark_store":
      return { dark_store: "dark_store", zone: "zone", shelf: "shelf", sku: "sku" };
    case "fmcg_distributor":
      return {
        region: "region",
        territory: "territory",
        distributor: "distributor",
        outlet: "outlet",
        sku: "sku",
      };
    case "supermarket":
      return { store: "store", department: "department", aisle: "aisle", shelf: "shelf" };
    default:
      return { store: "store", shelf: "shelf", sku: "sku" };
  }
}

async function ensureHierarchyProfiles(): Promise<void> {
  if (profileIdByModel.size > 0) return;
  try {
    await seedHierarchyProfiles();
  } catch {
    /* migration may already be applied */
  }
  const profiles = await fetchHierarchyProfiles();
  for (const model of [
    "local_store",
    "supermarket",
    "dark_store",
    "warehouse",
    "fmcg_distributor",
  ] as OperatingModel[]) {
    const match =
      profiles.find((p) => p.operating_model === model && p.is_default) ??
      profiles.find((p) => p.operating_model === model);
    if (match) profileIdByModel.set(model, match.id);
  }
}

async function hierarchyProfileIdFor(model: OperatingModel): Promise<string | null> {
  await ensureHierarchyProfiles();
  return profileIdByModel.get(model) ?? null;
}

function findSeededTemplate(
  templates: AuditTemplate[],
  spec: SystemTemplateSpec,
): AuditTemplate | undefined {
  return templates.find(
    (t) =>
      t.is_system_template &&
      (t.purpose_config?.systemTemplateKey === spec.key ||
        (t.operating_model === spec.operatingModel && t.name === spec.name)),
  );
}

async function createFromSpec(spec: SystemTemplateSpec): Promise<AuditTemplate> {
  const definition = spec.build();
  const patch = definitionToPatch(definition);
  const hierarchyProfileId = await hierarchyProfileIdFor(spec.operatingModel);

  const input = {
    name: spec.name,
    short_description: spec.shortDescription,
    description: spec.shortDescription,
    template_type: spec.templateType as AuditTemplate["template_type"],
    category: spec.category,
    operating_model: spec.operatingModel,
    audit_purpose: spec.purpose,
    subject_type: spec.subjectType,
    is_system_template: true,
    visibility: "organization" as const,
    evidence_required: Boolean(definition.evidence?.photoRequired),
    hierarchy_profile_id: hierarchyProfileId,
    hierarchy_bindings: defaultHierarchyBindings(spec.operatingModel),
    ...patch,
    purpose_config: {
      ...(patch.purpose_config ?? {}),
      systemTemplateKey: spec.key,
      recommended: spec.recommended ?? false,
      flagship: spec.flagship ?? false,
    },
  };

  const template = await createAuditTemplate(input);
  await publishAuditTemplate(template.id);
  return (await fetchAuditTemplate(template.id)) ?? template;
}

export async function seedSystemTemplatesForOrg(
  operatingModel?: OperatingModel,
): Promise<{ created: number; skipped: number; errors: string[] }> {
  await ensureHierarchyProfiles();

  const existing = await fetchAuditTemplates({ activeOnly: false });
  const existingKeys = new Set(
    existing.filter((t) => t.is_system_template).map((t) => `${t.operating_model}:${t.name}`),
  );

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  const specs = operatingModel
    ? STARTER_TEMPLATE_LIBRARY.filter((s) => s.operatingModel === operatingModel)
    : STARTER_TEMPLATE_LIBRARY;

  for (const spec of specs) {
    const dedupeKey = specDedupeKey(spec);
    if (existingKeys.has(dedupeKey)) {
      skipped += 1;
      continue;
    }

    try {
      await createFromSpec(spec);
      existingKeys.add(dedupeKey);
      created += 1;
    } catch (e) {
      errors.push(`${spec.key}: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  return { created, skipped, errors };
}

/** Ensure a single system template exists (seed-on-use for wizard). */
export async function ensureSystemTemplate(key: string): Promise<AuditTemplate | null> {
  const spec = getSystemTemplateSpec(key);
  if (!spec) return null;

  const existing = await fetchAuditTemplates({ activeOnly: false });
  const found = findSeededTemplate(existing, spec);
  if (found) {
    if (!found.purpose_config?.systemTemplateKey) {
      await updateAuditTemplate(found.id, {
        purpose_config: {
          ...(found.purpose_config ?? {}),
          systemTemplateKey: spec.key,
        },
      });
    }
    if (found.status !== "published") {
      await publishAuditTemplate(found.id);
      return (await fetchAuditTemplate(found.id)) ?? found;
    }
    return found;
  }

  return createFromSpec(spec);
}
