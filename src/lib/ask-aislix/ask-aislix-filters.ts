import { DEFAULT_DASHBOARD_FILTERS, type DashboardFilterState } from "@/lib/dashboard-filters";

/**
 * Ask Aislix query scope — intentionally independent from Control Tower dashboard filters.
 * Data access is limited by auth scope; time/location/product constraints come from the question
 * and tool arguments, not the workspace filter bar.
 */
export const ASK_AISLIX_QUERY_FILTERS: DashboardFilterState = {
  ...DEFAULT_DASHBOARD_FILTERS,
  datePreset: "90d",
  dateFrom: "",
  dateTo: "",
  country: "all",
  city: "all",
  storeId: "all",
  category: "all",
  subCategory: "all",
  teamMemberId: "all",
  auditAssignment: "all",
  kri: "all",
  skuId: "",
  itemCode: "",
  itemName: "",
};

export function resolveAskAislixQueryFilters(
  _ignored?: Partial<DashboardFilterState>,
): DashboardFilterState {
  return { ...ASK_AISLIX_QUERY_FILTERS };
}
