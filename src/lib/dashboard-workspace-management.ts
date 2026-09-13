/**
 * Workspace management summary for the dashboard — planograms, stores, team,
 * and audits assigned by the current user. Read-only presentation data.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import { userRoleLabels, type UserRole } from "@/lib/team";

export type WorkspacePlanogramPreview = {
  id: string;
  name: string;
  store_name: string;
  category: string | null;
  status: "Active" | "Draft" | "Archived";
};

export type WorkspaceStorePreview = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  audit_count: number | null;
  status: string | null;
};

export type WorkspaceTeamPreview = {
  user_id: string;
  name: string;
  role: string;
  status: string;
};

export type AssignedAuditStatusKey =
  | "completed"
  | "in_progress"
  | "needs_action"
  | "pending"
  | "cancelled";

export type WorkspaceAssignedAuditPreview = {
  id: string;
  store_name: string;
  category: string | null;
  assigned_to: string;
  date: string;
  status: string;
  status_key: AssignedAuditStatusKey;
};

export type WorkspaceManagementData = {
  planograms: { count: number; recent: WorkspacePlanogramPreview[] };
  stores: { count: number; recent: WorkspaceStorePreview[] };
  team: { count: number; recent: WorkspaceTeamPreview[] };
  assigned_audits: {
    completed: number;
    in_progress: number;
    needs_action: number;
    recent: WorkspaceAssignedAuditPreview[];
  };
};

function planogramStatusLabel(raw: string): WorkspacePlanogramPreview["status"] {
  const s = raw.toLowerCase();
  if (s === "archived") return "Archived";
  if (s === "draft") return "Draft";
  return "Active";
}

function assignmentStatusKey(status: string): AssignedAuditStatusKey {
  const s = status.toLowerCase();
  if (s === "completed") return "completed";
  if (s === "needs_correction") return "needs_action";
  if (s === "pending") return "pending";
  if (s === "cancelled") return "cancelled";
  return "in_progress";
}

function assignmentStatusLabel(key: AssignedAuditStatusKey): string {
  switch (key) {
    case "completed":
      return "Completed";
    case "needs_action":
      return "Needs action";
    case "pending":
      return "Waiting";
    case "cancelled":
      return "Cancelled";
    default:
      return "In progress";
  }
}

function memberDisplayName(row: {
  profiles?: { full_name?: string | null; email?: string | null } | null;
  invited_email?: string | null;
}): string {
  const profile = row.profiles;
  return (
    profile?.full_name?.trim() ||
    profile?.email?.trim() ||
    row.invited_email?.trim() ||
    "Team member"
  );
}

export async function fetchWorkspaceManagementData(): Promise<WorkspaceManagementData> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();

  const [planogramsRes, storesRes, membersRes, assignmentsRes, scanCountsRes] = await Promise.all([
    supabase
      .from("planogram_versions")
      .select("id, name, status, created_at, store_id, stores:store_id(name)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("stores")
      .select("id, name, city, country, status, created_at")
      .eq("org_id", orgId)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase
      .from("organization_members")
      .select("user_id, role, status, invited_email, created_at, profiles:user_id(full_name, email)")
      .eq("org_id", orgId)
      .in("status", ["active", "invited"])
      .order("created_at", { ascending: false }),
    supabase
      .from("scan_assignments")
      .select("id, status, created_at, scope_type, scope_values, assignee_id, assigner_id, stores:store_id(name)")
      .eq("org_id", orgId)
      .eq("assigner_id", userId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false }),
    supabase.from("shelf_scans").select("store_id").eq("org_id", orgId).eq("status", "completed"),
  ]);

  if (planogramsRes.error) dbError(planogramsRes.error, "Could not load planograms.");
  if (storesRes.error) dbError(storesRes.error, "Could not load stores.");
  if (membersRes.error) dbError(membersRes.error, "Could not load team members.");
  if (assignmentsRes.error) dbError(assignmentsRes.error, "Could not load assigned audits.");

  const planogramRows = (planogramsRes.data ?? []) as Array<{
    id: string;
    name: string | null;
    status: string;
    created_at: string;
    store_id: string;
    stores: { name?: string | null } | null;
  }>;

  const versionIds = planogramRows.slice(0, 8).map((r) => r.id);
  let categoryByVersion = new Map<string, string>();
  if (versionIds.length) {
    const { data: items } = await supabase
      .from("planogram_items")
      .select("version_id, category, sub_category")
      .in("version_id", versionIds);
    for (const item of items ?? []) {
      const vid = item.version_id as string;
      if (categoryByVersion.has(vid)) continue;
      const cat =
        (item.sub_category as string | null)?.trim() ||
        (item.category as string | null)?.trim() ||
        null;
      if (cat) categoryByVersion.set(vid, cat);
    }
  }

  const planogramRecent: WorkspacePlanogramPreview[] = planogramRows.slice(0, 4).map((row) => ({
    id: row.id,
    name: row.name?.trim() || "Untitled planogram",
    store_name: row.stores?.name?.trim() || "Store",
    category: categoryByVersion.get(row.id) ?? null,
    status: planogramStatusLabel(row.status),
  }));

  const storeRows = (storesRes.data ?? []) as Array<{
    id: string;
    name: string;
    city: string | null;
    country: string | null;
    status: string | null;
  }>;

  const auditCountByStore = new Map<string, number>();
  for (const row of scanCountsRes.data ?? []) {
    const sid = row.store_id as string | null;
    if (!sid) continue;
    auditCountByStore.set(sid, (auditCountByStore.get(sid) ?? 0) + 1);
  }

  const storeRecent: WorkspaceStorePreview[] = storeRows.slice(0, 4).map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city,
    country: row.country,
    audit_count: auditCountByStore.get(row.id) ?? null,
    status: row.status === "active" ? "Active" : row.status,
  }));

  const memberRows = (membersRes.data ?? []) as Array<{
    user_id: string;
    role: string;
    status: string;
    invited_email?: string | null;
    profiles?: { full_name?: string | null; email?: string | null } | null;
  }>;

  const teamRecent: WorkspaceTeamPreview[] = memberRows.slice(0, 4).map((row) => ({
    user_id: row.user_id,
    name: memberDisplayName(row),
    role: userRoleLabels[row.role as UserRole] ?? row.role,
    status: row.status === "active" ? "Active" : row.status === "invited" ? "Invited" : row.status,
  }));

  const assignmentRows = (assignmentsRes.data ?? []) as Array<{
    id: string;
    status: string;
    created_at: string;
    scope_type: string;
    scope_values: { category?: string; sub_category?: string };
    stores: { name?: string | null } | null;
    assignee_id: string;
  }>;

  const assigneeIds = [...new Set(assignmentRows.map((r) => r.assignee_id).filter(Boolean))];
  const assigneeNameById = new Map<string, string>();
  if (assigneeIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", assigneeIds);
    for (const row of profiles ?? []) {
      assigneeNameById.set(
        row.id as string,
        (row.full_name as string | null)?.trim() ||
          (row.email as string | null)?.trim() ||
          "Team member",
      );
    }
  }

  let completed = 0;
  let inProgress = 0;
  let needsAction = 0;
  for (const row of assignmentRows) {
    const key = assignmentStatusKey(row.status);
    if (key === "completed") completed += 1;
    else if (key === "needs_action") needsAction += 1;
    else if (key !== "cancelled") inProgress += 1;
  }

  const assignedRecent: WorkspaceAssignedAuditPreview[] = assignmentRows.slice(0, 3).map((row) => {
    const key = assignmentStatusKey(row.status);
    const category =
      row.scope_values?.sub_category?.trim() ||
      row.scope_values?.category?.trim() ||
      null;
    const assignedTo = assigneeNameById.get(row.assignee_id) ?? "Unassigned";
    return {
      id: row.id,
      store_name: row.stores?.name?.trim() || "Store",
      category,
      assigned_to: assignedTo,
      date: row.created_at,
      status: assignmentStatusLabel(key),
      status_key: key,
    };
  });

  return {
    planograms: { count: planogramRows.length, recent: planogramRecent },
    stores: { count: storeRows.length, recent: storeRecent },
    team: { count: memberRows.length, recent: teamRecent },
    assigned_audits: {
      completed,
      in_progress: inProgress,
      needs_action: needsAction,
      recent: assignedRecent,
    },
  };
}
