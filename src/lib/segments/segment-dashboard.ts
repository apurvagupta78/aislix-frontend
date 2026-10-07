/**
 * Segment home dashboard data — one `segment_dashboard` RPC call over completed AI audits.
 * Demo-aware (showcase org when Demo Data is on) and store-scoped for non-admin members.
 */

import { supabase } from "@/integrations/supabase/client";
import { getUser, requireOrgId } from "@/lib/db/context";
import { resolveDemoExperience } from "@/lib/demo-environment";
import { resolveDashboardDateBounds, type DashboardFilterState } from "@/lib/dashboard-filters";

type Num = number | null;

export type SegmentDashboardTotals = {
  audits: number;
  stores: number;
  /** Audits where the AI read the shelf — counts below only come from these. */
  shelf_read_audits: number;
  avg_osa: Num;
  avg_sos: Num;
  avg_health: Num;
  avg_planogram: Num;
  planogram_audits: number;
  facings: Num;
  gaps: Num;
  low_stock: Num;
  misplaced: Num;
  at_risk_skus: Num;
  value_gap_inr: Num;
  priced_audits: number;
  gps_audits: number;
  sweep_audits: number;
};

export type SegmentDashboardTrendPoint = {
  week: string;
  audits: number;
  avg_osa: Num;
  avg_sos: Num;
  avg_health: Num;
  gaps: Num;
  low_stock: Num;
};

export type SegmentDashboardStore = {
  store_id: string | null;
  store_name: string;
  store_type: string | null;
  city: string | null;
  audits: number;
  last_audit: string;
  avg_osa: Num;
  avg_sos: Num;
  avg_health: Num;
  gaps: Num;
  low_stock: Num;
  misplaced: Num;
  value_gap_inr: Num;
  gps_audits: number;
};

export type SegmentDashboardBrand = { brand: string; avg_share: Num; audits_seen: number };

export type SegmentDashboard = {
  from: string;
  to: string;
  totals: SegmentDashboardTotals;
  previous: Partial<SegmentDashboardTotals>;
  trend: SegmentDashboardTrendPoint[];
  stores: SegmentDashboardStore[];
  brands: SegmentDashboardBrand[];
  brand_audits: number;
  actions: {
    open: number;
    overdue: number;
    critical_open: number;
    created_in_period: number;
    closed_in_period: number;
  };
};

export type SegmentDashboardResult = {
  data: SegmentDashboard | null;
  labeledDemo: boolean;
  periodLabel: string;
  /** Signed-in user has no stores in scope — show an empty state, never org-wide data. */
  outOfScope: boolean;
};

const DAY_MS = 86_400_000;
const DEFAULT_WINDOW_DAYS = 90;

type PeriodFilters = Pick<DashboardFilterState, "datePreset" | "dateFrom" | "dateTo"> & {
  storeId?: string;
};

/** Period to summarise. "All time" and open-ended ranges fall back to the last 90 days so deltas stay meaningful. */
export function resolveSegmentPeriod(
  filters: PeriodFilters | null | undefined,
  now: Date = new Date(),
): { from: Date; to: Date; label: string } {
  const bounds = filters
    ? resolveDashboardDateBounds({
        datePreset: filters.datePreset ?? "all",
        dateFrom: filters.dateFrom ?? "",
        dateTo: filters.dateTo ?? "",
      } as DashboardFilterState)
    : null;
  if (bounds?.from && bounds.to && !bounds.upcoming && bounds.to > bounds.from) {
    const days = Math.max(1, Math.round((bounds.to.getTime() - bounds.from.getTime()) / DAY_MS));
    return { from: bounds.from, to: bounds.to, label: days === 1 ? "Selected day" : `Selected ${days} days` };
  }
  return {
    from: new Date(now.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS),
    to: now,
    label: `Last ${DEFAULT_WINDOW_DAYS} days`,
  };
}

export type SegmentScope =
  | { signedIn: false }
  | {
      signedIn: true;
      activeOrgId: string;
      dataOrgId: string;
      labeledDemo: boolean;
      /** null = every store the caller can read. */
      storeIds: string[] | null;
      outOfScope: boolean;
    };

/** Which org's data to read (Demo Data toggle) and which stores the signed-in member may see. */
export async function resolveSegmentScope(
  storeId: string | null | undefined,
  options: { previewDemo?: boolean; userEmail?: string | null },
): Promise<SegmentScope> {
  const user = await getUser();
  if (!user) return { signedIn: false };

  const activeOrgId = await requireOrgId();
  const experience = await resolveDemoExperience(activeOrgId, {
    previewDemo: options.previewDemo,
    userEmail: options.userEmail,
  });
  const base = {
    signedIn: true as const,
    activeOrgId,
    dataOrgId: experience.dataOrgId,
    labeledDemo: experience.labeledDemo,
  };

  if (experience.labeledDemo) {
    return { ...base, storeIds: storeId && storeId !== "all" ? [storeId] : null, outOfScope: false };
  }

  const { resolveEffectiveAccessScope, clampStoreIdToScope, OUT_OF_SCOPE_STORE } = await import(
    "@/lib/access-scope"
  );
  const scope = await resolveEffectiveAccessScope({ orgId: activeOrgId });
  if (!scope.isOrgAdmin && !scope.hasStoreScope) return { ...base, storeIds: null, outOfScope: true };
  const picked = clampStoreIdToScope(storeId ?? undefined, scope);
  if (picked === OUT_OF_SCOPE_STORE) return { ...base, storeIds: null, outOfScope: true };
  if (picked && picked !== "all") return { ...base, storeIds: [picked], outOfScope: false };
  return { ...base, storeIds: scope.isOrgAdmin ? null : scope.effectiveStoreIds, outOfScope: false };
}

export async function fetchSegmentDashboard(
  filters: PeriodFilters | null | undefined,
  options: { previewDemo?: boolean; userEmail?: string | null },
): Promise<SegmentDashboardResult> {
  const period = resolveSegmentPeriod(filters);
  const scope = await resolveSegmentScope(filters?.storeId, options);
  if (!scope.signedIn) return { data: null, labeledDemo: true, periodLabel: period.label, outOfScope: false };
  if (scope.outOfScope) {
    return { data: null, labeledDemo: scope.labeledDemo, periodLabel: period.label, outOfScope: true };
  }

  const { data, error } = await supabase.rpc("segment_dashboard" as never, {
    p_org_id: scope.dataOrgId,
    p_from: period.from.toISOString(),
    p_to: period.to.toISOString(),
    // The dashboard store filter lists the member's own stores, which never exist in the demo org.
    p_store_ids: scope.labeledDemo ? null : scope.storeIds,
  } as never);
  if (error) throw new Error(error.message);

  return {
    data: (data as unknown as SegmentDashboard | null) ?? null,
    labeledDemo: scope.labeledDemo,
    periodLabel: period.label,
    outOfScope: false,
  };
}
