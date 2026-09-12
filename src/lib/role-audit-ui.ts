/**
 * Centralized role audit UI — five customer roles, section order, KPI chart types.
 * Calculation logic stays in execution-metrics / backend audit_kpi_dashboard.
 */

import type { AuditKpiId } from "@/lib/role-kpi-config";
import { ROLE_PROFILES, getRoleProfile, normalizeRoleId } from "@/lib/role-kpi-config";

/** The five shelf-audit customer roles (tabs). */
export type AuditRoleTab = "supermarket" | "darkstore" | "fmcg" | "distributor" | "local";

export const AUDIT_ROLE_TABS: AuditRoleTab[] = [
  "supermarket",
  "darkstore",
  "fmcg",
  "distributor",
  "local",
];

export type RoleAuditSectionKey =
  | "audit_header"
  | "role_intro"
  | "kpi_cards"
  | "kpi_charts"
  | "competitor_analysis"
  | "annotated_image"
  | "planogram_side_by_side"
  | "financial_impact"
  | "inventory"
  | "recommended_actions"
  | "fix_rescan"
  | "action_center";

/** Shared section order for every role (spec §9). */
export const ROLE_AUDIT_SECTIONS: RoleAuditSectionKey[] = [
  "audit_header",
  "role_intro",
  "kpi_cards",
  "kpi_charts",
  "competitor_analysis",
  "planogram_side_by_side",
  "financial_impact",
  "inventory",
  "recommended_actions",
  "fix_rescan",
  "action_center",
];

export type KpiChartKind =
  | "progress_bar"
  | "checklist"
  | "heatmap"
  | "stacked_bar"
  | "facing_bars"
  | "sos_stacked";

/** Chart type per KPI (spec §10). */
export const KPI_CHART_KIND: Record<AuditKpiId, KpiChartKind> = {
  osa: "progress_bar",
  planogram_compliance: "heatmap",
  assortment_compliance: "checklist",
  price_compliance: "progress_bar",
  promotional_compliance: "stacked_bar",
  location_accuracy: "heatmap",
  facing_count: "facing_bars",
  share_of_shelf: "sos_stacked",
  msl_compliance: "checklist",
};

export type RoleTabTheme = {
  tabActive: string;
  tabInactive: string;
  accentText: string;
  accentBorder: string;
  accentSoft: string;
};

const TAB_INACTIVE =
  "border border-border bg-background text-muted-foreground hover:border-brand/25 hover:bg-brand-soft/40 hover:text-foreground";

const TAB_ACTIVE = "bg-brand text-brand-foreground shadow-sm";

export const ROLE_TAB_THEME: Record<AuditRoleTab, RoleTabTheme> = {
  supermarket: {
    tabActive: TAB_ACTIVE,
    tabInactive: TAB_INACTIVE,
    accentText: "text-brand",
    accentBorder: "border-brand/20",
    accentSoft: "bg-brand-soft/50",
  },
  darkstore: {
    tabActive: TAB_ACTIVE,
    tabInactive: TAB_INACTIVE,
    accentText: "text-brand",
    accentBorder: "border-brand/20",
    accentSoft: "bg-brand-soft/50",
  },
  fmcg: {
    tabActive: TAB_ACTIVE,
    tabInactive: TAB_INACTIVE,
    accentText: "text-brand",
    accentBorder: "border-brand/20",
    accentSoft: "bg-brand-soft/50",
  },
  distributor: {
    tabActive: TAB_ACTIVE,
    tabInactive: TAB_INACTIVE,
    accentText: "text-brand",
    accentBorder: "border-brand/20",
    accentSoft: "bg-brand-soft/50",
  },
  local: {
    tabActive: TAB_ACTIVE,
    tabInactive: TAB_INACTIVE,
    accentText: "text-brand",
    accentBorder: "border-brand/20",
    accentSoft: "bg-brand-soft/40",
  },
};

export function roleTabLabel(role: AuditRoleTab): string {
  return getRoleProfile(role).label;
}

export function roleIntroduction(role: AuditRoleTab): string {
  return getRoleProfile(role).introduction;
}

export function primaryKpiIds(role: AuditRoleTab): AuditKpiId[] {
  return getRoleProfile(role).primary_kpis.map((k) => k.kpi_id);
}

export function normalizeAuditRoleTab(value?: string | null): AuditRoleTab {
  const key = normalizeRoleId(value);
  return (AUDIT_ROLE_TABS.includes(key as AuditRoleTab) ? key : "supermarket") as AuditRoleTab;
}

export function defaultAuditRoleTab(workspaceCustomerType?: string | null): AuditRoleTab {
  return normalizeAuditRoleTab(workspaceCustomerType);
}

/** Status colors — spec §10 (with text labels, not color-only). */
export const AUDIT_STATUS_COLORS = {
  pass: "text-success bg-success/10 border-success/25",
  fail: "text-destructive bg-destructive/10 border-destructive/25",
  needs_review: "text-amber-700 bg-amber-500/10 border-amber-500/25 dark:text-amber-300",
  not_assessable: "text-muted-foreground bg-muted border-border",
} as const;

export { ROLE_PROFILES, getRoleProfile };
