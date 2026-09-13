/**
 * Workspace dashboard — centralized role configuration, chart palette, and copy.
 */

import type { AuditKpiId } from "@/lib/role-kpi-config";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import { AUDIT_ROLE_TABS, roleTabLabel } from "@/lib/role-audit-ui";

/** @deprecated use DashboardDatePreset from dashboard-filters */
export type DashboardDateRange = import("@/lib/dashboard-filters").DashboardDatePreset;

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
  "Composite score based on the eligible role-specific shelf KPIs in the selected view. Calculated from retail execution scores where sufficient audit evidence exists.";

export function dateRangeToDays(range: DashboardDateRange): number {
  switch (range) {
    case "today":
    case "yesterday":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    default:
      return 7;
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

/** Default chart toggles for performance-over-time (first three where available). */
export const DEFAULT_TREND_KPIS: AuditKpiId[] = [
  "osa",
  "planogram_compliance",
  "assortment_compliance",
];

export type RoleAttentionArea = {
  key: string;
  label: string;
  kpis: AuditKpiId[];
  issueCategories?: PriorityCategory[];
  /** FMCG brand & competition card — uses share-of-shelf + competitive insights when present. */
  competitive?: boolean;
};

/** Five attention cards per role — drives the intelligence row on the workspace dashboard. */
export const ROLE_ATTENTION_AREAS: Record<AuditRoleTab, RoleAttentionArea[]> = {
  supermarket: [
    { key: "osa", label: "On-Shelf Availability", kpis: ["osa"], issueCategories: ["availability"] },
    { key: "planogram", label: "Planogram Compliance", kpis: ["planogram_compliance"], issueCategories: ["placement"] },
    { key: "assortment", label: "Assortment Compliance", kpis: ["assortment_compliance"], issueCategories: ["assortment"] },
    { key: "price", label: "Price Compliance", kpis: ["price_compliance"], issueCategories: ["pricing"] },
    { key: "promotion", label: "Promotional Compliance", kpis: ["promotional_compliance"], issueCategories: ["promotion"] },
  ],
  darkstore: [
    { key: "osa", label: "On-Shelf Availability", kpis: ["osa"], issueCategories: ["availability"] },
    { key: "location_accuracy", label: "Location Accuracy", kpis: ["location_accuracy"] },
    { key: "planogram", label: "Planogram Compliance", kpis: ["planogram_compliance"], issueCategories: ["placement"] },
    { key: "assortment", label: "Assortment Compliance", kpis: ["assortment_compliance"], issueCategories: ["assortment"] },
    { key: "facing", label: "Facing Count", kpis: ["facing_count"] },
  ],
  fmcg: [
    { key: "share_of_shelf", label: "Share of Shelf", kpis: ["share_of_shelf"], issueCategories: ["placement"], competitive: true },
    { key: "osa", label: "On-Shelf Availability", kpis: ["osa"], issueCategories: ["availability"] },
    { key: "facing", label: "Facing Count", kpis: ["facing_count"] },
    { key: "planogram", label: "Planogram Compliance", kpis: ["planogram_compliance"], issueCategories: ["placement"] },
    { key: "promotion", label: "Promotional Compliance", kpis: ["promotional_compliance"], issueCategories: ["promotion"] },
  ],
  distributor: [
    { key: "osa", label: "On-Shelf Availability", kpis: ["osa"], issueCategories: ["availability"] },
    { key: "msl", label: "MSL Compliance", kpis: ["msl_compliance"], issueCategories: ["assortment"] },
    { key: "planogram", label: "Planogram Compliance", kpis: ["planogram_compliance"], issueCategories: ["placement"] },
    { key: "price", label: "Price Compliance", kpis: ["price_compliance"], issueCategories: ["pricing"] },
    { key: "promotion", label: "Promotional Compliance", kpis: ["promotional_compliance"], issueCategories: ["promotion"] },
  ],
  local: [
    { key: "osa", label: "On-Shelf Availability", kpis: ["osa"], issueCategories: ["availability"] },
    { key: "assortment", label: "Assortment Compliance", kpis: ["assortment_compliance"], issueCategories: ["assortment"] },
    { key: "facing", label: "Facing Count", kpis: ["facing_count"] },
    { key: "price", label: "Price Compliance", kpis: ["price_compliance"], issueCategories: ["pricing"] },
    { key: "promotion", label: "Promotional Compliance", kpis: ["promotional_compliance"], issueCategories: ["promotion"] },
  ],
};

export function attentionAreasForRole(role: AuditRoleTab): RoleAttentionArea[] {
  return ROLE_ATTENTION_AREAS[role];
}
