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
    ctDateRange: globalFilters.datePreset !== "all" ? globalFilters.datePreset : undefined,
    ctCountry: globalFilters.country !== "all" ? globalFilters.country : undefined,
    ctCity: globalFilters.city !== "all" ? globalFilters.city : undefined,
    ctStore: globalFilters.storeId !== "all" ? globalFilters.storeId : undefined,
    ctCategory: globalFilters.category !== "all" ? globalFilters.category : undefined,
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
  if (globalFilters.storeId && globalFilters.storeId !== "all") parts.push("Store filter active");
  if (globalFilters.datePreset && globalFilters.datePreset !== "all") {
    parts.push(`Period: ${globalFilters.datePreset}`);
  }
  return parts.length ? parts.join(" · ") : "All scopes";
}
