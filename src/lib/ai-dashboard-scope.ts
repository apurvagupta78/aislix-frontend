/**
 * Dashboard filters that need a lookup before they can be applied to scans, assignments and
 * actions: geography → store ids, team / team member → user ids, SKU text → scan ids.
 */

import { supabase } from "@/integrations/supabase/client";
import type { DashboardFilterState } from "@/lib/dashboard-filters";

export type ScopeFilters = Partial<
  Pick<DashboardFilterState, "storeId" | "country" | "city" | "teamMemberId" | "teamManagerId" | "skuId" | "category">
>;

type ReportingRow = { user_id: string; reports_to: string | null };

function active(value: string | null | undefined): value is string {
  return Boolean(value && value !== "all" && value.trim());
}

/** The manager plus everyone who reports to them, directly or indirectly. */
export function teamUserIds(members: ReportingRow[], managerId: string): Set<string> {
  const team = new Set<string>([managerId]);
  let added = true;
  while (added) {
    added = false;
    for (const m of members) {
      if (m.reports_to && team.has(m.reports_to) && !team.has(m.user_id)) {
        team.add(m.user_id);
        added = true;
      }
    }
  }
  return team;
}

export async function loadReporting(orgId: string): Promise<ReportingRow[]> {
  const { data } = await supabase
    .from("organization_members")
    .select("user_id, reports_to_user_id")
    .eq("org_id", orgId)
    .eq("status", "active");
  return (data ?? []).map((r) => ({
    user_id: r.user_id as string,
    reports_to: (r.reports_to_user_id as string | null) ?? null,
  }));
}

/** User ids allowed by the team / team member filters; null when neither is set. */
export async function resolvePeopleFilter(orgId: string, filters?: ScopeFilters): Promise<Set<string> | null> {
  const member = active(filters?.teamMemberId) ? filters!.teamMemberId! : null;
  const manager = active(filters?.teamManagerId) ? filters!.teamManagerId! : null;
  if (!member && !manager) return null;
  let people: Set<string> | null = null;
  if (manager) people = teamUserIds(await loadReporting(orgId), manager);
  if (member) people = people ? new Set(people.has(member) ? [member] : []) : new Set([member]);
  return people;
}

/** Store ids allowed by the store / country / city filters; null when none is set. */
export async function resolveStoreFilter(orgId: string, filters?: ScopeFilters): Promise<Set<string> | null> {
  const country = active(filters?.country) ? filters.country : null;
  const city = active(filters?.city) ? filters.city : null;
  const storeId = active(filters?.storeId) ? filters.storeId : null;
  if (!country && !city) return storeId ? new Set([storeId]) : null;
  let q = supabase.from("stores").select("id, city, country").eq("org_id", orgId);
  if (country && country !== "No country") q = q.eq("country", country);
  if (city && city !== "No city") q = q.eq("city", city);
  const { data } = await q;
  const ids = new Set((data ?? [])
    .filter((s) => country !== "No country" || !s.country?.trim())
    .filter((s) => city !== "No city" || !s.city?.trim())
    .map((s) => s.id as string));
  if (storeId) return new Set(ids.has(storeId) ? [storeId] : []);
  return ids;
}

/** Text safe to place inside a PostgREST or() / ilike filter. */
export function searchText(value: string | null | undefined): string {
  return String(value ?? "").replace(/[%*,()\\"']/g, " ").trim();
}

/** Of these scans, the ones with a detected product whose name, brand or variant contains the SKU text. */
export async function scanIdsMatchingSku(scanIds: string[], sku: string): Promise<Set<string>> {
  const text = searchText(sku);
  if (!text || !scanIds.length) return new Set(scanIds);
  const { data } = await supabase
    .from("detected_products")
    .select("scan_id")
    .in("scan_id", scanIds.slice(0, 200))
    .or(`name.ilike.%${text}%,brand.ilike.%${text}%,variant.ilike.%${text}%`);
  return new Set((data ?? []).map((r) => r.scan_id as string));
}

/** Assignee per scan, for team filters on scans that came from an assignment. */
export async function assigneeByScan(scanIds: string[]): Promise<Map<string, string | null>> {
  if (!scanIds.length) return new Map();
  const { data } = await supabase
    .from("scan_assignments")
    .select("scan_id, assignee_id")
    .in("scan_id", scanIds.slice(0, 300));
  return new Map((data ?? []).map((r) => [r.scan_id as string, (r.assignee_id as string | null) ?? null]));
}

/** The person who did the audit: the assignee when it was assigned, else whoever started the scan. */
export function auditorOf(scan: { id: string; created_by?: string | null }, assignees: Map<string, string | null>): string | null {
  return assignees.get(scan.id) ?? scan.created_by ?? null;
}
