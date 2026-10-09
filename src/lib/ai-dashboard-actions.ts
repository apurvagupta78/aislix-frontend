/**
 * Corrective actions raised by AI audits, narrowed by the dashboard filters.
 */

import { requireOrgId } from "@/lib/db/context";
import { fetchLifecycleActions, type LifecycleAction } from "@/lib/corrective-action-lifecycle";
import { resolvePeopleFilter, resolveStoreFilter, type ScopeFilters } from "@/lib/ai-dashboard-scope";
import { resolveDashboardDateBounds, type DashboardFilterState } from "@/lib/dashboard-filters";
import { resolveDemoExperience } from "@/lib/demo-environment";

export type ActionFilters = ScopeFilters & Partial<Pick<DashboardFilterState, "datePreset" | "dateFrom" | "dateTo">>;

export function filterAiActions(
  actions: LifecycleAction[],
  scope: { stores: Set<string> | null; people: Set<string> | null; from: Date | null; to: Date | null; sku: string },
): LifecycleAction[] {
  const sku = scope.sku.trim().toLowerCase();
  return actions.filter((a) => {
    if (a.source !== "ai") return false;
    if (scope.stores && !(a.store_id && scope.stores.has(a.store_id))) return false;
    if (scope.people && !(a.assigned_to && scope.people.has(a.assigned_to))) return false;
    const created = new Date(a.created_at).getTime();
    if (scope.from && created < scope.from.getTime()) return false;
    if (scope.to && created >= scope.to.getTime()) return false;
    if (sku && ![a.sku, a.title, a.suggestion].some((t) => (t ?? "").toLowerCase().includes(sku))) return false;
    return true;
  });
}

export async function fetchAiDashboardActions(
  filters?: ActionFilters,
  options?: { previewDemo?: boolean; userEmail?: string | null },
): Promise<LifecycleAction[]> {
  const activeOrgId = await requireOrgId();
  const experience = await resolveDemoExperience(activeOrgId, {
    previewDemo: options?.previewDemo,
    userEmail: options?.userEmail,
    honorPreviewOff: true,
  });
  const orgId = experience.dataOrgId;
  const storeId = filters?.storeId && filters.storeId !== "all" ? filters.storeId : undefined;
  const [actions, stores, people] = await Promise.all([
    fetchLifecycleActions({ storeId, orgId }),
    resolveStoreFilter(orgId, filters),
    resolvePeopleFilter(orgId, filters),
  ]);
  const bounds = resolveDashboardDateBounds({
    datePreset: filters?.datePreset ?? "all",
    dateFrom: filters?.dateFrom ?? "",
    dateTo: filters?.dateTo ?? "",
  } as DashboardFilterState);
  return filterAiActions(actions, {
    stores,
    people,
    from: bounds.from,
    to: bounds.to,
    sku: filters?.skuId ?? "",
  });
}
