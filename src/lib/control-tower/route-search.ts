import type { ControlTowerModelFilter } from "./types";

export type ControlTowerPageSearch = {
  ctModel?: ControlTowerModelFilter;
  ctFrom?: string;
  ctDateRange?: string;
  ctCountry?: string;
  ctCity?: string;
  ctStore?: string;
  ctCategory?: string;
  severity?: string;
  scope?: string;
};

export function parseControlTowerPageSearch(search: Record<string, unknown>): ControlTowerPageSearch {
  const models = ["all", "local_store", "supermarket", "dark_store", "warehouse", "fmcg_distributor"];
  const ctModel =
    typeof search.ctModel === "string" && models.includes(search.ctModel)
      ? (search.ctModel as ControlTowerModelFilter)
      : undefined;

  return {
    ctModel: ctModel ?? "all",
    ctFrom: typeof search.ctFrom === "string" ? search.ctFrom : undefined,
    severity: typeof search.severity === "string" ? search.severity : undefined,
    scope: typeof search.scope === "string" ? search.scope : undefined,
  };
}

export function backToDashboardSearch(search: ControlTowerPageSearch) {
  return {
    model: search.ctModel && search.ctModel !== "all" ? search.ctModel : undefined,
  };
}
