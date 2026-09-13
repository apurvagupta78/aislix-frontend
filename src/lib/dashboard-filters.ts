/**
 * Workspace dashboard filter state — shared between UI and data layer.
 */

import type { DashboardRoleFilter } from "@/lib/dashboard-config";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import { roleTabLabel } from "@/lib/role-audit-ui";

export type DashboardDatePreset =
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
  role: DashboardRoleFilter;
  storeId: string;
  category: string;
  subCategory: string;
  teamMemberId: string;
  auditAssignment: DashboardAssignmentFilter;
};

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilterState = {
  datePreset: "7d",
  dateFrom: "",
  dateTo: "",
  country: "all",
  city: "all",
  role: "all",
  storeId: "all",
  category: "all",
  subCategory: "all",
  teamMemberId: "all",
  auditAssignment: "all",
};

export type DashboardStoreOption = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
};

export const DASHBOARD_DATE_PRESETS: { value: DashboardDatePreset; label: string }[] = [
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
    filters.role === "all" &&
    filters.storeId === "all" &&
    filters.category === "all" &&
    filters.subCategory === "all" &&
    filters.teamMemberId === "all" &&
    filters.auditAssignment === "all"
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

  if (filters.datePreset !== "7d" || filters.dateFrom || filters.dateTo) {
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

  if (filters.role !== "all") {
    chips.push({
      key: "role",
      label: roleTabLabel(filters.role as AuditRoleTab),
    });
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

  return chips;
}

export function clearDashboardFilterChip(
  filters: DashboardFilterState,
  chipKey: DashboardFilterChip["key"],
): DashboardFilterState {
  if (chipKey === "date") {
    return { ...filters, datePreset: "7d", dateFrom: "", dateTo: "" };
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
  return { ...filters, [chipKey]: defaults[chipKey as keyof DashboardFilterState] };
}

export type DashboardFilterSummary = {
  audit_count: number;
  store_count: number;
  category_count: number;
  label: string;
};

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
