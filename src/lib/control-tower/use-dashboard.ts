import { useQuery } from "@tanstack/react-query";

import type { DashboardFilterState } from "@/lib/dashboard-filters";
import { computeUniversalDashboard } from "@/lib/kpi-engine/compute-universal";
import type { ControlTowerModelFilter } from "./types";

export function controlTowerQueryKey(model: ControlTowerModelFilter, filters: DashboardFilterState) {
  return [
    "control-tower-dashboard",
    model,
    filters.datePreset,
    filters.dateFrom,
    filters.dateTo,
    filters.country,
    filters.city,
    filters.storeId,
    filters.category,
    filters.subCategory,
    filters.teamMemberId,
    filters.auditAssignment,
    filters.skuId,
    filters.itemCode,
    filters.itemName,
  ] as const;
}

export function useControlTowerDashboard(model: ControlTowerModelFilter, filters: DashboardFilterState) {
  return useQuery({
    queryKey: controlTowerQueryKey(model, filters),
    queryFn: () => computeUniversalDashboard({ model, filters }),
    staleTime: 30_000,
  });
}
