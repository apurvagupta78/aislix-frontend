/**
 * Resolves applicable KPIs from template field concepts — Universal, Operating Model, Audit-Specific.
 */

import type { OperatingModel, StandardFieldConcept, TemplateDefinition } from "@/lib/audit-builder/types";
import type { ControlTowerModelFilter } from "@/lib/control-tower/types";
import { getTemplatesByOperatingModel, STARTER_TEMPLATE_LIBRARY } from "@/lib/audit-engine/template-factory";
import { KPI_CATALOG, type KpiDefinition } from "./definitions";

export type ResolvedKpiCatalog = {
  universal: KpiDefinition[];
  operatingModel: KpiDefinition[];
  auditSpecific: KpiDefinition[];
  /** Grouped by template name when multiple templates contribute audit-specific KPIs */
  auditSpecificGroups: { templateKey: string; templateName: string; kpis: KpiDefinition[] }[];
};

function templateConcepts(def: TemplateDefinition): Set<StandardFieldConcept | string> {
  const concepts = new Set<StandardFieldConcept | string>();
  for (const f of def.fields) {
    if (f.standardConcept) concepts.add(f.standardConcept);
    if (f.key) concepts.add(f.key);
  }
  return concepts;
}

function templatesForFilter(model: ControlTowerModelFilter) {
  if (model === "all") return STARTER_TEMPLATE_LIBRARY.map((s) => ({ key: s.key, name: s.name, purpose: s.purpose, def: s.build() }));
  return getTemplatesByOperatingModel(model).map((s) => ({ key: s.key, name: s.name, purpose: s.purpose, def: s.build() }));
}

function kpiAvailable(
  kpi: KpiDefinition,
  model: ControlTowerModelFilter,
  allConcepts: Set<string>,
  allPurposes: Set<string>,
): boolean {
  if (kpi.layer === "universal") return true;

  if (kpi.operatingModels?.length && model !== "all" && !kpi.operatingModels.includes(model as OperatingModel)) {
    return false;
  }

  if (kpi.requiredConcepts?.length) {
    if (!kpi.requiredConcepts.some((c) => allConcepts.has(c))) return false;
  }
  if (kpi.requiredPurposes?.length) {
    if (!kpi.requiredPurposes.some((p) => allPurposes.has(p))) return false;
  }

  if (kpi.layer === "operating_model" && !kpi.requiredConcepts?.length && !kpi.requiredPurposes?.length) {
    return Boolean(kpi.operatingModels?.includes(model as OperatingModel));
  }

  return true;
}

/** Derive audit-specific KPIs from standard field mappings in templates. */
function deriveAuditSpecificKpis(concepts: Set<string>): KpiDefinition[] {
  const derived: KpiDefinition[] = [];
  const seen = new Set<string>();

  const add = (id: string) => {
    if (seen.has(id)) return;
    const def = KPI_CATALOG.find((k) => k.id === id);
    if (def) {
      seen.add(id);
      derived.push(def);
    }
  };

  if (concepts.has("expected_quantity") && concepts.has("actual_quantity")) {
    add("inventory_accuracy");
  }
  if (concepts.has("expiry_date")) {
    add("expired_units");
    add("near_expiry_units");
    add("expiry_risk");
  }
  if (concepts.has("expected_facing") && concepts.has("actual_facing")) {
    add("facing_compliance");
  }
  if (concepts.has("stacking_compliance") || concepts.has("visible_unit_compliance")) {
    add("stacking_compliance");
    add("visible_unit_compliance");
  }
  if (concepts.has("qc_status")) {
    add("qc_pass_rate");
  }
  if (concepts.has("expected_quantity") && concepts.has("actual_quantity") && concepts.has("mrp")) {
    add("value_variance");
  }

  return derived.filter((k) => k.layer === "audit_specific" || k.id === "inventory_accuracy");
}

export function resolveKpiEngine(model: ControlTowerModelFilter): ResolvedKpiCatalog {
  const templates = templatesForFilter(model);
  const allConcepts = new Set<string>();
  const allPurposes = new Set<string>();
  for (const t of templates) {
    allPurposes.add(t.purpose);
    templateConcepts(t.def).forEach((c) => allConcepts.add(String(c)));
  }

  const universal = KPI_CATALOG.filter((k) => k.layer === "universal");
  const operatingModel = KPI_CATALOG.filter(
    (k) => k.layer === "operating_model" && kpiAvailable(k, model, allConcepts, allPurposes),
  );

  const auditSpecificMap = new Map<string, KpiDefinition>();
  const auditSpecificGroups: ResolvedKpiCatalog["auditSpecificGroups"] = [];

  for (const t of templates) {
    const concepts = templateConcepts(t.def);
    const templateKpis = deriveAuditSpecificKpis(concepts);
    if (templateKpis.length) {
      auditSpecificGroups.push({ templateKey: t.key, templateName: t.name, kpis: templateKpis });
      for (const k of templateKpis) auditSpecificMap.set(k.id, k);
    }
  }

  const auditSpecific = [...auditSpecificMap.values()];

  return { universal, operatingModel, auditSpecific, auditSpecificGroups };
}

/** Resolve KPIs from a single custom template definition (for template intelligence view). */
export function resolveKpisForTemplate(def: TemplateDefinition): KpiDefinition[] {
  const concepts = templateConcepts(def);
  return deriveAuditSpecificKpis(concepts);
}
