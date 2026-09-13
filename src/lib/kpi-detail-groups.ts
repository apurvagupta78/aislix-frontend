/**
 * KPI details section grouping — display layout only (role KPI config unchanged).
 */

import type { AuditKpiId } from "@/lib/role-kpi-config";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import { primaryKpiIds } from "@/lib/role-audit-ui";

export type KpiDetailGroup = {
  label: string;
  kpi_ids: AuditKpiId[];
};

/** Role → visual group labels for the KPI details grid. */
export const KPI_DETAIL_GROUPS: Record<AuditRoleTab, KpiDetailGroup[]> = {
  darkstore: [
    { label: "Availability & Range", kpi_ids: ["osa", "assortment_compliance"] },
    {
      label: "Shelf Execution",
      kpi_ids: ["location_accuracy", "planogram_compliance", "facing_count"],
    },
  ],
  supermarket: [
    { label: "Availability & Range", kpi_ids: ["osa", "assortment_compliance"] },
    {
      label: "Shelf Execution",
      kpi_ids: ["planogram_compliance", "price_compliance", "promotional_compliance"],
    },
  ],
  fmcg: [
    { label: "Brand Performance", kpi_ids: ["share_of_shelf", "osa", "facing_count"] },
    { label: "Shelf Execution", kpi_ids: ["planogram_compliance", "promotional_compliance"] },
  ],
  distributor: [
    { label: "Outlet Availability", kpi_ids: ["osa", "msl_compliance"] },
    {
      label: "Execution",
      kpi_ids: ["planogram_compliance", "price_compliance", "promotional_compliance"],
    },
  ],
  local: [
    { label: "Availability & Range", kpi_ids: ["osa", "assortment_compliance"] },
    {
      label: "Execution",
      kpi_ids: ["facing_count", "price_compliance", "promotional_compliance"],
    },
  ],
};

/** KPIs whose heavy visuals are hidden until the user expands drill-down. */
export const KPI_DRILL_DOWN_LABEL: Partial<Record<AuditKpiId, string>> = {
  location_accuracy: "View shelf map →",
  planogram_compliance: "View shelf map →",
  facing_count: "View facing breakdown →",
  assortment_compliance: "View missing products →",
  msl_compliance: "View missing products →",
  price_compliance: "View price details →",
  promotional_compliance: "View promotion details →",
};

export function kpiHasDrillDown(kpiId: AuditKpiId): boolean {
  return kpiId in KPI_DRILL_DOWN_LABEL;
}

export function kpiDetailGroupsForRole(role: AuditRoleTab): KpiDetailGroup[] {
  const roleIds = new Set(primaryKpiIds(role));
  return (KPI_DETAIL_GROUPS[role] ?? [])
    .map((group) => ({
      ...group,
      kpi_ids: group.kpi_ids.filter((id) => roleIds.has(id)),
    }))
    .filter((group) => group.kpi_ids.length > 0);
}
