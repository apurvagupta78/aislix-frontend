import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { DashboardFilterState } from "@/lib/dashboard-filters";
import { resolveDashboardDateBounds } from "@/lib/dashboard-filters";
import {
  ACCESS_DENIED_MESSAGE,
  type AskAislixAccessScope,
} from "@/lib/ask-aislix/ask-aislix.types";
import { clampFiltersToScope, resolveStoreQuery, storeIdsForQuery } from "@/lib/ask-aislix/context";

export type AuditParticipation = "all" | "assigned_to_me" | "conducted_by_me";

export type AuthorizedAssignmentRow = {
  id: string;
  scan_id: string | null;
  store_id: string;
  status: string;
  approval_status: string;
  assignee_id: string;
  assigner_id: string;
  completed_at: string | null;
  due_at: string | null;
  created_at: string;
  template_id: string | null;
  audit_templates?: { name?: string; audit_purpose?: string; operating_model?: string } | null;
  stores?: { name?: string; city?: string; country?: string } | null;
};

export type ResolveAssignmentsInput = {
  participation?: AuditParticipation;
  store_query?: string;
  store_id?: string;
  assignment_id?: string;
  scan_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  include_completed_only?: boolean;
};

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function assertScanAuthorized(scope: AskAislixAccessScope, scanId: string): boolean {
  return scope.accessibleScanIds.includes(scanId) || scope.conductedScanIds.includes(scanId);
}

export function assertAssignmentAuthorized(scope: AskAislixAccessScope, assignmentId: string): boolean {
  if (scope.isOrgAdmin) return true;
  return (
    scope.accessibleAssignmentIds.includes(assignmentId) ||
    scope.assignedToUserAssignmentIds.includes(assignmentId) ||
    scope.conductedAssignmentIds.includes(assignmentId)
  );
}

export async function loadAuthorizedStores(
  supabase: SupabaseClient<Database>,
  scope: AskAislixAccessScope,
) {
  const { data } = await supabase
    .from("stores")
    .select("id, name, city, country")
    .eq("org_id", scope.orgId)
    .eq("status", "active")
    .in("id", scope.allowedStoreIds.length ? scope.allowedStoreIds : ["00000000-0000-0000-0000-000000000000"]);
  return (data ?? []) as { id: string; name: string; city: string | null; country: string | null }[];
}

export async function resolveAuthorizedAssignments(
  supabase: SupabaseClient<Database>,
  scope: AskAislixAccessScope,
  filters: DashboardFilterState,
  input: ResolveAssignmentsInput = {},
): Promise<{ assignments: AuthorizedAssignmentRow[]; storeIds: string[] }> {
  const clamped = clampFiltersToScope(filters, scope);
  const bounds = resolveDashboardDateBounds(clamped);
  const dateFrom = input.date_from ?? bounds.from;
  const dateTo = input.date_to ?? bounds.to;
  const participation = input.participation ?? "all";
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);

  let storeIds = storeIdsForQuery(scope, clamped);
  const stores = await loadAuthorizedStores(supabase, scope);

  if (input.store_id) {
    if (!scope.allowedStoreIds.includes(input.store_id)) {
      return { assignments: [], storeIds: [] };
    }
    storeIds = [input.store_id];
  } else if (input.store_query?.trim()) {
    const match = resolveStoreQuery(scope, stores, input.store_query);
    if (!match) return { assignments: [], storeIds: [] };
    storeIds = [match.id];
  }

  if (!storeIds.length) return { assignments: [], storeIds: [] };

  if (input.assignment_id && !assertAssignmentAuthorized(scope, input.assignment_id)) {
    return { assignments: [], storeIds: [] };
  }

  if (input.scan_id && !assertScanAuthorized(scope, input.scan_id)) {
    return { assignments: [], storeIds: [] };
  }

  let query = supabase
    .from("scan_assignments")
    .select(
      "id, scan_id, store_id, status, approval_status, assignee_id, assigner_id, completed_at, due_at, created_at, template_id, audit_templates:template_id (name, audit_purpose, operating_model), stores:store_id (name, city, country)",
    )
    .eq("org_id", scope.orgId)
    .in("store_id", storeIds)
    .order("created_at", { ascending: false })
    .limit(limit * 3);

  if (input.assignment_id) query = query.eq("id", input.assignment_id);
  if (input.scan_id) query = query.eq("scan_id", input.scan_id);
  if (input.include_completed_only) {
    query = query.in("status", ["Completed", "Approved", "Submitted"]);
  }
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);

  const { data } = await query;
  let rows = (data ?? []) as AuthorizedAssignmentRow[];

  if (!scope.isOrgAdmin) {
    rows = rows.filter((row) => assertAssignmentAuthorized(scope, row.id));
  }

  if (participation === "assigned_to_me") {
    rows = rows.filter((row) => row.assignee_id === scope.userId);
  } else if (participation === "conducted_by_me") {
    const conducted = new Set(scope.conductedScanIds);
    rows = rows.filter((row) => row.scan_id && conducted.has(row.scan_id));
  }

  return { assignments: rows.slice(0, limit), storeIds };
}

export async function resolveAuthorizedScanIds(
  supabase: SupabaseClient<Database>,
  scope: AskAislixAccessScope,
  filters: DashboardFilterState,
  input: ResolveAssignmentsInput = {},
): Promise<string[]> {
  const { assignments } = await resolveAuthorizedAssignments(supabase, scope, filters, input);
  const scanIds = uniqueStrings(assignments.map((a) => a.scan_id ?? ""));

  if (input.participation === "conducted_by_me") {
    return scanIds.filter((id) => scope.conductedScanIds.includes(id));
  }

  if (scope.isOrgAdmin) return scanIds;

  return scanIds.filter((id) => assertScanAuthorized(scope, id));
}

export function unauthorizedResult(reason = ACCESS_DENIED_MESSAGE) {
  return { available: false as const, reason };
}
