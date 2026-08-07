// Team & User Management contract.
//
// Every value rendered by the team module comes from these endpoints — there is
// no local dummy data and no client-side business logic. Bindings target the
// future FastAPI service on Railway (Supabase Auth for identity).
//
//   GET    /users                  — searchable, filterable, paginated list
//   POST   /users                  — create a user directly (admin)
//   PUT    /users/{id}             — update name, role, assigned stores, status
//   DELETE /users/{id}             — remove a user from the organization
//   POST   /users/invite           — send an invitation (server-side email)
//   GET    /users/{id}             — single user detail (drawer)
//   GET    /users/{id}/activity    — per-user activity log
//   GET    /users/activity         — organization-wide activity log
//   POST   /users/{id}/disable     POST /users/{id}/enable
//   POST   /users/{id}/resend-invite
//   POST   /users/{id}/reset-password
//   POST   /users/bulk/assign-stores
//   POST   /users/bulk/change-role
//   POST   /users/bulk/disable
//   POST   /users/bulk/delete

const API_BASE = import.meta.env['VITE_SCAN_API_BASE'] ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Request failed (HTTP ${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ---------- roles / RBAC ----------

export type UserRole = "owner" | "admin" | "store_manager" | "viewer";

export const userRoles: UserRole[] = ["owner", "admin", "store_manager", "viewer"];

export const userRoleLabels: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  store_manager: "Store Manager",
  viewer: "Viewer",
};

/**
 * Permission keys mirror the future RBAC policy document served by the backend
 * (`GET /rbac/policy`). Until then these summaries are presentation-only.
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
  store_manager: ["run_scans", "view_reports", "export_data"],
  viewer: ["view_reports"],
};

export const roleSummaries: Record<UserRole, string> = {
  owner: "Complete control of the organization, including billing and account deletion.",
  admin: "Manages stores, users and settings. Cannot change billing or delete the account.",
  store_manager: "Runs scans and works with reports for the stores assigned to them.",
  viewer: "Read-only access to scans and reports for assigned stores.",
};

export const roleScope: Record<UserRole, "organization" | "assigned_stores"> = {
  owner: "organization",
  admin: "organization",
  store_manager: "assigned_stores",
  viewer: "assigned_stores",
};

// ---------- users ----------

export type UserStatus = "active" | "pending" | "disabled";

export const userStatuses: UserStatus[] = ["active", "pending", "disabled"];

export const userStatusLabels: Record<UserStatus, string> = {
  active: "Active",
  pending: "Pending",
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

function toQuery(query: UserListQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.role && query.role !== "all") params.set("role", query.role);
  if (query.status && query.status !== "all") params.set("status", query.status);
  if (query.page) params.set("page", String(query.page));
  if (query.page_size) params.set("page_size", String(query.page_size));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** GET /users */
export const fetchUsers = (query: UserListQuery = {}) =>
  request<UserListResponse>(`/users${toQuery(query)}`);

/** GET /users/{id} */
export const fetchUser = (id: string) => request<OrgUser>(`/users/${id}`);

/** POST /users */
export const createUser = (input: UserInput) =>
  request<OrgUser>("/users", { method: "POST", body: JSON.stringify(input) });

/** PUT /users/{id} */
export const updateUser = (id: string, input: UserUpdateInput) =>
  request<OrgUser>(`/users/${id}`, { method: "PUT", body: JSON.stringify(input) });

/** DELETE /users/{id} */
export const deleteUser = (id: string) => request<void>(`/users/${id}`, { method: "DELETE" });

/** POST /users/invite — the backend owns email delivery. */
export const inviteUser = (input: UserInput) =>
  request<OrgUser>("/users/invite", { method: "POST", body: JSON.stringify(input) });

/** POST /users/{id}/resend-invite */
export const resendInvite = (id: string) =>
  request<void>(`/users/${id}/resend-invite`, { method: "POST" });

/** POST /users/{id}/disable | /enable */
export const setUserEnabled = (id: string, enabled: boolean) =>
  request<OrgUser>(`/users/${id}/${enabled ? "enable" : "disable"}`, { method: "POST" });

/** POST /users/{id}/reset-password */
export const sendPasswordReset = (id: string) =>
  request<void>(`/users/${id}/reset-password`, { method: "POST" });

// ---------- bulk operations ----------

export const bulkAssignStores = (userIds: string[], storeIds: string[]) =>
  request<void>("/users/bulk/assign-stores", {
    method: "POST",
    body: JSON.stringify({ user_ids: userIds, store_ids: storeIds }),
  });

export const bulkChangeRole = (userIds: string[], role: UserRole) =>
  request<void>("/users/bulk/change-role", {
    method: "POST",
    body: JSON.stringify({ user_ids: userIds, role }),
  });

export const bulkDisableUsers = (userIds: string[]) =>
  request<void>("/users/bulk/disable", {
    method: "POST",
    body: JSON.stringify({ user_ids: userIds }),
  });

export const bulkDeleteUsers = (userIds: string[]) =>
  request<void>("/users/bulk/delete", {
    method: "POST",
    body: JSON.stringify({ user_ids: userIds }),
  });

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

/** GET /users/activity */
export const fetchOrgActivity = (limit = 20) =>
  request<ActivityResponse>(`/users/activity?limit=${limit}`);

/** GET /users/{id}/activity */
export const fetchUserActivity = (id: string, limit = 20) =>
  request<ActivityResponse>(`/users/${id}/activity?limit=${limit}`);

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
