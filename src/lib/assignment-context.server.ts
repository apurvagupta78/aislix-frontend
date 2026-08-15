/**
 * Assignment context for the scan setup form.
 *
 * Assignees are frequently org members whose membership row is still `invited`
 * (they were assigned work before accepting), which RLS hides `stores` and
 * `planogram_items` from. The scan form still has to show the store name, the
 * scoped category / sub-category and the expected product count, so this loader
 * verifies the caller is the assignee (or an org manager) and then reads the
 * supporting rows with the privileged client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type DB = SupabaseClient<Database>;

export type AssignmentScopeType = "category" | "sub_category" | "location" | "planogram";

export type AssignmentScanContext = {
  assignment_id: string;
  org_id: string;
  store_id: string;
  store_name: string;
  planogram_version_id: string | null;
  scope_type: AssignmentScopeType;
  scope_values: {
    category?: string;
    sub_category?: string;
    location?: string;
    product_count?: number;
    facing_count?: number;
  };
  category: string;
  sub_category: string;
  location: string;
  expected_count: number;
  /** Total expected facings across the scoped rows. */
  facing_count: number;
  status: string;
  instructions: string | null;
  due_at: string | null;
  assigner_name: string;
};

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

function mode(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function matchesScope(
  item: { category: string; sub_category: string; location: string; aisle: string },
  type: string,
  scope: { category?: string; sub_category?: string; location?: string },
): boolean {
  // Planogram assignments carry their own exact product list — never filter.
  if (type === "planogram") return true;
  const eq = (a: string, b?: string) =>
    Boolean(b) && a.toLowerCase() === String(b).trim().toLowerCase();
  if (type === "location") return eq(item.location, scope.location) || eq(item.aisle, scope.location);
  if (type === "sub_category")
    return eq(item.category, scope.category) && eq(item.sub_category, scope.sub_category);
  return eq(item.category, scope.category);
}

export async function loadAssignmentScanContext(
  userSupabase: DB,
  userId: string,
  assignmentId: string,
): Promise<AssignmentScanContext | null> {
  // The assignee can always read their own assignment row under RLS.
  const { data: assignment } = await userSupabase
    .from("scan_assignments")
    .select(
      "id, org_id, store_id, assignee_id, assigner_id, scope_type, scope_values, status, instructions, due_at, planogram_version_id",
    )
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment) return null;
  if (assignment.assignee_id !== userId) {
    // Managers may preview; RLS already allowed the read, so nothing more to check.
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const scope = (assignment.scope_values ?? {}) as {
    category?: string;
    sub_category?: string;
    location?: string;
  };
  const scopeType = (String(assignment.scope_type ?? "category") || "category") as
    | "category"
    | "sub_category"
    | "location";

  let versionId = (assignment.planogram_version_id as string | null) ?? null;
  if (!versionId) {
    const { data: version } = await supabaseAdmin
      .from("planogram_versions")
      .select("id")
      .eq("org_id", assignment.org_id)
      .eq("store_id", assignment.store_id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    versionId = (version?.id as string | null) ?? null;
  }

  const [{ data: store }, { data: itemRows }, { data: assigner }] = await Promise.all([
    supabaseAdmin.from("stores").select("name").eq("id", assignment.store_id).maybeSingle(),
    versionId
      ? supabaseAdmin
          .from("planogram_items")
          .select("category, sub_category, location, aisle")
          .eq("version_id", versionId)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", assignment.assigner_id)
      .maybeSingle(),
  ]);

  const items = ((itemRows ?? []) as Record<string, unknown>[]).map((row) => ({
    category: str(row["category"]),
    sub_category: str(row["sub_category"]),
    location: str(row["location"]),
    aisle: str(row["aisle"]),
  }));
  const scoped = items.filter((item) => matchesScope(item, scopeType, scope));
  const effective = scoped.length ? scoped : items;

  return {
    assignment_id: assignment.id as string,
    org_id: assignment.org_id as string,
    store_id: assignment.store_id as string,
    store_name: str(store?.name) || "Store",
    planogram_version_id: versionId,
    scope_type: scopeType,
    scope_values: scope,
    category: str(scope.category) || mode(effective.map((item) => item.category)),
    sub_category: str(scope.sub_category) || mode(effective.map((item) => item.sub_category)),
    location:
      str(scope.location) ||
      mode(effective.map((item) => item.location)) ||
      mode(effective.map((item) => item.aisle)),
    expected_count: scoped.length || items.length,
    status: String(assignment.status ?? "pending"),
    instructions: (assignment.instructions as string | null) ?? null,
    due_at: (assignment.due_at as string | null) ?? null,
    assigner_name:
      str(assigner?.full_name) || str(assigner?.email) || "your manager",
  };
}
