import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { DashboardFilterState } from "@/lib/dashboard-filters";
import { resolveDashboardDateBounds } from "@/lib/dashboard-filters";
import {
  computeUniversalDashboardFromRows,
  type AssignmentComputeRow,
} from "@/lib/kpi-engine/compute-universal";
import type { AskAislixAccessScope } from "@/lib/ask-aislix/ask-aislix.types";
import { clampFiltersToScope, storeIdsForQuery } from "@/lib/ask-aislix/context";
import type { ControlTowerDemoPayload } from "@/lib/control-tower/types";
import type { Finding } from "@/lib/findings";
import type { LifecycleAction } from "@/lib/corrective-action-lifecycle";

function scopeLabel(scopeValues: unknown, key: string, pluralKey: string): string {
  if (!scopeValues || typeof scopeValues !== "object") return "";
  const v = scopeValues as Record<string, unknown>;
  const plural = v[pluralKey];
  if (Array.isArray(plural) && plural.length) return plural.map(String).join(", ");
  const single = v[key];
  return single ? String(single) : "";
}

export async function fetchScopedControlTowerDataset(input: {
  supabase: SupabaseClient<Database>;
  scope: AskAislixAccessScope;
  filters: DashboardFilterState;
}): Promise<ControlTowerDemoPayload> {
  const { supabase, scope } = input;
  const filters = clampFiltersToScope(input.filters, scope);
  const bounds = resolveDashboardDateBounds(filters);
  let storeIds = storeIdsForQuery(scope, filters);

  if (filters.city && filters.city !== "all" && filters.city !== "__none__") {
    const { data: cityStores } = await supabase
      .from("stores")
      .select("id, city")
      .eq("org_id", scope.orgId)
      .eq("status", "active")
      .ilike("city", filters.city);
    const cityIds = new Set((cityStores ?? []).map((s) => s.id as string));
    storeIds = storeIds.filter((id) => cityIds.has(id));
  }

  if (filters.country && filters.country !== "all" && filters.country !== "__none__") {
    const { data: countryStores } = await supabase
      .from("stores")
      .select("id, country")
      .eq("org_id", scope.orgId)
      .eq("status", "active")
      .eq("country", filters.country);
    const countryIds = new Set((countryStores ?? []).map((s) => s.id as string));
    storeIds = storeIds.filter((id) => countryIds.has(id));
  }

  if (storeIds.length === 0) {
    return computeUniversalDashboardFromRows({
      model: "all",
      assignments: [],
      findings: [],
      actions: [],
    });
  }

  let assignmentQuery = supabase
    .from("scan_assignments")
    .select(
      "id, status, approval_status, store_id, due_at, created_at, assignee_id, assigner_id, template_id, scan_id, scope_values, stores:store_id (name, city)",
    )
    .eq("org_id", scope.orgId)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (storeIds.length === 1) assignmentQuery = assignmentQuery.eq("store_id", storeIds[0]!);
  else assignmentQuery = assignmentQuery.in("store_id", storeIds);

  if (bounds.upcoming) {
    assignmentQuery = assignmentQuery.gte("due_at", (bounds.from ?? new Date()).toISOString());
  } else {
    if (bounds.from) assignmentQuery = assignmentQuery.gte("created_at", bounds.from.toISOString());
    if (bounds.to) assignmentQuery = assignmentQuery.lt("created_at", bounds.to.toISOString());
  }

  let findingsQuery = supabase.from("findings").select("*").eq("org_id", scope.orgId).limit(2000);
  let actionsQuery = supabase
    .from("corrective_actions")
    .select("*")
    .eq("org_id", scope.orgId)
    .limit(2000);

  if (storeIds.length === 1) {
    findingsQuery = findingsQuery.eq("store_id", storeIds[0]!);
    actionsQuery = actionsQuery.eq("store_id", storeIds[0]!);
  } else if (storeIds.length > 1) {
    findingsQuery = findingsQuery.in("store_id", storeIds);
    actionsQuery = actionsQuery.in("store_id", storeIds);
  }

  const [{ data: assignmentRows }, { data: findingsRows }, { data: actionsRows }, { data: templates }] =
    await Promise.all([
      assignmentQuery,
      findingsQuery,
      actionsQuery,
      supabase.from("audit_templates").select("id, name, operating_model").eq("org_id", scope.orgId),
    ]);

  const templateById = new Map(
    (templates ?? []).map((t) => [
      t.id as string,
      { name: (t.name as string) || "Audit", operating_model: (t.operating_model as string | null) ?? null },
    ]),
  );

  const rawAssignments = (assignmentRows ?? []) as Array<{
    id: string;
    status: string;
    approval_status: string | null;
    store_id: string;
    due_at: string | null;
    created_at: string;
    assignee_id: string;
    assigner_id?: string | null;
    template_id: string | null;
    scan_id?: string | null;
    scope_values?: unknown;
    stores?: { name?: string | null; city?: string | null } | null;
  }>;

  if (!scope.isOrgAdmin) {
    const allow = new Set(scope.accessibleAssignmentIds);
    rawAssignments.splice(0, rawAssignments.length, ...rawAssignments.filter((r) => allow.has(r.id)));
  }

  const userIds = [...new Set(rawAssignments.map((r) => r.assignee_id).filter(Boolean))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const names = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || p.email || "Team member"]),
  );

  const assignments: AssignmentComputeRow[] = rawAssignments.map((row) => {
    const tpl = row.template_id ? templateById.get(row.template_id) : undefined;
    return {
      id: row.id,
      status: row.status,
      approval_status: row.approval_status,
      store_id: row.store_id,
      store_name: row.stores?.name ?? "Store",
      due_at: row.due_at,
      created_at: row.created_at,
      assignee_id: row.assignee_id,
      assignee_name: names.get(row.assignee_id) ?? "Team member",
      template_id: row.template_id,
      template_name: tpl?.name ?? "Audit",
      operating_model: tpl?.operating_model ?? null,
      city: row.stores?.city ?? "",
      scan_id: row.scan_id ?? null,
      category: scopeLabel(row.scope_values, "category", "categories"),
      sub_category: scopeLabel(row.scope_values, "sub_category", "sub_categories"),
      assigner_id: row.assigner_id ?? null,
    };
  });

  const storeAllow = new Set(storeIds);
  const assignmentIds = new Set(assignments.map((a) => a.id));

  const findings = ((findingsRows ?? []) as Finding[]).filter((f) => {
    if (f.store_id && !storeAllow.has(f.store_id)) return false;
    if (!scope.isOrgAdmin && f.assignment_id && !assignmentIds.has(f.assignment_id)) return false;
    return true;
  });

  const actions = ((actionsRows ?? []) as LifecycleAction[]).filter((a) => {
    if (a.store_id && !storeAllow.has(a.store_id)) return false;
    return true;
  });

  return computeUniversalDashboardFromRows({
    model: "all",
    assignments,
    findings,
    actions,
    bounds,
  });
}
