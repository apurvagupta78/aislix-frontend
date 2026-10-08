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
  assignment_state?: string | null;
  audit_mode?: string | null;
  scope_values?: unknown;
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
  date_from?: string | Date | null;
  date_to?: string | Date | null;
  limit?: number;
  include_completed_only?: boolean;
  audit_mode?: "ai" | "digital";
};

/** Assignment's own name (set at creation) or its template name. */
export function auditNameOf(row: AuthorizedAssignmentRow): string | null {
  const scope = row.scope_values;
  if (scope && typeof scope === "object" && !Array.isArray(scope)) {
    const name = (scope as Record<string, unknown>).audit_name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return row.audit_templates?.name ?? null;
}

export function auditModeLabel(mode: string | null | undefined): string {
  const value = String(mode ?? "").toLowerCase();
  if (value === "ai" || value === "ai_assisted") return "AI audit";
  return "Digital audit";
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Lower bound as ISO; null when absent or unparseable. */
export function toIsoLowerBound(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Exclusive upper bound as ISO. Date-only strings include the whole day. */
export function toIsoUpperBoundExclusive(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string" && DATE_ONLY.test(value.trim())) {
    const date = new Date(`${value.trim()}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return null;
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString();
  }
  return toIsoLowerBound(value);
}

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
  const dateFrom = toIsoLowerBound(input.date_from || bounds.from);
  const dateTo = toIsoUpperBoundExclusive(input.date_to || bounds.to);
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
      "id, scan_id, store_id, status, approval_status, assignment_state, audit_mode, scope_values, assignee_id, assigner_id, completed_at, due_at, created_at, template_id, audit_templates:template_id (name, audit_purpose, operating_model), stores:store_id (name, city, country)",
    )
    .eq("org_id", scope.orgId)
    .in("store_id", storeIds)
    .order("created_at", { ascending: false })
    .limit(limit * 3);

  if (input.assignment_id) query = query.eq("id", input.assignment_id);
  if (input.scan_id) query = query.eq("scan_id", input.scan_id);
  if (input.audit_mode === "ai") query = query.in("audit_mode", ["ai", "ai_assisted"]);
  if (input.audit_mode === "digital") query = query.eq("audit_mode", "digital");
  if (input.include_completed_only) {
    query = query.or("status.eq.completed,assignment_state.eq.submitted,approval_status.eq.approved");
  }
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lt("created_at", dateTo);

  const { data, error } = await query;
  if (error) console.error("[ask-aislix] scan_assignments lookup failed", error.message);
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
