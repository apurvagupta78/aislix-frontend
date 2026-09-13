// Team & User Management — live Supabase queries.
//
// Every value rendered by the team module is sourced from the database via
// the helpers in `@/lib/db/context`. There is no mock data.

import { supabase } from "@/integrations/supabase/client";
import { dbError, notFound, requireOrgId } from "@/lib/db/context";
import { inviteMember } from "@/lib/team-invite.functions";

// ---------- roles / RBAC ----------

export type UserRole = "owner" | "admin" | "manager" | "member" | "store_manager" | "viewer";

export const userRoles: UserRole[] = [
  "owner",
  "admin",
  "manager",
  "member",
  "store_manager",
  "viewer",
];

/** Roles a manager may hand out when inviting someone new. */
export const inviteRoles: UserRole[] = ["manager", "member"];

export const userRoleLabels: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  member: "Member",
  store_manager: "Store Manager",
  viewer: "Viewer",
};

/**
 * Permission keys mirror the app's RBAC policy. These summaries are
 * presentation-only.
 */
export type PermissionKey =
  | "billing"
  | "org_settings"
  | "manage_users"
  | "manage_stores"
  | "run_scans"
  | "view_reports"
  | "export_data";

export const permissionLabels: Record<PermissionKey, string> = {
  billing: "Billing & subscription",
  org_settings: "Organization settings",
  manage_users: "Invite & manage users",
  manage_stores: "Create & edit stores",
  run_scans: "Run shelf scans",
  view_reports: "View scans & reports",
  export_data: "Export data & PDF reports",
};

export const rolePermissions: Record<UserRole, PermissionKey[]> = {
  owner: [
    "billing",
    "org_settings",
    "manage_users",
    "manage_stores",
    "run_scans",
    "view_reports",
    "export_data",
  ],
  admin: ["org_settings", "manage_users", "manage_stores", "run_scans", "view_reports", "export_data"],
  manager: ["manage_stores", "run_scans", "view_reports", "export_data"],
  member: ["run_scans", "view_reports"],
  store_manager: ["run_scans", "view_reports", "export_data"],
  viewer: ["view_reports"],
};

export const roleSummaries: Record<UserRole, string> = {
  owner: "Complete control of the organization, including billing and account deletion.",
  admin: "Manages stores, users and settings. Cannot change billing or delete the account.",
  manager: "Uploads planograms, assigns scans and reviews reports across stores.",
  member: "Teammate who completes assigned scans and views their results.",
  store_manager: "Runs scans and works with reports for the stores assigned to them.",
  viewer: "Read-only access to scans and reports for assigned stores.",
};

export const roleScope: Record<UserRole, "organization" | "assigned_stores"> = {
  owner: "organization",
  admin: "organization",
  manager: "organization",
  member: "assigned_stores",
  store_manager: "assigned_stores",
  viewer: "assigned_stores",
};

/** UI role -> app_role enum stored in the database. */
export const appRoleForUiRole: Record<UserRole, string> = {
  owner: "owner",
  admin: "admin",
  manager: "manager",
  member: "member",
  store_manager: "manager",
  viewer: "member",
};

// ---------- users ----------

export type UserStatus = "active" | "pending" | "disabled";

export const userStatuses: UserStatus[] = ["active", "pending", "disabled"];

export const userStatusLabels: Record<UserStatus, string> = {
  active: "Active",
  pending: "Invited",
  disabled: "Disabled",
};

export type AssignedStore = {
  id: string;
  name: string;
};

export type OrgUser = {
  id: string;
  name?: string;
  email: string;
  role?: UserRole;
  status?: UserStatus;
  avatar_url?: string | null;
  assigned_stores?: AssignedStore[];
  all_stores_access?: boolean;
  created_at?: string | null;
  last_login_at?: string | null;
  invited_at?: string | null;
  scans_total?: number;
  scans_last_30_days?: number;
  last_scan_at?: string | null;
};

export type UserListQuery = {
  search?: string;
  role?: UserRole | "all";
  status?: UserStatus | "all";
  page?: number;
  page_size?: number;
};

export type UserListResponse = {
  items: OrgUser[];
  total?: number;
  page?: number;
  page_size?: number;
};

export type UserInput = {
  name: string;
  email: string;
  role: UserRole;
  store_ids: string[];
};

export type UserUpdateInput = {
  name?: string;
  role?: UserRole;
  store_ids?: string[];
  status?: UserStatus;
};

// ---------- status mapping (member_status <-> UserStatus) ----------

type MemberStatus = "active" | "invited" | "suspended";

function toUserStatus(status: MemberStatus): UserStatus {
  if (status === "invited") return "pending";
  if (status === "suspended") return "disabled";
  return "active";
}

function toMemberStatus(status: UserStatus): MemberStatus {
  if (status === "pending") return "invited";
  if (status === "disabled") return "suspended";
  return "active";
}

// ---------- member row mapping ----------

type MemberRow = {
  id: string;
  user_id: string;
  role: UserRole;
  status: MemberStatus;
  store_ids: string[];
  invited_email: string | null;
  created_at: string;
  last_active_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

async function mapMembersToUsers(rows: MemberRow[]): Promise<OrgUser[]> {
  const userIds = rows.map((r) => r.user_id).filter(Boolean);
  const storeIds = Array.from(new Set(rows.flatMap((r) => r.store_ids ?? [])));

  const [{ data: profiles }, { data: stores }, { data: scanCounts }] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", userIds)
      : Promise.resolve({ data: [] as ProfileRow[] }),
    storeIds.length
      ? supabase.from("stores").select("id, name").in("id", storeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    userIds.length
      ? supabase.from("shelf_scans").select("created_by, created_at").in("created_by", userIds)
      : Promise.resolve({ data: [] as { created_by: string | null; created_at: string }[] }),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const storeById = new Map((stores ?? []).map((s) => [s.id, s]));
  const since30 = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const scansByUser = new Map<string, { total: number; last30: number; lastAt: string | null }>();
  for (const scan of scanCounts ?? []) {
    if (!scan.created_by) continue;
    const entry = scansByUser.get(scan.created_by) ?? { total: 0, last30: 0, lastAt: null };
    entry.total += 1;
    if (new Date(scan.created_at).getTime() >= since30) entry.last30 += 1;
    if (!entry.lastAt || scan.created_at > entry.lastAt) entry.lastAt = scan.created_at;
    scansByUser.set(scan.created_by, entry);
  }

  return rows.map((row) => {
    const profile = profileById.get(row.user_id);
    const scans = scansByUser.get(row.user_id);
    const assigned_stores = (row.store_ids ?? [])
      .map((id) => storeById.get(id))
      .filter((s): s is { id: string; name: string } => Boolean(s));

    return {
      id: row.id,
      name:
        profile?.full_name ??
        (row.invited_email ? row.invited_email.split("@")[0] : undefined) ??
        undefined,
      email: profile?.email ?? row.invited_email ?? "",
      role: row.role,
      status: toUserStatus(row.status),
      avatar_url: profile?.avatar_url ?? null,
      assigned_stores,
      all_stores_access: roleScope[row.role] === "organization",
      created_at: row.created_at,
      last_login_at: row.last_active_at,
      invited_at: row.status === "invited" ? row.created_at : undefined,
      scans_total: scans?.total,
      scans_last_30_days: scans?.last30,
      last_scan_at: scans?.lastAt ?? null,
    };
  });
}

/** List org members joined with their profile, searchable/filterable. */
export async function fetchUsers(query: UserListQuery = {}): Promise<UserListResponse> {
  const orgId = await requireOrgId();
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let builder = supabase
    .from("organization_members")
    .select(
      "id, user_id, role, status, store_ids, invited_email, created_at, last_active_at",
      { count: "exact" },
    )
    .eq("org_id", orgId);

  if (query.role && query.role !== "all") builder = builder.eq("role", query.role);
  if (query.status && query.status !== "all") builder = builder.eq("status", toMemberStatus(query.status));

  builder = builder.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await builder;
  if (error) dbError(error, "Could not load team members.");

  let items = await mapMembersToUsers((data ?? []) as MemberRow[]);

  if (query.search) {
    const term = query.search.toLowerCase();
    items = items.filter(
      (u) => u.name?.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
    );
  }

  return { items, total: count ?? items.length, page, page_size: pageSize };
}

export async function fetchUser(id: string): Promise<OrgUser> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, user_id, role, status, store_ids, invited_email, created_at, last_active_at")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) dbError(error, "Could not load the team member.");
  if (!data) notFound("Team member not found.");
  const [user] = await mapMembersToUsers([data as MemberRow]);
  return user!;
}

/** Direct member creation is not supported without an existing account; use inviteUser instead. */
export async function createUser(input: UserInput): Promise<OrgUser> {
  return inviteUser(input);
}

export async function updateUser(id: string, input: UserUpdateInput): Promise<OrgUser> {
  const orgId = await requireOrgId();
  const patch: Record<string, unknown> = {};
  if (input.role) patch.role = appRoleForUiRole[input.role] ?? input.role;
  if (input.store_ids) patch.store_ids = input.store_ids;
  if (input.status) patch.status = toMemberStatus(input.status);

  const { data, error } = await supabase
    .from("organization_members")
    .update(patch as never)
    .eq("org_id", orgId)
    .eq("id", id)
    .select("id, user_id, role, status, store_ids, invited_email, created_at, last_active_at")
    .single();
  if (error) dbError(error, "Could not update the team member.");

  if (input.name) {
    await supabase.from("profiles").update({ full_name: input.name }).eq("id", data!.user_id);
  }

  const [user] = await mapMembersToUsers([data as MemberRow]);
  return user!;
}

export async function deleteUser(id: string): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) dbError(error, "Could not remove the team member.");
}

/**
 * Invites a member. The server function resolves or creates the auth user and
 * upserts the membership, so re-inviting an existing member updates their role
 * and stores instead of hitting the (org_id, user_id) unique constraint.
 */
export async function inviteUser(input: UserInput): Promise<OrgUser> {
  const { assertCanInviteMember, mapLimitError } = await import("@/lib/subscription-limits");
  const orgId = await requireOrgId();
  await assertCanInviteMember(orgId);
  const result = await inviteMember({
    data: {
      email: input.email,
      name: input.name,
      role: appRoleForUiRole[input.role] ?? "member",
      store_ids: input.store_ids,
    },
  }).catch(async (error: unknown) => {
    throw await mapLimitError(error, orgId);
  });
  return fetchUser(result.member_id);
}

/** Re-sends the auth invite email and refreshes the invite timestamp. */
export async function resendInvite(id: string): Promise<void> {
  const { resendMemberInvite } = await import("@/lib/team-invite.functions");
  await resendMemberInvite({ data: { member_id: id } });
}


export async function setUserEnabled(id: string, enabled: boolean): Promise<OrgUser> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("organization_members")
    .update({ status: enabled ? "active" : "suspended" })
    .eq("org_id", orgId)
    .eq("id", id)
    .select("id, user_id, role, status, store_ids, invited_email, created_at, last_active_at")
    .single();
  if (error) dbError(error, "Could not update the team member status.");
  const [user] = await mapMembersToUsers([data as MemberRow]);
  return user!;
}

/** Password resets are handled by Supabase Auth directly, not this table. */
export async function sendPasswordReset(id: string): Promise<void> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("organization_members")
    .select("invited_email, user_id")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) dbError(error, "Could not send the password reset.");
  const email = data?.invited_email;
  if (!email) return;
  await supabase.auth.resetPasswordForEmail(email);
}

// ---------- bulk operations ----------

export async function bulkAssignStores(userIds: string[], storeIds: string[]): Promise<void> {
  const orgId = await requireOrgId();
  for (const id of userIds) {
    const { data } = await supabase
      .from("organization_members")
      .select("store_ids")
      .eq("org_id", orgId)
      .eq("id", id)
      .maybeSingle();
    const merged = Array.from(new Set([...(data?.store_ids ?? []), ...storeIds]));
    const { error } = await supabase
      .from("organization_members")
      .update({ store_ids: merged })
      .eq("org_id", orgId)
      .eq("id", id);
    if (error) dbError(error, "Could not assign stores.");
  }
}

export async function bulkChangeRole(userIds: string[], role: UserRole): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase
    .from("organization_members")
    .update({ role: (appRoleForUiRole[role] ?? role) as never })
    .eq("org_id", orgId)
    .in("id", userIds);
  if (error) dbError(error, "Could not change roles.");
}

export async function bulkDisableUsers(userIds: string[]): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase
    .from("organization_members")
    .update({ status: "suspended" })
    .eq("org_id", orgId)
    .in("id", userIds);
  if (error) dbError(error, "Could not disable the selected users.");
}

export async function bulkDeleteUsers(userIds: string[]): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("org_id", orgId)
    .in("id", userIds);
  if (error) dbError(error, "Could not remove the selected users.");
}

// ---------- activity log ----------

export type ActivityEventKind =
  | "user_invited"
  | "invite_accepted"
  | "role_changed"
  | "store_assigned"
  | "store_unassigned"
  | "user_disabled"
  | "user_enabled"
  | "user_removed"
  | "password_reset"
  | "login";

export type ActivityEvent = {
  id: string;
  kind: ActivityEventKind;
  message?: string;
  actor_name?: string | null;
  target_name?: string | null;
  created_at?: string | null;
  ip_address?: string | null;
  device?: string | null;
};

export type ActivityResponse = {
  items: ActivityEvent[];
  total?: number;
};

/**
 * There is no dedicated audit-log table. The activity feed is derived from
 * real rows we do have: member invites (organization_members.created_at) and
 * scans run by members (shelf_scans.created_by/created_at). Event kinds with
 * no backing data (role_changed, store_assigned, password_reset, login, etc.)
 * are simply omitted.
 */
async function buildActivity(orgId: string, userId?: string, limit = 20): Promise<ActivityEvent[]> {
  let memberQuery = supabase
    .from("organization_members")
    .select("id, user_id, invited_email, status, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (userId) memberQuery = memberQuery.eq("user_id", userId);
  const { data: members } = await memberQuery;

  let scanQuery = supabase
    .from("shelf_scans")
    .select("id, created_by, created_at, status")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (userId) scanQuery = scanQuery.eq("created_by", userId);
  const { data: scans } = await scanQuery;

  const actorIds = Array.from(
    new Set([...(members ?? []).map((m) => m.user_id), ...(scans ?? []).map((s) => s.created_by)]),
  ).filter((id): id is string => Boolean(id));
  const { data: profiles } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const events: ActivityEvent[] = [];

  for (const member of members ?? []) {
    const actor = profileById.get(member.user_id);
    if (member.status === "invited") {
      events.push({
        id: `invite-${member.id}`,
        kind: "user_invited",
        actor_name: actor?.full_name ?? actor?.email ?? null,
        target_name: member.invited_email,
        created_at: member.created_at,
      });
    }
  }

  for (const scan of scans ?? []) {
    const actor = scan.created_by ? profileById.get(scan.created_by) : undefined;
    events.push({
      id: `scan-${scan.id}`,
      kind: "login",
      message: `Ran a shelf scan (${scan.status})`,
      actor_name: actor?.full_name ?? actor?.email ?? null,
      created_at: scan.created_at,
    });
  }

  return events
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, limit);
}

/** GET organization-wide activity, derived from real invite and scan rows. */
export async function fetchOrgActivity(limit = 20): Promise<ActivityResponse> {
  const orgId = await requireOrgId();
  const items = await buildActivity(orgId, undefined, limit);
  return { items, total: items.length };
}

/** GET a single member's activity, derived from real invite and scan rows. */
export async function fetchUserActivity(id: string, limit = 20): Promise<ActivityResponse> {
  const orgId = await requireOrgId();
  const { data: member } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (!member) return { items: [], total: 0 };
  const items = await buildActivity(orgId, member.user_id, limit);
  return { items, total: items.length };
}

export const activityKindLabels: Record<ActivityEventKind, string> = {
  user_invited: "User invited",
  invite_accepted: "Invitation accepted",
  role_changed: "Role changed",
  store_assigned: "Store assigned",
  store_unassigned: "Store unassigned",
  user_disabled: "User disabled",
  user_enabled: "User re-enabled",
  user_removed: "User removed",
  password_reset: "Password reset",
  login: "Signed in",
};

// ---------- formatting helpers (presentation only) ----------

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatCount(value?: number | null): string {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-IN").format(value)
    : "—";
}

export function userInitials(user: Pick<OrgUser, "name" | "email">): string {
  const source = user.name?.trim() || user.email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

export function storeAccessLabel(user: OrgUser): string {
  if (user.all_stores_access || (user.role && roleScope[user.role] === "organization")) {
    return "All stores";
  }
  const stores = user.assigned_stores ?? [];
  if (stores.length === 0) return "No stores";
  if (stores.length <= 2) return stores.map((s) => s.name).join(", ");
  return `${stores[0]!.name} +${stores.length - 1} more`;
}
