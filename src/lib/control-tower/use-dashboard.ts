import { useQuery } from "@tanstack/react-query";

import type { DashboardFilterState } from "@/lib/dashboard-filters";
import { computeUniversalDashboard } from "@/lib/kpi-engine/compute-universal";
import type { ControlTowerModelFilter } from "./types";

export function controlTowerQueryKey(
  model: ControlTowerModelFilter,
  filters: DashboardFilterState,
  previewDemo = false,
) {
  return [
    "control-tower-dashboard",
    model,
    previewDemo,
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

export function useControlTowerDashboard(
  model: ControlTowerModelFilter,
  filters: DashboardFilterState,
  options?: { previewDemo?: boolean; userEmail?: string | null },
) {
  const previewDemo = options?.previewDemo ?? false;
  return useQuery({
    queryKey: controlTowerQueryKey(model, filters, previewDemo),
    queryFn: () =>
      computeUniversalDashboard({
        model,
        filters,
        previewDemo,
        userEmail: options?.userEmail,
      }),
    staleTime: 30_000,
  });
}
