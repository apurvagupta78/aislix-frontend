/**
 * Workspace dashboard — centralized role configuration, chart palette, and copy.
 */

import type { AuditKpiId } from "@/lib/role-kpi-config";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import { AUDIT_ROLE_TABS, roleTabLabel } from "@/lib/role-audit-ui";

export type DashboardDateRange = "7d" | "30d" | "90d" | "12m";

export const DASHBOARD_DATE_OPTIONS: { value: DashboardDateRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
];

export type DashboardRoleFilter = AuditRoleTab | "all";

export const DASHBOARD_ROLE_OPTIONS: { value: DashboardRoleFilter; label: string }[] = [
  { value: "all", label: "All roles" },
  ...AUDIT_ROLE_TABS.map((role) => ({ value: role, label: roleTabLabel(role) })),
];

/** Tonal Aislix chart palette — navy/blue variations only. */
export const DASHBOARD_CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export const DASHBOARD_STATUS_COLORS = {
  critical: "bg-destructive/80",
  high: "bg-destructive/55",
  medium: "bg-warning/75",
  low: "bg-brand/60",
} as const;

/** Default trend series per role (spec § role-specific dashboard). */
export const ROLE_TREND_KPIS: Record<AuditRoleTab, AuditKpiId[]> = {
  supermarket: ["osa", "planogram_compliance", "assortment_compliance", "price_compliance", "promotional_compliance"],
  darkstore: ["osa", "location_accuracy", "planogram_compliance", "assortment_compliance", "facing_count"],
  fmcg: ["share_of_shelf", "osa", "planogram_compliance", "promotional_compliance"],
  distributor: ["osa", "msl_compliance", "planogram_compliance", "price_compliance", "promotional_compliance"],
  local: ["osa", "assortment_compliance", "facing_count", "price_compliance", "promotional_compliance"],
};

export const KPI_DASHBOARD_LABELS: Record<AuditKpiId, string> = {
  osa: "OSA",
  planogram_compliance: "Planogram Compliance",
  assortment_compliance: "Assortment Compliance",
  price_compliance: "Price Compliance",
  promotional_compliance: "Promotional Compliance",
  location_accuracy: "Location Accuracy",
  facing_count: "Facing Count",
  share_of_shelf: "Share of Shelf",
  msl_compliance: "MSL Compliance",
};

export const PRIORITY_OPPORTUNITY_CATEGORIES = [
  { key: "availability", label: "Availability" },
  { key: "placement", label: "Placement" },
  { key: "pricing", label: "Pricing" },
  { key: "promotion", label: "Promotions" },
  { key: "assortment", label: "Assortment" },
] as const;

export type PriorityCategory = (typeof PRIORITY_OPPORTUNITY_CATEGORIES)[number]["key"];

export const SHELF_HEALTH_TOOLTIP =
  "Composite score based on the role's configured shelf-performance metrics. Averaged from completed audits where a score was calculated — not an AI judgment.";

export function dateRangeToDays(range: DashboardDateRange): number {
  switch (range) {
    case "7d":
      return 7;
    case "90d":
      return 90;
    case "12m":
      return 365;
    default:
      return 30;
  }
}

export function effectiveDashboardRole(
  filterRole: DashboardRoleFilter,
  workspaceRole?: AuditRoleTab | string | null,
): AuditRoleTab {
  if (filterRole !== "all") return filterRole;
  const normalized = (workspaceRole ?? "supermarket").toLowerCase();
  const aliases: Record<string, AuditRoleTab> = {
    fmcg_brand: "fmcg",
    brand: "fmcg",
    dark_store: "darkstore",
    kirana: "local",
    local_store: "local",
  };
  const key = aliases[normalized] ?? normalized;
  return (AUDIT_ROLE_TABS as readonly string[]).includes(key) ? (key as AuditRoleTab) : "supermarket";
}

export function trendKpisForRole(role: AuditRoleTab): AuditKpiId[] {
  return ROLE_TREND_KPIS[role];
}
