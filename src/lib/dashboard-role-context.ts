/**
 * Workspace dashboard — role as primary context (not a filter).
 */

import type { DashboardFilterState } from "@/lib/dashboard-filters";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/dashboard-filters";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import { AUDIT_ROLE_TABS, roleTabLabel } from "@/lib/role-audit-ui";

export type DashboardRoleContext = {
  role: AuditRoleTab;
  title: string;
  subtitle: string;
  positioning: string;
  supporting: string;
  performanceEyebrow: string;
  performanceDescription: string;
  attentionDescription: string;
};

export const DASHBOARD_ROLE_CONTEXT: Record<AuditRoleTab, DashboardRoleContext> = {
  supermarket: {
    role: "supermarket",
    title: "Supermarket Dashboard",
    subtitle: "See how your stores are performing.",
    positioning: "Store execution and shelf availability",
    supporting:
      "Track availability, shelf execution, assortment, pricing and promotions across your stores.",
    performanceEyebrow: "Retail performance",
    performanceDescription:
      "On-shelf availability, planogram, assortment, pricing and promotional compliance for your stores.",
    attentionDescription:
      "Availability, shelf execution, assortment, pricing and promotions needing attention in this view.",
  },
  darkstore: {
    role: "darkstore",
    title: "Dark Store Dashboard",
    subtitle: "Track availability, location accuracy and shelf execution.",
    positioning: "Availability, location accuracy and shelf execution",
    supporting:
      "Track whether products are available, in the right locations and correctly placed across your dark stores.",
    performanceEyebrow: "Dark store performance",
    performanceDescription:
      "On-shelf availability, location accuracy, planogram, assortment and facing metrics for your dark stores.",
    attentionDescription:
      "Availability, location accuracy, planogram, assortment and facing gaps in this view.",
  },
  fmcg: {
    role: "fmcg",
    title: "FMCG Brand Dashboard",
    subtitle: "Track brand presence and shelf execution.",
    positioning: "Brand presence, shelf share and competitive execution",
    supporting:
      "Track your brand's shelf presence, availability, facings, planogram execution and promotional compliance.",
    performanceEyebrow: "Brand performance",
    performanceDescription:
      "Share of shelf, availability, facings, planogram and promotional compliance for your brand.",
    attentionDescription:
      "Share of shelf, availability, facings, planogram and promotions needing attention in this view.",
  },
  distributor: {
    role: "distributor",
    title: "Distributor Dashboard",
    subtitle: "Track outlet execution and must-stock compliance.",
    positioning: "Outlet execution and must-stock compliance",
    supporting:
      "Track availability, must-stock execution, shelf placement, pricing and promotions across your outlets.",
    performanceEyebrow: "Outlet performance",
    performanceDescription:
      "On-shelf availability, MSL, planogram, pricing and promotional compliance across outlets.",
    attentionDescription:
      "Availability, MSL, planogram, pricing and promotions needing attention in this view.",
  },
  local: {
    role: "local",
    title: "Local Store Dashboard",
    subtitle: "Track shelf availability and everyday execution.",
    positioning: "Availability and everyday shelf execution",
    supporting:
      "Track availability, assortment, facings, prices and promotions across local stores.",
    performanceEyebrow: "Local store performance",
    performanceDescription:
      "On-shelf availability, assortment, facings, pricing and promotional compliance for local stores.",
    attentionDescription:
      "Availability, assortment, facings, pricing and promotions needing attention in this view.",
  },
};

export const DASHBOARD_ROLE_URL_SLUGS: Record<AuditRoleTab, string> = {
  supermarket: "supermarket",
  darkstore: "dark-store",
  fmcg: "fmcg-brand",
  distributor: "distributor",
  local: "local-store",
};

const SLUG_TO_ROLE = Object.fromEntries(
  Object.entries(DASHBOARD_ROLE_URL_SLUGS).map(([role, slug]) => [slug, role]),
) as Record<string, AuditRoleTab>;

const LEGACY_SLUGS: Record<string, AuditRoleTab> = {
  darkstore: "darkstore",
  fmcg: "fmcg",
  local: "local",
  brand: "fmcg",
  fmcg_brand: "fmcg",
  dark_store: "darkstore",
  local_store: "local",
};

export function dashboardRoleToSlug(role: AuditRoleTab): string {
  return DASHBOARD_ROLE_URL_SLUGS[role];
}

export function parseDashboardRoleSlug(value: unknown): AuditRoleTab | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const key = value.trim().toLowerCase();
  if (SLUG_TO_ROLE[key]) return SLUG_TO_ROLE[key];
  if (LEGACY_SLUGS[key]) return LEGACY_SLUGS[key];
  if ((AUDIT_ROLE_TABS as readonly string[]).includes(key)) return key as AuditRoleTab;
  return null;
}

export function dashboardRoleContext(role: AuditRoleTab): DashboardRoleContext {
  return DASHBOARD_ROLE_CONTEXT[role];
}

export function applyDashboardRoleChange(
  filters: DashboardFilterState,
  role: AuditRoleTab,
): DashboardFilterState {
  return {
    ...filters,
    role,
    storeId: "all",
    category: "all",
    subCategory: "all",
    teamMemberId: "all",
    kri: "all",
  };
}

export function clearDashboardFiltersPreservingRole(
  filters: DashboardFilterState,
): DashboardFilterState {
  return {
    ...DEFAULT_DASHBOARD_FILTERS,
    role: filters.role,
  };
}

export function dashboardRoleLabel(role: AuditRoleTab): string {
  return roleTabLabel(role);
}
