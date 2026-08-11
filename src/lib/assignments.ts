/**
 * Assigned Scans — Milestone 2.
 *
 * Managers (owner / admin / manager) assign a scan scope to any active member
 * of their organization; assignees see their tasks on /my-scans.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, getMembership, requireOrgId, requireUserId } from "@/lib/db/context";

export type ScopeType = "category" | "sub_category" | "location";

export type ScopeValues = {
  category?: string;
  sub_category?: string;
  location?: string;
};

export type AssignmentStatus = "pending" | "in_progress" | "completed" | "cancelled";

export type AssignableMember = {
  user_id: string;
  role: string;
  name: string;
  email: string;
};

export type Assignment = {
  id: string;
  store_id: string;
  store_name: string;
  scope_type: ScopeType;
  scope_values: ScopeValues;
  status: AssignmentStatus;
  due_at: string | null;
  instructions: string | null;
  created_at: string;
  assignee_id: string;
  assignee_name: string;
  assigner_id: string;
  assigner_name: string;
  expected_products: number;
  planogram_version_id: string | null;
};

export const MANAGER_ROLES = ["owner", "admin", "manager"] as const;

export function scopeSummary(type: ScopeType, values: ScopeValues): string {
  if (type === "location") return `Location · ${values.location ?? "—"}`;
  if (type === "sub_category")
    return `${values.category ?? "—"} · ${values.sub_category ?? "—"}`;
  return `Category · ${values.category ?? "—"}`;
}

export async function isOrgManager(): Promise<boolean> {
  const membership = await getMembership();
  const role = String(membership?.role ?? "").toLowerCase();
  return (MANAGER_ROLES as readonly string[]).includes(role);
}

/** Every active member of the org except the signed-in user. */
export async function fetchAssignableMembers(): Promise<AssignableMember[]> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id, role, invited_email, profiles:user_id (full_name, email)")
    .eq("org_id", orgId)
    .eq("status", "active")
    .neq("user_id", userId);
  if (error) dbError(error, "Could not load your team members.");

  return (data ?? []).map((row) => {
    const profile = (row as { profiles?: { full_name?: string | null; email?: string | null } | null })
      .profiles;
    const email = profile?.email ?? (row as { invited_email?: string | null }).invited_email ?? "";
    return {
      user_id: row.user_id as string,
      role: String(row.role),
      name: profile?.full_name?.trim() || email || "Team member",
      email,
    };
  });
}

async function countExpectedProducts(
  versionId: string | null,
  type: ScopeType,
  values: ScopeValues,
): Promise<number> {
  if (!versionId) return 0;
  let builder = supabase
    .from("planogram_items")
    .select("id", { count: "exact", head: true })
    .eq("version_id", versionId);
  if (type === "location" && values.location) builder = builder.eq("location", values.location);
  if (type !== "location" && values.category) builder = builder.eq("category", values.category);
  if (type === "sub_category" && values.sub_category)
    builder = builder.eq("sub_category", values.sub_category);
  const { count, error } = await builder;
  if (error) return 0;
  return count ?? 0;
}

export async function createScanAssignment(input: {
  storeId: string;
  scopeType: ScopeType;
  scopeValues: ScopeValues;
  assigneeId: string;
  assigneeName: string;
  dueAt?: string | null;
  instructions?: string | null;
}): Promise<string> {
  const orgId = await requireOrgId();
  const assignerId = await requireUserId();

  const { data: version } = await supabase
    .from("planogram_versions")
    .select("id")
    .eq("org_id", orgId)
    .eq("store_id", input.storeId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("scan_assignments")
    .insert({
      org_id: orgId,
      store_id: input.storeId,
      planogram_version_id: version?.id ?? null,
      assignee_id: input.assigneeId,
      assigner_id: assignerId,
      scope_type: input.scopeType,
      scope_values: input.scopeValues,
      status: "pending",
      due_at: input.dueAt || null,
      instructions: input.instructions?.trim() || null,
    })
    .select("id")
    .single();
  if (error) dbError(error, "Could not assign the scan.");

  const assignmentId = data!.id as string;

  const { error: notifyError } = await supabase.from("notifications").insert({
    user_id: input.assigneeId,
    org_id: orgId,
    type: "scan_assigned",
    title: "New Scan Assigned",
    body: `You have a new shelf scan task: ${scopeSummary(input.scopeType, input.scopeValues)}.`,
    payload: { assignment_id: assignmentId },
  });
  if (notifyError) {
    console.error("[assignments] notification insert failed", notifyError.message);
  }

  return assignmentId;
}

type AssignmentRow = {
  id: string;
  store_id: string;
  scope_type: string;
  scope_values: unknown;
  status: string;
  due_at: string | null;
  instructions: string | null;
  created_at: string;
  assignee_id: string;
  assigner_id: string;
  planogram_version_id: string | null;
  stores?: { name?: string | null } | null;
};

const SELECT =
  "id, store_id, scope_type, scope_values, status, due_at, instructions, created_at, assignee_id, assigner_id, planogram_version_id, stores:store_id (name)";

/** scan_assignments references auth.users, so profile names are resolved separately. */
async function fetchNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", unique);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(
      row.id as string,
      (row.full_name as string | null)?.trim() || (row.email as string | null) || "Team member",
    );
  }
  return map;
}

async function mapAssignments(rows: AssignmentRow[]): Promise<Assignment[]> {
  const names = await fetchNames(rows.flatMap((row) => [row.assignee_id, row.assigner_id]));
  return Promise.all(
    rows.map(async (row) => {
      const scopeType = (row.scope_type as ScopeType) ?? "category";
      const scopeValues = (row.scope_values ?? {}) as ScopeValues;
      return {
        id: row.id,
        store_id: row.store_id,
        store_name: row.stores?.name ?? "Store",
        scope_type: scopeType,
        scope_values: scopeValues,
        status: (row.status as AssignmentStatus) ?? "pending",
        due_at: row.due_at,
        instructions: row.instructions,
        created_at: row.created_at,
        assignee_id: row.assignee_id,
        assignee_name: names.get(row.assignee_id) ?? "Team member",
        assigner_id: row.assigner_id,
        assigner_name: names.get(row.assigner_id) ?? "Team member",
        planogram_version_id: row.planogram_version_id,
        expected_products: await countExpectedProducts(
          row.planogram_version_id,
          scopeType,
          scopeValues,
        ),
      };
    }),
  );
}

/** Assignments where the signed-in user is the assignee. */
export async function fetchMyAssignments(): Promise<Assignment[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("scan_assignments")
    .select(SELECT)
    .eq("assignee_id", userId)
    .order("created_at", { ascending: false });
  if (error) dbError(error, "Could not load your assigned scans.");
  return mapAssignments((data ?? []) as unknown as AssignmentRow[]);
}

/** Every assignment in the org — visible to managers through RLS. */
export async function fetchOrgAssignments(): Promise<Assignment[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("scan_assignments")
    .select(SELECT)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) dbError(error, "Could not load team assignments.");
  return mapAssignments((data ?? []) as unknown as AssignmentRow[]);
}

export async function startAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from("scan_assignments")
    .update({ status: "in_progress" })
    .eq("id", assignmentId);
  if (error) dbError(error, "Could not start this scan.");
}

export async function cancelAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from("scan_assignments")
    .update({ status: "cancelled" })
    .eq("id", assignmentId);
  if (error) dbError(error, "Could not cancel this assignment.");
}
