/**
 * KPI definitions derived from the Universal Audit Engine template registry.
 * One definition layer — dashboards, intelligence and reports should consume this in Phase 2.
 */

import type { OperatingModel, TemplateDefinition } from "@/lib/audit-builder/types";
import { getTemplatesByOperatingModel, STARTER_TEMPLATE_LIBRARY } from "@/lib/audit-engine/template-factory";
import type { ControlTowerKpi, ControlTowerModelFilter } from "./types";

type KpiDef = {
  id: string;
  label: string;
  universal?: boolean;
  /** Template field concepts or purposes that enable this KPI */
  requires?: { concepts?: string[]; purposes?: string[] };
  models?: OperatingModel[];
};

const UNIVERSAL_KPI_DEFS: KpiDef[] = [
  { id: "audit_completion", label: "Audit Completion %", universal: true },
  { id: "evidence_coverage", label: "Evidence Coverage %", universal: true },
  { id: "audit_pass", label: "Audit Pass %", universal: true },
  { id: "value_variance", label: "Potential Inventory Value Variance", universal: true },
  { id: "open_findings", label: "Open Findings", universal: true },
  { id: "critical_findings", label: "Critical Findings", universal: true },
  { id: "open_actions", label: "Open Corrective Actions", universal: true },
  { id: "overdue_actions", label: "Overdue Actions", universal: true },
  { id: "sla_compliance", label: "SLA Compliance %", universal: true },
  { id: "recurring_rate", label: "Recurring Issue Rate", universal: true },
];

const CONTEXTUAL_KPI_DEFS: KpiDef[] = [
  { id: "inventory_accuracy", label: "Inventory Accuracy", requires: { concepts: ["variance_units", "expected_quantity"] }, models: ["local_store", "dark_store", "warehouse"] },
  { id: "oos_pct", label: "OOS %", requires: { concepts: ["oos"] }, models: ["local_store", "supermarket", "dark_store", "fmcg_distributor"] },
  { id: "expiry_risk", label: "Expiry Risk", requires: { concepts: ["expiry_date", "days_remaining"] }, models: ["local_store", "supermarket", "dark_store", "warehouse", "fmcg_distributor"] },
  { id: "shelf_compliance", label: "Shelf Compliance", requires: { purposes: ["shelf"] }, models: ["local_store", "supermarket"] },
  { id: "planogram_compliance", label: "Planogram Compliance", requires: { purposes: ["planogram"] }, models: ["supermarket", "fmcg_distributor"] },
  { id: "price_compliance", label: "Price Compliance", requires: { purposes: ["pricing"] } },
  { id: "promotion_compliance", label: "Promotion Compliance", requires: { purposes: ["promotion"] } },
  { id: "posm_compliance", label: "POSM Compliance", requires: { purposes: ["posm"] } },
  { id: "picking_accuracy", label: "Picking Accuracy", requires: { purposes: ["picking"] }, models: ["dark_store", "warehouse"] },
  { id: "putaway_accuracy", label: "Putaway Accuracy", requires: { purposes: ["putaway"] }, models: ["dark_store", "warehouse"] },
  { id: "receiving_accuracy", label: "Receiving Accuracy", requires: { purposes: ["receiving"] }, models: ["dark_store", "warehouse"] },
  { id: "outlet_coverage", label: "Outlet Audit Coverage", requires: { purposes: ["retail_execution", "outlet_visit"] }, models: ["fmcg_distributor"] },
  { id: "execution_score", label: "Execution Score", requires: { purposes: ["retail_execution", "merchandising"] }, models: ["fmcg_distributor"] },
  { id: "store_health", label: "Store Health", models: ["local_store", "supermarket", "dark_store"] },
  { id: "warehouse_health", label: "Warehouse Health", models: ["warehouse"] },
];

function templateConcepts(def: TemplateDefinition): Set<string> {
  const concepts = new Set<string>();
  for (const f of def.fields) {
    if (f.standardConcept) concepts.add(f.standardConcept);
    if (f.key) concepts.add(f.key);
  }
  return concepts;
}

function templatesForFilter(model: ControlTowerModelFilter) {
  if (model === "all") return STARTER_TEMPLATE_LIBRARY.map((s) => ({ purpose: s.purpose, def: s.build() }));
  return getTemplatesByOperatingModel(model).map((s) => ({ purpose: s.purpose, def: s.build() }));
}

function kpiAvailable(def: KpiDef, model: ControlTowerModelFilter, templates: { purpose: string; def: TemplateDefinition }[]): boolean {
  if (def.universal) return true;
  if (def.models && model !== "all" && !def.models.includes(model)) return false;
  if (!def.requires) return def.models ? def.models.includes(model as OperatingModel) : true;

  const allConcepts = new Set<string>();
  const allPurposes = new Set<string>();
  for (const t of templates) {
    allPurposes.add(t.purpose);
    templateConcepts(t.def).forEach((c) => allConcepts.add(c));
  }

  if (def.requires.concepts?.length) {
    if (!def.requires.concepts.some((c) => allConcepts.has(c))) return false;
  }
  if (def.requires.purposes?.length) {
    if (!def.requires.purposes.some((p) => allPurposes.has(p))) return false;
  }
  return true;
}

export function resolveKpiCatalog(model: ControlTowerModelFilter): {
  universal: KpiDef[];
  contextual: KpiDef[];
} {
  const templates = templatesForFilter(model);
  return {
    universal: UNIVERSAL_KPI_DEFS.filter((d) => kpiAvailable(d, model, templates)),
    contextual: CONTEXTUAL_KPI_DEFS.filter((d) => kpiAvailable(d, model, templates)),
  };
}

export function templateCategoriesForModel(model: ControlTowerModelFilter): string[] {
  const specs = model === "all" ? STARTER_TEMPLATE_LIBRARY : getTemplatesByOperatingModel(model);
  return [...new Set(specs.map((s) => s.category))].sort();
}

export function templateCountForModel(model: ControlTowerModelFilter): number {
  return model === "all" ? STARTER_TEMPLATE_LIBRARY.length : getTemplatesByOperatingModel(model).length;
}

/** Placeholder KPI shell when live data unavailable (Phase 1E demo). */
export function kpiShellFromDef(def: KpiDef, available: boolean): ControlTowerKpi {
  return {
    id: def.id,
    label: def.label,
    value: available ? "—" : "N/A",
    detail: available ? "Demo data — Phase 2 live wiring" : "No data for selected scope",
    tone: "neutral",
    available,
    source: "Template-driven catalog",
  };
}
