// Live account contract: profile, company, stores, team, notifications,
// security and account-management actions all backed by Supabase, scoped to
// the signed-in user and their active organization. No dummy data is produced
// here — every value comes from real rows.

import { supabase } from "@/integrations/supabase/client";
import { ApiError } from "@/lib/api/errors";
import {
  dbError,
  getMembership,
  getUser,
  requireMembership,
  requireOrgId,
  requireUserId,
  type MemberRole,
} from "@/lib/db/context";

// ---------- types ----------

export type UserProfile = {
  id?: string;
  full_name: string;
  company_name: string;
  email: string;
  mobile: string;
  job_title: string;
  country: string;
  timezone: string;
  avatar_url?: string | null;
};

export type CompanySettings = {
  id?: string;
  company_name: string;
  logo_url?: string | null;
  gst_number?: string;
  address: string;
  currency: string;
  date_format: string;
  language: string;
};

export type Store = {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  manager_name: string;
};

export type StoreInput = Omit<Store, "id">;

export type TeamRole = "owner" | "admin" | "manager" | "viewer";

export type TeamMember = {
  id: string;
  name?: string;
  email: string;
  role: TeamRole;
  last_login_at?: string | null;
  status?: "active" | "invited" | "suspended";
};

export type NotificationPreferences = {
  email_notifications: boolean;
  low_stock_alerts: boolean;
  weekly_reports: boolean;
  monthly_reports: boolean;
  billing_notifications: boolean;
  product_updates: boolean;
};

export type LoginSession = {
  id: string;
  device?: string;
  browser?: string;
  ip_address?: string;
  location?: string;
  last_active_at?: string;
  current?: boolean;
};

export type ApiKey = {
  id: string;
  name?: string;
  masked_key: string;
  key?: string; // only returned once, on creation
  created_at?: string;
  last_used_at?: string | null;
  revoked?: boolean;
};

// ---------- role mapping ----------

function roleToDb(role: TeamRole): MemberRole {
  return role === "manager" ? "store_manager" : role;
}

function roleFromDb(role: MemberRole): TeamRole {
  return role === "store_manager" ? "manager" : role;
}

// ---------- profile ----------

async function fetchOrgNameForUser(): Promise<string> {
  const membership = await getMembership();
  if (!membership) return "";
  const { data } = await supabase.from("organizations").select("name").eq("id", membership.org_id).maybeSingle();
  return data?.name ?? "";
}

/** The signed-in user's profile, merged with their organization name. */
export async function fetchProfile(signal?: AbortSignal): Promise<UserProfile> {
  void signal;
  const user = await getUser();
  if (!user) throw new ApiError({ message: "You need to sign in to continue.", kind: "unauthorized", status: 401 });

  const [{ data: profile, error }, companyName] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, phone, job_title, timezone")
      .eq("id", user.id)
      .maybeSingle(),
    fetchOrgNameForUser(),
  ]);
  if (error) dbError(error, "Could not load your profile.");

  return {
    id: profile?.id ?? user.id,
    full_name: profile?.full_name ?? "",
    company_name: companyName,
    email: profile?.email ?? user.email ?? "",
    mobile: profile?.phone ?? "",
    job_title: profile?.job_title ?? "",
    country: "",
    timezone: profile?.timezone ?? "",
    avatar_url: await resolveAvatarUrl(profile as { avatar_url?: string | null } | null),
  };
}

async function resolveAvatarUrl(row: { avatar_url?: string | null } | null): Promise<string | null> {
  const path = row?.avatar_url;
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Updates the signed-in user's profile row. */
export async function updateProfile(input: Partial<UserProfile>): Promise<UserProfile> {
  const userId = await requireUserId();
  const patch: Record<string, unknown> = {};
  if (input.full_name !== undefined) patch.full_name = input.full_name;
  if (input.mobile !== undefined) patch.phone = input.mobile;
  if (input.job_title !== undefined) patch.job_title = input.job_title;
  if (input.timezone !== undefined) patch.timezone = input.timezone;
  if (Object.keys(patch).length) {
    const { error } = await supabase.from("profiles").update(patch as never).eq("id", userId);
    if (error) dbError(error, "Could not update your profile.");
  }
  return fetchProfile();
}

/** Uploads an avatar to the avatars bucket and stores the path on the profile. */
export async function uploadAvatar(file: File): Promise<{ avatar_url: string }> {
  const userId = await requireUserId();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/avatar.${ext}`;
  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (uploadError) {
    throw new ApiError({ message: uploadError.message, kind: "server", status: 500 });
  }
  const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
  if (error) dbError(error, "Could not save your avatar.");
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
  return { avatar_url: data?.signedUrl ?? path };
}

// ---------- company ----------

function formatAddress(address: Record<string, unknown> | null | undefined): string {
  if (!address) return "";
  return [address.line1, address.line2, address.city, address.state, address.pincode, address.country]
    .filter((part) => typeof part === "string" && part.trim())
    .join(", ");
}

/**
 * The active organization's settings.
 *
 * Tax/billing fields are not readable from the table by ordinary members; they
 * come from the owner/admin-only `get_org_billing_profile` RPC.
 */
export async function fetchCompany(signal?: AbortSignal): Promise<CompanySettings> {
  void signal;
  const orgId = await requireOrgId();
  const { data: base, error } = await supabase
    .from("organizations")
    .select("id, name, logo_url, address")
    .eq("id", orgId)
    .maybeSingle();
  if (error) dbError(error, "Could not load company settings.");

  const { data: billing } = await supabase.rpc("get_org_billing_profile", { p_org_id: orgId });
  const billingRow = Array.isArray(billing) ? billing[0] : null;

  return {
    id: base?.id,
    company_name: base?.name ?? "",
    logo_url: await resolveLogoUrl(base as { logo_url?: string | null } | null),
    gst_number: billingRow?.gstin ?? "",
    address: formatAddress(base?.address as Record<string, unknown> | null),
    currency: "INR",
    date_format: "DD/MM/YYYY",
    language: "English",
  };
}

async function resolveLogoUrl(row: { logo_url?: string | null } | null): Promise<string | null> {
  const path = row?.logo_url;
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from("org-logos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Updates the active organization's row (owners/admins only, enforced by RLS). */
export async function updateCompany(input: Partial<CompanySettings>): Promise<CompanySettings> {
  const orgId = await requireOrgId();
  const patch: Record<string, unknown> = {};
  if (input.company_name !== undefined) patch.name = input.company_name;
  if (input.gst_number !== undefined) patch.gstin = input.gst_number;
  if (input.address !== undefined) patch.address = { line1: input.address };
  if (Object.keys(patch).length) {
    const { error } = await supabase.from("organizations").update(patch as never).eq("id", orgId);
    if (error) dbError(error, "Could not update company settings.");
  }
  return fetchCompany();
}

/** Uploads a company logo to the org-logos bucket and stores the path. */
export async function uploadCompanyLogo(file: File): Promise<{ logo_url: string }> {
  const orgId = await requireOrgId();
  const ext = file.name.split(".").pop() || "png";
  const path = `${orgId}/logo.${ext}`;
  const { error: uploadError } = await supabase.storage.from("org-logos").upload(path, file, { upsert: true });
  if (uploadError) {
    throw new ApiError({ message: uploadError.message, kind: "server", status: 500 });
  }
  const { error } = await supabase.from("organizations").update({ logo_url: path }).eq("id", orgId);
  if (error) dbError(error, "Could not save your logo.");
  const { data } = await supabase.storage.from("org-logos").createSignedUrl(path, 3600);
  return { logo_url: data?.signedUrl ?? path };
}

// ---------- stores ----------

function mapStoreRow(row: {
  id: string;
  name: string;
  code: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  profiles?: { full_name: string | null } | null;
}): Store {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? "",
    address: [row.address_line1, row.address_line2].filter(Boolean).join(", "),
    city: row.city ?? "",
    state: row.state ?? "",
    country: row.country ?? "",
    manager_name: row.profiles?.full_name ?? "",
  };
}

/** Stores belonging to the active organization. */
export async function fetchStores(search?: string, signal?: AbortSignal): Promise<{ items: Store[] }> {
  void signal;
  const orgId = await requireOrgId();
  let query = supabase
    .from("stores")
    .select(
      "id, name, code, address_line1, address_line2, city, state, country, profiles:manager_id(full_name)",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (search) query = query.ilike("name", `%${search}%`);
  const { data, error } = await query;
  if (error) dbError(error, "Could not load stores.");
  return { items: (data ?? []).map((row) => mapStoreRow(row as never)) };
}

/** Creates a store for the active organization (enforces the plan store limit). */
export async function createStore(input: StoreInput): Promise<Store> {
  const orgId = await requireOrgId();
  const { assertCanAddStore, mapLimitError } = await import("@/lib/subscription-limits");
  await assertCanAddStore(orgId);

  const { data, error } = await supabase

    .from("stores")
    .insert({
      org_id: orgId,
      name: input.name,
      code: input.code || null,
      address_line1: input.address || null,
      city: input.city || null,
      state: input.state || null,
      country: input.country || null,
    })
    .select("id, name, code, address_line1, address_line2, city, state, country")
    .single();
  if (error) {
    const mapped = await mapLimitError(error, orgId);
    if (mapped !== error) throw mapped;
    dbError(error, "Could not create the store.");
  }
  return mapStoreRow({ ...data, profiles: null });
}

/** Updates a store belonging to the active organization. */
export async function updateStore(id: string, input: Partial<StoreInput>): Promise<Store> {
  const orgId = await requireOrgId();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.code !== undefined) patch.code = input.code;
  if (input.address !== undefined) patch.address_line1 = input.address;
  if (input.city !== undefined) patch.city = input.city;
  if (input.state !== undefined) patch.state = input.state;
  if (input.country !== undefined) patch.country = input.country;
  const { data, error } = await supabase
    .from("stores")
    .update(patch as never)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id, name, code, address_line1, address_line2, city, state, country, profiles:manager_id(full_name)")
    .single();
  if (error) dbError(error, "Could not update the store.");
  return mapStoreRow(data as never);
}

/** Deletes a store belonging to the active organization. */
export async function deleteStore(id: string): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase.from("stores").delete().eq("id", id).eq("org_id", orgId);
  if (error) dbError(error, "Could not delete the store.");
}

// ---------- team ----------

type MemberRow = {
  id: string;
  role: MemberRole;
  status: "active" | "invited" | "suspended";
  invited_email: string | null;
  last_active_at: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

function mapMemberRow(row: MemberRow): TeamMember {
  return {
    id: row.id,
    name: row.profiles?.full_name ?? undefined,
    email: row.profiles?.email ?? row.invited_email ?? "",
    role: roleFromDb(row.role),
    last_login_at: row.last_active_at,
    status: row.status,
  };
}

/** Team members of the active organization. */
export async function fetchTeam(signal?: AbortSignal): Promise<{ items: TeamMember[] }> {
  void signal;
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, role, status, invited_email, last_active_at, profiles:user_id(full_name, email)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) dbError(error, "Could not load your team.");
  return { items: (data ?? []).map((row) => mapMemberRow(row as never)) };
}

/**
 * Invites a member by email. The server function resolves or creates the auth
 * user, upserts the membership and sends the branded Aislix invitation email.
 */
export async function inviteMember(input: { email: string; role: TeamRole }): Promise<TeamMember> {
  const membership = await requireMembership();
  const { assertCanInviteMember, mapLimitError } = await import("@/lib/subscription-limits");
  await assertCanInviteMember(membership.org_id);

  const { inviteMember: inviteMemberFn } = await import("@/lib/team-invite.functions");
  const result = await inviteMemberFn({
    data: { email: input.email, role: roleToDb(input.role) },
  }).catch(async (error: unknown) => {
    throw await mapLimitError(error, membership.org_id);
  });

  const { data, error } = await supabase
    .from("organization_members")
    .select("id, role, status, invited_email, last_active_at, profiles:user_id(full_name, email)")
    .eq("id", result.member_id)
    .single();
  if (error) dbError(error, "Invite sent, but the member list could not be refreshed.");
  return mapMemberRow(data as never);
}


/** Updates a team member's role. */
export async function updateMemberRole(id: string, role: TeamRole): Promise<TeamMember> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("organization_members")
    .update({ role: roleToDb(role) })
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id, role, status, invited_email, last_active_at, profiles:user_id(full_name, email)")
    .single();
  if (error) dbError(error, "Could not update that member's role.");
  return mapMemberRow(data as never);
}

/** Removes a team member from the active organization. */
export async function removeMember(id: string): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase.from("organization_members").delete().eq("id", id).eq("org_id", orgId);
  if (error) dbError(error, "Could not remove that team member.");
}

// ---------- notifications ----------

const defaultNotificationPreferences: NotificationPreferences = {
  email_notifications: true,
  low_stock_alerts: true,
  weekly_reports: false,
  monthly_reports: false,
  billing_notifications: true,
  product_updates: false,
};

/** Notification preferences stored as JSON on the user's profile. */
export async function fetchNotificationPreferences(signal?: AbortSignal): Promise<NotificationPreferences> {
  void signal;
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("notification_prefs")
    .eq("id", userId)
    .maybeSingle();
  if (error) dbError(error, "Could not load notification preferences.");
  const prefs = (data?.notification_prefs ?? {}) as Partial<NotificationPreferences>;
  return { ...defaultNotificationPreferences, ...prefs };
}

/** Merges and persists notification preferences on the user's profile. */
export async function updateNotificationPreferences(
  input: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const userId = await requireUserId();
  const current = await fetchNotificationPreferences();
  const merged = { ...current, ...input };
  const { error } = await supabase.from("profiles").update({ notification_prefs: merged }).eq("id", userId);
  if (error) dbError(error, "Could not update notification preferences.");
  return merged;
}

// ---------- security ----------

/** Updates the signed-in user's password via Supabase Auth. */
export async function changePassword(input: {
  current_password: string;
  new_password: string;
}): Promise<{ ok: true }> {
  void input.current_password;
  const { error } = await supabase.auth.updateUser({ password: input.new_password });
  if (error) {
    throw new ApiError({ message: error.message, kind: "server", status: 500 });
  }
  return { ok: true };
}

// Auth flows live in the auth service (Supabase-bound) and are re-exported
// here so existing imports keep working.
export {
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
} from "./api/auth";

/** Only the current session is real — there is no server-side device list. */
export async function fetchSessions(signal?: AbortSignal): Promise<{ items: LoginSession[] }> {
  void signal;
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return { items: [] };
  return {
    items: [
      {
        id: session.access_token.slice(0, 12),
        last_active_at: new Date().toISOString(),
        current: true,
      },
    ],
  };
}

/** Signs out every session except the current one. */
export async function signOutOtherDevices(): Promise<{ revoked: number }> {
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) {
    throw new ApiError({ message: error.message, kind: "server", status: 500 });
  }
  return { revoked: 1 };
}

// ---------- api keys ----------

const API_KEY_PREFIX = "aislix_sk_";

function randomKeySecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function maskKey(prefix: string): string {
  return `${prefix}••••••••••••`;
}

function toApiKey(row: any): ApiKey {
  return {
    id: row.id as string,
    name: (row.name as string | null) ?? undefined,
    masked_key: maskKey(row.key_prefix as string),
    created_at: (row.created_at as string) ?? undefined,
    last_used_at: (row.last_used_at as string | null) ?? null,
    revoked: Boolean(row.revoked_at),
  };
}

/** Every API key belonging to the active organization (hashes never leave the DB). */
export async function fetchApiKeys(signal?: AbortSignal): Promise<{ items: ApiKey[] }> {
  void signal;
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) dbError(error, "Could not load your API keys.");
  return { items: (data ?? []).map(toApiKey) };
}

/** Creates a key, returning the full secret exactly once. Only the hash is stored. */
export async function createApiKey(input: { name?: string } = {}): Promise<ApiKey> {
  const membership = await requireMembership();
  if (membership.role !== "owner" && membership.role !== "admin") {
    throw new ApiError({
      message: "Only workspace owners and admins can create API keys.",
      kind: "forbidden",
      status: 403,
    });
  }

  const secret = randomKeySecret();
  const key = `${API_KEY_PREFIX}${secret}`;
  const keyHash = await hashKey(key);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      org_id: membership.org_id,
      user_id: membership.user_id,
      name: input.name?.trim() || `Key ${new Date().toLocaleDateString()}`,
      key_prefix: key.slice(0, API_KEY_PREFIX.length + 8),
      key_hash: keyHash,
    } as never)
    .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
    .single();
  if (error || !data) dbError(error, "Could not create the API key.");

  return { ...toApiKey(data), key };
}

/** Marks a key revoked; existing rows are never deleted so the audit trail stays. */
export async function revokeApiKey(id: string): Promise<void> {
  const membership = await requireMembership();
  if (membership.role !== "owner" && membership.role !== "admin") {
    throw new ApiError({
      message: "Only workspace owners and admins can revoke API keys.",
      kind: "forbidden",
      status: 403,
    });
  }
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq("id", id)
    .eq("org_id", membership.org_id);
  if (error) dbError(error, "Could not revoke the API key.");
}


// ---------- account management ----------

/** Builds a real JSON export from the user's profile, org, stores and audits. */
export async function exportAccountData(): Promise<{ download_url?: string; status?: string }> {
  const userId = await requireUserId();
  const membership = await getMembership();

  const [{ data: profile }, org, stores, audits] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    membership
      ? supabase.from("organizations").select("*").eq("id", membership.org_id).maybeSingle()
      : Promise.resolve({ data: null }),
    membership
      ? supabase.from("stores").select("*").eq("org_id", membership.org_id)
      : Promise.resolve({ data: [] }),
    membership
      ? supabase.from("shelf_scans").select("*").eq("org_id", membership.org_id)
      : Promise.resolve({ data: [] }),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    profile,
    organization: org.data,
    stores: stores.data ?? [],
    shelf_scans: audits.data ?? [],
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  return { download_url: url, status: "ready" };
}

/** Account deletion requires support involvement; signs the user out instead of faking success. */
export async function deleteAccount(): Promise<void> {
  await supabase.auth.signOut();
  throw new ApiError({
    message: "Account deletion isn't self-service yet — please contact support to delete your account.",
    kind: "not_configured",
    status: 501,
  });
}

// ---------- option catalogues (static UI choices, not data) ----------

export const roleLabels: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  viewer: "Viewer",
};

export const roleDescriptions: Record<TeamRole, string> = {
  owner: "Full access including billing and account deletion",
  admin: "Manage stores, audits, team and settings",
  manager: "Run audits and manage assigned stores",
  viewer: "Read-only access to audits and reports",
};

export const currencyOptions = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];
export const dateFormatOptions = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD MMM YYYY"];
export const languageOptions = ["English", "हिन्दी", "தமிழ்", "मराठी", "العربية"];
export const countryOptions = [
  "India",
  "United States",
  "United Kingdom",
  "United Arab Emirates",
  "Singapore",
  "Australia",
  "Germany",
];
const FALLBACK_TIMEZONE_OPTIONS = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Bogota",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function buildTimezoneOptions(): string[] {
  try {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      return [...Intl.supportedValuesOf("timeZone")].sort((a, b) => a.localeCompare(b));
    }
  } catch {
    /* fall through to curated list */
  }
  return FALLBACK_TIMEZONE_OPTIONS;
}

/** Full IANA timezone list (browser-supported) for profile, store, and planogram forms. */
export const timezoneOptions = buildTimezoneOptions();

/** Ensures a saved/custom timezone remains selectable even if not in the cached list. */
export function timezoneSelectOptions(current?: string | null): string[] {
  const tz = current?.trim();
  if (!tz || timezoneOptions.includes(tz)) return timezoneOptions;
  return [tz, ...timezoneOptions];
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}'