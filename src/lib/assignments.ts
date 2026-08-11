/**
 * Assigned Scans — Milestone 2.
 *
 * Managers (owner / admin / manager) assign a scan scope to any active member
 * of their organization; assignees see their tasks on /my-scans.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, getMembership, requireOrgId, requireUserId } from "@/lib/db/context";
import { notifyMember } from "@/lib/notifications.functions";

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
  status: string;
};

export type Assignment = {
  id: string;
  org_id: string;
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
  /** Aisle / location label resolved from the scope or the planogram rows. */
  location: string | null;
  scan_id: string | null;
};

/** Planogram row shape sent to the vision backend. */
export type PlanogramScopeItem = {
  location: string;
  aisle: string;
  category: string;
  sub_category: string;
  brand: string;
  product_name: string;
  sku: string;
  expected_qty: number;
  match_key: string;
};

export const MANAGER_ROLES = ["owner", "admin", "manager"] as const;

export function scopeSummary(type: ScopeType, values: ScopeValues): string {
  if (type === "location") return `Location · ${values.location ?? "—"}`;
  if (type === "sub_category") return `${values.category ?? "—"} · ${values.sub_category ?? "—"}`;
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
    .select("user_id, role, status, invited_email, profiles:user_id (full_name, email)")
    .eq("org_id", orgId)
    .in("status", ["active", "invited"])
    .neq("user_id", userId);
  if (error) dbError(error, "Could not load your team members.");

  return (data ?? []).map((row) => {
    const profile = (
      row as { profiles?: { full_name?: string | null; email?: string | null } | null }
    ).profiles;
    const email = profile?.email ?? (row as { invited_email?: string | null }).invited_email ?? "";
    return {
      user_id: row.user_id as string,
      role: String(row.role),
      name: profile?.full_name?.trim() || email || "Team member",
      status: String((row as { status?: string }).status ?? "active"),
      email,
    };
  });
}

const ITEM_SELECT =
  "id, location, aisle, category, sub_category, brand, product_name, sku, expected_qty, match_key, shelf_position";

function toScopeItem(row: Record<string, unknown>): PlanogramScopeItem {
  const s = (value: unknown) => (typeof value === "string" ? value : "");
  return {
    location: s(row["location"]),
    aisle: s(row["aisle"]) || s(row["location"]),
    category: s(row["category"]),
    sub_category: s(row["sub_category"]),
    brand: s(row["brand"]),
    product_name: s(row["product_name"]),
    sku: s(row["sku"]),
    expected_qty: Number(row["expected_qty"]) || 0,
    match_key: s(row["match_key"]),
  };
}

/** Planogram rows for a version, narrowed to the assignment scope. */
export function filterScopeItems(
  items: PlanogramScopeItem[],
  type: ScopeType,
  values: ScopeValues,
): PlanogramScopeItem[] {
  const eq = (a: string, b?: string) =>
    Boolean(b) && a.trim().toLowerCase() === String(b).trim().toLowerCase();
  return items.filter((item) => {
    if (type === "location")
      return eq(item.location, values.location) || eq(item.aisle, values.location);
    if (type === "sub_category")
      return eq(item.category, values.category) && eq(item.sub_category, values.sub_category);
    return eq(item.category, values.category);
  });
}

export async function fetchPlanogramScopeItems(
  versionId: string | null,
): Promise<PlanogramScopeItem[]> {
  if (!versionId) return [];
  const { data, error } = await supabase
    .from("planogram_items")
    .select(ITEM_SELECT)
    .eq("version_id", versionId);
  if (error) return [];
  return (data ?? []).map((row) => toScopeItem(row as Record<string, unknown>));
}

async function scopeMeta(
  versionId: string | null,
  type: ScopeType,
  values: ScopeValues,
): Promise<{ count: number; location: string | null }> {
  const scoped = filterScopeItems(await fetchPlanogramScopeItems(versionId), type, values);
  const location =
    values.location?.trim() ||
    scoped.find((item) => item.location || item.aisle)?.location ||
    scoped.find((item) => item.aisle)?.aisle ||
    null;
  return { count: scoped.length, location: location || null };
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

  try {
    await notifyMember({
      data: {
        org_id: orgId,
        user_id: input.assigneeId,
        type: "scan_assigned",
        title: "New Scan Assigned",
        body: `You have a new shelf scan task: ${scopeSummary(input.scopeType, input.scopeValues)}.`,
        payload: { assignment_id: assignmentId, store_id: input.storeId },
      },
    });
  } catch (notifyError) {
    console.error("[assignments] notification delivery failed", notifyError);
  }

  return assignmentId;
}

type AssignmentRow = {
  id: string;
  org_id: string;
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
  scan_id: string | null;
  stores?: { name?: string | null } | null;
};

const SELECT =
  "id, org_id, store_id, scope_type, scope_values, status, due_at, instructions, created_at, assignee_id, assigner_id, planogram_version_id, scan_id, stores:store_id (name)";

/** scan_assignments references auth.users, so profile names are resolved separately. */
async function fetchNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", unique);
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
      const meta = await scopeMeta(row.planogram_version_id, scopeType, scopeValues);
      return {
        id: row.id,
        org_id: row.org_id,
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
        scan_id: row.scan_id ?? null,
        location: meta.location,
        expected_products: meta.count,
      };
    }),
  );
}

/** Full assignment context used to pre-fill and lock the scan setup form. */
export async function fetchAssignmentById(assignmentId: string): Promise<Assignment | null> {
  const { data, error } = await supabase
    .from("scan_assignments")
    .select(SELECT)
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) dbError(error, "Could not load this assignment.");
  if (!data) return null;
  const [assignment] = await mapAssignments([data as unknown as AssignmentRow]);
  return assignment ?? null;
}

export function isOverdue(assignment: Assignment): boolean {
  if (!assignment.due_at) return false;
  if (assignment.status !== "pending" && assignment.status !== "in_progress") return false;
  return new Date(assignment.due_at).getTime() < Date.now();
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

/**
 * Manager view: assignments the signed-in user created, plus every assignment in
 * the org when they manage it. RLS already restricts non-managers to their own.
 */
export async function fetchOrgAssignments(): Promise<Assignment[]> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const manager = await isOrgManager();

  let builder = supabase.from("scan_assignments").select(SELECT).eq("org_id", orgId);
  if (!manager) builder = builder.eq("assigner_id", userId);

  const { data, error } = await builder.order("created_at", { ascending: false });
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

/** Count of open tasks assigned to the signed-in user, across every workspace. */
export async function fetchMyPendingCount(): Promise<number> {
  const userId = await requireUserId();
  const { count, error } = await supabase
    .from("scan_assignments")
    .select("id", { count: "exact", head: true })
    .eq("assignee_id", userId)
    .in("status", ["pending", "in_progress"]);
  if (error) return 0;
  return count ?? 0;
}
