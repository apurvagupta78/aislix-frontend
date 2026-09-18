/**
 * Workspace dashboard filter state — shared between UI and data layer.
 */

import { KPI_DASHBOARD_LABELS } from "@/lib/dashboard-config";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import type { AuditRoleTab } from "@/lib/role-audit-ui";

export type DashboardDatePreset =
  | "all"
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "custom"
  | "upcoming";

export type DashboardAssignmentFilter = "all" | "assigned_to_me" | "assigned_by_me" | "unassigned";

export type DashboardFilterState = {
  datePreset: DashboardDatePreset;
  dateFrom: string;
  dateTo: string;
  country: string;
  city: string;
  /** Primary dashboard context — always one of the five audit roles. */
  role: AuditRoleTab;
  storeId: string;
  category: string;
  subCategory: string;
  teamMemberId: string;
  auditAssignment: DashboardAssignmentFilter;
  /** Role primary KPI focus — "all" shows every KRI area. */
  kri: AuditKpiId | "all";
  skuId: string;
  itemCode: string;
  itemName: string;
};

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilterState = {
  datePreset: "all",
  dateFrom: "",
  dateTo: "",
  country: "all",
  city: "all",
  role: "supermarket",
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

export type DashboardStoreOption = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
};

export const DASHBOARD_DATE_PRESETS: { value: DashboardDatePreset; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "custom", label: "Custom range" },
  { value: "upcoming", label: "Upcoming" },
];

export const DASHBOARD_ASSIGNMENT_OPTIONS: { value: DashboardAssignmentFilter; label: string }[] = [
  { value: "all", label: "All audits" },
  { value: "assigned_to_me", label: "Assigned to me" },
  { value: "assigned_by_me", label: "Assigned by me" },
  { value: "unassigned", label: "Unassigned" },
];

export type DashboardTeamMember = {
  user_id: string;
  name: string;
  email: string;
};

export type DashboardSubCategoryOption = {
  category: string;
  value: string;
  label: string;
};

export type DashboardFilterOptions = {
  stores: DashboardStoreOption[];
  countries: string[];
  cities: string[];
  categories: string[];
  subcategories: DashboardSubCategoryOption[];
  team_members: DashboardTeamMember[];
  kri_options: Array<{ value: AuditKpiId; label: string }>;
  only_self: boolean;
  current_user_id: string | null;
};

export type DashboardDateBounds = {
  from: Date | null;
  to: Date | null;
  upcoming: boolean;
};

export function resolveDashboardDateBounds(filters: DashboardFilterState): DashboardDateBounds {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => {
    const e = startOfDay(d);
    e.setDate(e.getDate() + 1);
    return e;
  };

  switch (filters.datePreset) {
    case "all":
      return { from: null, to: null, upcoming: false };
    case "today":
      return { from: startOfDay(now), to: endOfDay(now), upcoming: false };
    case "yesterday": {
      const y = startOfDay(now);
      y.setDate(y.getDate() - 1);
      return { from: y, to: endOfDay(y), upcoming: false };
    }
    case "upcoming":
      return { from: startOfDay(now), to: null, upcoming: true };
    case "custom": {
      const from = filters.dateFrom ? startOfDay(new Date(filters.dateFrom)) : null;
      const to = filters.dateTo ? endOfDay(new Date(filters.dateTo)) : null;
      return { from, to, upcoming: false };
    }
    case "30d":
    case "90d":
    case "7d": {
      const days = filters.datePreset === "30d" ? 30 : filters.datePreset === "90d" ? 90 : 7;
      const from = new Date(now);
      from.setDate(from.getDate() - days);
      return { from, to: null, upcoming: false };
    }
    default:
      return { from: null, to: null, upcoming: false };
  }
}

export function isDefaultDashboardFilters(filters: DashboardFilterState): boolean {
  return (
    filters.datePreset === DEFAULT_DASHBOARD_FILTERS.datePreset &&
    !filters.dateFrom &&
    !filters.dateTo &&
    filters.country === "all" &&
    filters.city === "all" &&
    filters.storeId === "all" &&
    filters.category === "all" &&
    filters.subCategory === "all" &&
    filters.teamMemberId === "all" &&
    filters.auditAssignment === "all" &&
    filters.kri === "all" &&
    !(filters.skuId ?? "").trim() &&
    !(filters.itemCode ?? "").trim() &&
    !(filters.itemName ?? "").trim()
  );
}

export type DashboardFilterChip = {
  key: keyof DashboardFilterState | "date";
  label: string;
};

export function dashboardFilterChips(
  filters: DashboardFilterState,
  options: DashboardFilterOptions,
): DashboardFilterChip[] {
  const chips: DashboardFilterChip[] = [];

  if (filters.datePreset !== "all" || filters.dateFrom || filters.dateTo) {
    const preset = DASHBOARD_DATE_PRESETS.find((p) => p.value === filters.datePreset);
    let label = preset?.label ?? filters.datePreset;
    if (filters.datePreset === "custom" && filters.dateFrom) {
      label = filters.dateTo
        ? `${filters.dateFrom} – ${filters.dateTo}`
        : `From ${filters.dateFrom}`;
    }
    chips.push({ key: "date", label });
  }

  if (filters.country !== "all") {
    chips.push({ key: "country", label: filters.country });
  }

  if (filters.city !== "all") {
    chips.push({ key: "city", label: filters.city });
  }

  if (filters.storeId !== "all") {
    const store = options.stores.find((s) => s.id === filters.storeId);
    chips.push({ key: "storeId", label: store?.name ?? "Store" });
  }

  if (filters.category !== "all") {
    chips.push({ key: "category", label: filters.category });
  }

  if (filters.subCategory !== "all") {
    chips.push({ key: "subCategory", label: filters.subCategory });
  }

  if (filters.teamMemberId !== "all") {
    const member = options.team_members.find((m) => m.user_id === filters.teamMemberId);
    chips.push({ key: "teamMemberId", label: member?.name || member?.email || "Team member" });
  }

  if (filters.auditAssignment !== "all") {
    const opt = DASHBOARD_ASSIGNMENT_OPTIONS.find((o) => o.value === filters.auditAssignment);
    chips.push({ key: "auditAssignment", label: opt?.label ?? filters.auditAssignment });
  }

  if (filters.kri !== "all") {
    const opt = options.kri_options.find((o) => o.value === filters.kri);
    chips.push({ key: "kri", label: opt?.label ?? KPI_DASHBOARD_LABELS[filters.kri] });
  }

  if (filters.skuId.trim()) {
    chips.push({ key: "skuId", label: `SKU ${filters.skuId.trim()}` });
  }
  if (filters.itemCode.trim()) {
    chips.push({ key: "itemCode", label: `Item ${filters.itemCode.trim()}` });
  }
  if (filters.itemName.trim()) {
    chips.push({ key: "itemName", label: filters.itemName.trim() });
  }

  return chips;
}

export function clearDashboardFilterChip(
  filters: DashboardFilterState,
  chipKey: DashboardFilterChip["key"],
): DashboardFilterState {
  if (chipKey === "date") {
    return { ...filters, datePreset: "all", dateFrom: "", dateTo: "" };
  }
  const defaults = DEFAULT_DASHBOARD_FILTERS;
  if (chipKey === "country") {
    return { ...filters, country: "all", city: "all", storeId: "all" };
  }
  if (chipKey === "city") {
    return { ...filters, city: "all", storeId: "all" };
  }
  if (chipKey === "category") {
    return { ...filters, category: "all", subCategory: "all" };
  }
  if (chipKey === "skuId" || chipKey === "itemCode" || chipKey === "itemName") {
    return { ...filters, [chipKey]: "" };
  }
  return { ...filters, [chipKey]: defaults[chipKey as keyof DashboardFilterState] };
}

export type DashboardFilterSummary = {
  audit_count: number;
  store_count: number;
  category_count: number;
  label: string;
};

/** Map workspace dashboard filters to audit history URL search params. */
export function dashboardFiltersToHistorySearch(
  filters: DashboardFilterState,
  options: DashboardFilterOptions,
): {
  q?: string;
  store?: string;
  date?: string;
  date_from?: string;
  date_to?: string;
} {
  const search: {
    q?: string;
    store?: string;
    date?: string;
    date_from?: string;
    date_to?: string;
  } = {};

  if (filters.storeId !== "all") {
    search.store = filters.storeId;
  }

  if (filters.category !== "all") {
    search.q = filters.category;
  } else if (filters.subCategory !== "all") {
    search.q = filters.subCategory;
  }

  const bounds = resolveDashboardDateBounds(filters);
  if (filters.datePreset === "today" || filters.datePreset === "yesterday") {
    if (bounds.from) {
      search.date = bounds.from.toISOString().slice(0, 10);
    }
  } else if (filters.datePreset === "custom") {
    if (filters.dateFrom) search.date_from = filters.dateFrom;
    if (filters.dateTo) search.date_to = filters.dateTo;
  } else if (bounds.from) {
    search.date_from = bounds.from.toISOString().slice(0, 10);
  }

  return search;
}

export function buildDashboardFilterSummary(
  auditCount: number,
  storeCount: number,
  categoryCount: number,
): DashboardFilterSummary {
  const parts: string[] = [];
  parts.push(`${auditCount} audit${auditCount === 1 ? "" : "s"}`);
  if (storeCount > 0) parts.push(`${storeCount} store${storeCount === 1 ? "" : "s"}`);
  if (categoryCount > 0) parts.push(`${categoryCount} categor${categoryCount === 1 ? "y" : "ies"}`);
  return {
    audit_count: auditCount,
    store_count: storeCount,
    category_count: categoryCount,
    label: parts.join(" · "),
  };
}

/** @deprecated use DashboardFilterState.datePreset */
export type DashboardDateRange = DashboardDatePreset;
