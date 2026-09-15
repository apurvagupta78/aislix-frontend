import type { AuditPurpose, OperatingModel } from "@/lib/audit-builder/types";
import { OPERATING_MODEL_CARDS, getPurposesForModel } from "@/lib/audit-engine/operating-model-catalog";
import {
  getRecommendedTemplates,
  STARTER_TEMPLATE_LIBRARY,
  type SystemTemplateSpec,
} from "@/lib/audit-engine/template-factory";

export const PURPOSE_SECTION_LABELS: Partial<Record<AuditPurpose, string>> = {
  inventory: "Inventory",
  expiry: "Expiry",
  fnv_qc: "FNV / QC",
  shelf: "Shelf",
  planogram: "Planogram",
  pricing: "Pricing",
  promotion: "Promotion",
  receiving: "Receiving",
  putaway: "Putaway",
  picking: "Picking",
  dispatch: "Dispatch",
  retail_execution: "Outlet Execution",
  distributor: "Distributor",
  warehouse: "Warehouse",
  compliance: "Compliance",
  reconciliation: "Reconciliation",
  competitor: "Competitor",
  department: "Department",
  opening_closing: "Opening / Closing",
  stock_ageing: "Stock Ageing",
  damage: "Damage",
  cycle_count: "Cycle Count",
  location: "Location",
  posm: "POSM",
  visit: "Visit",
};

export function groupTemplatesByPurpose(
  specs: SystemTemplateSpec[],
): { purpose: AuditPurpose; label: string; templates: SystemTemplateSpec[] }[] {
  const map = new Map<AuditPurpose, SystemTemplateSpec[]>();
  for (const spec of specs) {
    const list = map.get(spec.purpose) ?? [];
    list.push(spec);
    map.set(spec.purpose, list);
  }
  return [...map.entries()]
    .map(([purpose, templates]) => ({
      purpose,
      label: PURPOSE_SECTION_LABELS[purpose] ?? purpose.replace(/_/g, " "),
      templates,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function groupTemplatesByOperatingModel(
  specs: SystemTemplateSpec[],
): { model: OperatingModel; label: string; templates: SystemTemplateSpec[] }[] {
  const models = OPERATING_MODEL_CARDS.filter((c) => c.id !== "custom").map((c) => c.id as OperatingModel);
  return models
    .map((model) => ({
      model,
      label: OPERATING_MODEL_CARDS.find((c) => c.id === model)?.title ?? model,
      templates: specs.filter((s) => s.operatingModel === model),
    }))
    .filter((g) => g.templates.length > 0);
}

export function getDiscoverySections(
  operatingModelFilter: OperatingModel | "all",
  purposeFilter: AuditPurpose | "all",
  search: string,
  aiEnabledOnly: boolean,
  evidenceRequiredOnly: boolean,
): {
  recommended: SystemTemplateSpec[];
  byModel: ReturnType<typeof groupTemplatesByOperatingModel>;
  byPurpose: ReturnType<typeof groupTemplatesByPurpose>;
  browseAll: SystemTemplateSpec[];
} {
  let pool = STARTER_TEMPLATE_LIBRARY;
  if (operatingModelFilter !== "all") pool = pool.filter((s) => s.operatingModel === operatingModelFilter);
  if (purposeFilter !== "all") pool = pool.filter((s) => s.purpose === purposeFilter);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    pool = pool.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.shortDescription.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q),
    );
  }
  if (aiEnabledOnly) pool = pool.filter((s) => s.build().ai?.enabled);
  if (evidenceRequiredOnly) pool = pool.filter((s) => s.build().evidence?.photoRequired);

  const defaultModel =
    operatingModelFilter !== "all" ? operatingModelFilter : ("local_store" as OperatingModel);
  const recommended =
    operatingModelFilter !== "all"
      ? getRecommendedTemplates(
          operatingModelFilter,
          purposeFilter !== "all" ? purposeFilter : undefined,
        ).filter((s) => pool.some((p) => p.key === s.key))
      : pool.filter((s) => s.recommended || s.flagship).slice(0, 8);

  return {
    recommended,
    byModel: groupTemplatesByOperatingModel(pool),
    byPurpose: groupTemplatesByPurpose(pool),
    browseAll: pool,
  };
}

export function purposeOptionsForFilter(model: OperatingModel | "all") {
  if (model === "all") {
    const seen = new Set<string>();
    return OPERATING_MODEL_CARDS.filter((c) => c.id !== "custom").flatMap((c) =>
      getPurposesForModel(c.id).filter((p) => {
        if (seen.has(p.value)) return false;
        seen.add(p.value);
        return true;
      }),
    );
  }
  return getPurposesForModel(model);
}
