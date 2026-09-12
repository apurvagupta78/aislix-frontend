/**
 * Role-specific planogram field requirements and adhoc planogram parsing.
 */

import {
  computeReadiness,
  packageFromDb,
  type KpiReadiness,
  type PlanogramAuditPackage,
} from "@/lib/planogram-audit-package";
import type { PlanogramRow } from "@/lib/planogram";
import { primaryKpiIds, type AuditRoleTab } from "@/lib/role-audit-ui";
import type { AuditKpiId } from "@/lib/role-kpi-config";

export type PlanogramFieldKey =
  | "location"
  | "category"
  | "sub_category"
  | "brand"
  | "product_name"
  | "variant"
  | "expected_qty"
  | "mrp_inr"
  | "avg_daily_sales"
  | "sku"
  | "shelf_position";

export type PlanogramFieldDef = {
  key: PlanogramFieldKey;
  label: string;
  required: boolean;
  note?: string;
};

const BASE_FIELDS: PlanogramFieldDef[] = [
  { key: "location", label: "Location", required: true },
  { key: "category", label: "Category", required: true },
  { key: "sub_category", label: "Sub category", required: true },
  { key: "brand", label: "Brand", required: true },
  { key: "product_name", label: "Product name", required: true },
  { key: "variant", label: "Variant", required: false },
  {
    key: "expected_qty",
    label: "Expected facings",
    required: true,
    note: "Front-facing units visible on shelf (not total inventory)",
  },
  { key: "sku", label: "SKU", required: true, note: "Auto-generated from brand + product if blank" },
  { key: "shelf_position", label: "Shelf position / slot ID", required: false },
  {
    key: "mrp_inr",
    label: "Price (MRP)",
    required: false,
    note: "Required when this role calculates Price Compliance",
  },
  { key: "avg_daily_sales", label: "Daily sales (units)", required: false },
];

/** Per-role overrides for which product-row fields are required. */
const ROLE_FIELD_OVERRIDES: Partial<
  Record<AuditRoleTab, Partial<Record<PlanogramFieldKey, boolean>>>
> = {
  supermarket: { mrp_inr: true, sku: true },
  darkstore: { shelf_position: true, sku: true, mrp_inr: false },
  fmcg: { shelf_position: true, sku: true, mrp_inr: false },
  distributor: { mrp_inr: true, sku: true },
  local: { mrp_inr: true, sku: true, shelf_position: true },
};

export function getRolePlanogramFields(role: AuditRoleTab): PlanogramFieldDef[] {
  const overrides = ROLE_FIELD_OVERRIDES[role] ?? {};
  return BASE_FIELDS.map((field) => ({
    ...field,
    required: overrides[field.key] ?? field.required,
  }));
}

export function roleRequiresPricing(role: AuditRoleTab): boolean {
  return primaryKpiIds(role).includes("price_compliance");
}

export function roleKpiReadiness(
  role: AuditRoleTab,
  rows: PlanogramRow[],
  pkg: PlanogramAuditPackage,
): KpiReadiness[] {
  const needed = new Set(primaryKpiIds(role));
  return computeReadiness(rows, pkg).filter((item) => needed.has(item.kpi_id as AuditKpiId));
}

export function autoSku(brand: string, product: string): string {
  const b = brand.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const p = product
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return `${b || "SKU"}-${p || "ITEM"}`;
}

export function parseAdhocPlanogram(raw: unknown): {
  rows: PlanogramRow[];
  audit_role?: string;
  audit_package?: PlanogramAuditPackage;
} {
  if (!raw) return { rows: [] };
  if (Array.isArray(raw)) return { rows: raw as PlanogramRow[] };
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.rows)) {
      return {
        rows: obj.rows as PlanogramRow[],
        audit_role: typeof obj.audit_role === "string" ? obj.audit_role : undefined,
        audit_package: obj.audit_package ? packageFromDb(obj.audit_package) : undefined,
      };
    }
  }
  return { rows: [] };
}

export function adhocPlanogramPayload(
  rows: PlanogramRow[],
  auditRole: AuditRoleTab,
  auditPackage: PlanogramAuditPackage,
): Record<string, unknown> {
  return {
    rows,
    audit_role: auditRole,
    audit_package: auditPackage,
  };
}

export function isFieldRequired(role: AuditRoleTab, key: PlanogramFieldKey): boolean {
  return getRolePlanogramFields(role).find((f) => f.key === key)?.required ?? false;
}
