import type { ControlTowerModelFilter, ControlTowerSearch } from "./types";
import type { DashboardFilterState } from "@/lib/dashboard-filters";

/** Build search params preserving Control Tower + global filter context for View All links. */
export function buildViewAllSearch(
  search: ControlTowerSearch,
  globalFilters: DashboardFilterState,
  extra?: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return {
    ctModel: search.model && search.model !== "all" ? search.model : undefined,
    ctFrom: "control-tower",
    ctDateRange: globalFilters.dateRange !== "30d" ? globalFilters.dateRange : undefined,
    ctCountry: globalFilters.countryId ?? undefined,
    ctCity: globalFilters.cityId ?? undefined,
    ctStore: globalFilters.storeId ?? undefined,
    ctCategory: globalFilters.category ?? undefined,
    ...extra,
  };
}

export function modelFilterLabel(model: ControlTowerModelFilter | undefined): string {
  if (!model || model === "all") return "All operating models";
  return model.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function filterContextSummary(
  search: ControlTowerSearch,
  globalFilters: DashboardFilterState,
): string {
  const parts: string[] = [];
  if (search.model && search.model !== "all") parts.push(modelFilterLabel(search.model));
  if (globalFilters.storeId) parts.push(`Store filter active`);
  if (globalFilters.dateRange && globalFilters.dateRange !== "30d") {
    parts.push(`Period: ${globalFilters.dateRange}`);
  }
  return parts.length ? parts.join(" · ") : "All scopes";
}
