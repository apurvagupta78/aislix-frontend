import type { AuditPurpose, OperatingModel } from "@/lib/audit-builder/types";
import {
  ACCEPTANCE_TEMPLATES,
  getTemplatesByOperatingModel,
  STARTER_TEMPLATE_LIBRARY,
  type SystemTemplateSpec,
} from "./registry";

export { getTemplatesByOperatingModel, STARTER_TEMPLATE_LIBRARY };

/** Priority templates for New Audit recommended section and seed validation. */
export const PRIORITY_TEMPLATE_KEYS = [
  "local_store_expiry",
  "local_store_inventory",
  "supermarket_planogram_shelf",
  "supermarket_pricing",
  "dark_store_inventory",
  "dark_store_expiry",
  "dark_store_receiving",
  "dark_store_picking",
  "warehouse_receiving_qc",
  "warehouse_inventory_count",
  "warehouse_putaway",
  "warehouse_dispatch",
  "fmcg_outlet_retail_execution",
  "fmcg_stock_availability",
  "fmcg_expiry",
  "fmcg_merchandising",
  "fmcg_pricing",
  "fmcg_promotion",
  "fmcg_distributor_audit",
] as const;

export type PriorityTemplateKey = (typeof PRIORITY_TEMPLATE_KEYS)[number];

export const FLAGSHIP_TEMPLATE_KEYS = ACCEPTANCE_TEMPLATES.map((t) => t.key);

export function isPriorityTemplate(key: string): boolean {
  return (PRIORITY_TEMPLATE_KEYS as readonly string[]).includes(key);
}

export function getTemplatesForPurpose(
  model: OperatingModel,
  purpose: AuditPurpose,
): SystemTemplateSpec[] {
  return getTemplatesByOperatingModel(model).filter((t) => t.purpose === purpose);
}

export function getRecommendedTemplates(
  model: OperatingModel,
  purpose?: AuditPurpose,
): SystemTemplateSpec[] {
  const pool = purpose ? getTemplatesForPurpose(model, purpose) : getTemplatesByOperatingModel(model);
  const recommended = pool.filter((t) => t.recommended);
  return recommended.length ? recommended : pool.slice(0, 6);
}

export function getBrowseAllTemplates(
  model: OperatingModel,
  purpose?: AuditPurpose,
): SystemTemplateSpec[] {
  return purpose ? getTemplatesForPurpose(model, purpose) : getTemplatesByOperatingModel(model);
}
