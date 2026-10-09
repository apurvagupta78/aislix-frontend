/**
 * Corrective actions narrowed by the workspace filters (date, store, city, team, category, SKU),
 * for the AI and Digital dashboards, the SLA page and the Corrective actions page.
 */

import { supabase } from "@/integrations/supabase/client";
import { requireOrgId } from "@/lib/db/context";
import { fetchLifecycleActions, type LifecycleAction } from "@/lib/corrective-action-lifecycle";
import { resolvePeopleFilter, resolveStoreFilter, type ScopeFilters } from "@/lib/ai-dashboard-scope";
import { resolveDashboardDateBounds, type DashboardFilterState } from "@/lib/dashboard-filters";
import { resolveDemoExperience } from "@/lib/demo-environment";
import { fetchQuantityVerifications, type QuantityVerification } from "@/lib/audit-checks";

export type ActionFilters = ScopeFilters & Partial<Pick<DashboardFilterState, "datePreset" | "dateFrom" | "dateTo">>;

export type ActionSourceFilter = "ai" | "digital" | "all";

type Scope = {
  stores: Set<string> | null;
  people: Set<string> | null;
  from: Date | null;
  to: Date | null;
  sku: string;
  /** Scan ids in the selected category; null when no category is selected. */
  categoryScans?: Set<string> | null;
};

export function filterScopedActions(
  actions: LifecycleAction[],
  scope: Scope,
  source: ActionSourceFilter = "ai",
): LifecycleAction[] {
  const sku = scope.sku.trim().toLowerCase();
  return actions.filter((a) => {
    if (source !== "all" && a.source !== source) return false;
    if (scope.stores && !(a.store_id && scope.stores.has(a.store_id))) return false;
    if (scope.people && !(a.assigned_to && scope.people.has(a.assigned_to))) return false;
    if (scope.categoryScans && !(a.scan_id && scope.categoryScans.has(a.scan_id))) return false;
    const created = new Date(a.created_at).getTime();
    if (scope.from && created < scope.from.getTime()) return false;
    if (scope.to && created >= scope.to.getTime()) return false;
    if (sku && ![a.sku, a.title, a.suggestion].some((t) => (t ?? "").toLowerCase().includes(sku))) return false;
    return true;
  });
}

/** AI-only variant kept for existing callers and tests. */
export function filterAiActions(actions: LifecycleAction[], scope: Scope): LifecycleAction[] {
  return filterScopedActions(actions, scope, "ai");
}

async function categoryScanIds(orgId: string, category: string | undefined): Promise<Set<string> | null> {
  if (!category || category === "all") return null;
  const { data } = await supabase
    .from("shelf_scans")
    .select("id")
    .eq("org_id", orgId)
    .eq("category", category)
    .order("created_at", { ascending: false })
    .limit(2000);
  return new Set((data ?? []).map((r) => r.id as string));
}

async function resolveScope(orgId: string, filters?: ActionFilters) {
  const [stores, people, categoryScans] = await Promise.all([
    resolveStoreFilter(orgId, filters),
    resolvePeopleFilter(orgId, filters),
    categoryScanIds(orgId, filters?.category),
  ]);
  const bounds = resolveDashboardDateBounds({
    datePreset: filters?.datePreset ?? "all",
    dateFrom: filters?.dateFrom ?? "",
    dateTo: filters?.dateTo ?? "",
  } as DashboardFilterState);
  return { stores, people, categoryScans, from: bounds.from, to: bounds.to, sku: filters?.skuId ?? "" };
}

export type ScopedActions = { actions: LifecycleAction[]; verifications: QuantityVerification[] };

export async function fetchScopedActions(
  filters: ActionFilters | undefined,
  options: { source?: ActionSourceFilter; previewDemo?: boolean; userEmail?: string | null; demo?: boolean } = {},
): Promise<ScopedActions> {
  const activeOrgId = await requireOrgId();
  const orgId = options.demo
    ? (
        await resolveDemoExperience(activeOrgId, {
          previewDemo: options.previewDemo,
          userEmail: options.userEmail,
          honorPreviewOff: true,
        })
      ).dataOrgId
    : activeOrgId;
  const storeId = filters?.storeId && filters.storeId !== "all" ? filters.storeId : undefined;
  const [actions, scope] = await Promise.all([fetchLifecycleActions({ storeId, orgId }), resolveScope(orgId, filters)]);
  const source = options.source ?? "all";
  const verifications =
    source === "digital"
      ? []
      : await fetchQuantityVerifications({ orgId, stores: scope.stores, from: scope.from, to: scope.to });
  const scans = scope.categoryScans;
  return {
    actions: filterScopedActions(actions, scope, source),
    verifications: scans ? verifications.filter((v) => scans.has(v.scanId)) : verifications,
  };
}

export async function fetchAiDashboardActions(
  filters?: ActionFilters,
  options?: { previewDemo?: boolean; userEmail?: string | null },
): Promise<LifecycleAction[]> {
  const { actions } = await fetchScopedActions(filters, { ...options, source: "ai", demo: true });
  return actions;
}
