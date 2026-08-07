// Backend contract for profile, company, stores, team, notifications, security,
// API keys and account management. Bindings target the future FastAPI service on
// Railway with Supabase Auth for identity. No dummy data is produced here — every
// value rendered in the UI comes from these endpoints.

const API_BASE = import.meta.env['VITE_SCAN_API_BASE'] ?? "";

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

// ---------- transport ----------

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Request failed (HTTP ${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function upload<T>(path: string, file: File, field = "file"): Promise<T> {
  const form = new FormData();
  form.append(field, file);
  const response = await fetch(`${API_BASE}${path}`, { method: "POST", body: form });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Upload failed (HTTP ${response.status}).`);
  }
  return (await response.json()) as T;
}

// ---------- profile ----------

/** GET /account/profile */
export const fetchProfile = (signal?: AbortSignal) =>
  request<UserProfile>("/account/profile", { signal: signal ?? null });

/** PATCH /account/profile */
export const updateProfile = (input: Partial<UserProfile>) =>
  request<UserProfile>("/account/profile", { method: "PATCH", body: JSON.stringify(input) });

/** POST /account/profile/avatar (multipart) */
export const uploadAvatar = (file: File) => upload<{ avatar_url: string }>("/account/profile/avatar", file);

// ---------- company ----------

/** GET /account/company */
export const fetchCompany = (signal?: AbortSignal) =>
  request<CompanySettings>("/account/company", { signal: signal ?? null });

/** PATCH /account/company */
export const updateCompany = (input: Partial<CompanySettings>) =>
  request<CompanySettings>("/account/company", { method: "PATCH", body: JSON.stringify(input) });

/** POST /account/company/logo (multipart) */
export const uploadCompanyLogo = (file: File) => upload<{ logo_url: string }>("/account/company/logo", file);

// ---------- stores ----------

/** GET /stores?search= */
export const fetchStores = (search?: string, signal?: AbortSignal) => {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return request<{ items: Store[] }>(`/stores${query}`, { signal: signal ?? null });
};

/** POST /stores */
export const createStore = (input: StoreInput) =>
  request<Store>("/stores", { method: "POST", body: JSON.stringify(input) });

/** PATCH /stores/{id} */
export const updateStore = (id: string, input: Partial<StoreInput>) =>
  request<Store>(`/stores/${id}`, { method: "PATCH", body: JSON.stringify(input) });

/** DELETE /stores/{id} */
export const deleteStore = (id: string) => request<void>(`/stores/${id}`, { method: "DELETE" });

// ---------- team ----------

/** GET /team/members */
export const fetchTeam = (signal?: AbortSignal) =>
  request<{ items: TeamMember[] }>("/team/members", { signal: signal ?? null });

/** POST /team/invites */
export const inviteMember = (input: { email: string; role: TeamRole }) =>
  request<TeamMember>("/team/invites", { method: "POST", body: JSON.stringify(input) });

/** PATCH /team/members/{id} */
export const updateMemberRole = (id: string, role: TeamRole) =>
  request<TeamMember>(`/team/members/${id}`, { method: "PATCH", body: JSON.stringify({ role }) });

/** DELETE /team/members/{id} */
export const removeMember = (id: string) => request<void>(`/team/members/${id}`, { method: "DELETE" });

// ---------- notifications ----------

/** GET /account/notifications */
export const fetchNotificationPreferences = (signal?: AbortSignal) =>
  request<NotificationPreferences>("/account/notifications", { signal: signal ?? null });

/** PATCH /account/notifications */
export const updateNotificationPreferences = (input: Partial<NotificationPreferences>) =>
  request<NotificationPreferences>("/account/notifications", {
    method: "PATCH",
    body: JSON.stringify(input),
  });

// ---------- security ----------

/** POST /account/password */
export const changePassword = (input: { current_password: string; new_password: string }) =>
  request<{ ok: true }>("/account/password", { method: "POST", body: JSON.stringify(input) });

/** GET /account/sessions */
export const fetchSessions = (signal?: AbortSignal) =>
  request<{ items: LoginSession[] }>("/account/sessions", { signal: signal ?? null });

/** POST /account/sessions/revoke-others */
export const signOutOtherDevices = () =>
  request<{ revoked: number }>("/account/sessions/revoke-others", { method: "POST" });

// ---------- api keys ----------

/** GET /account/api-keys */
export const fetchApiKeys = (signal?: AbortSignal) =>
  request<{ items: ApiKey[] }>("/account/api-keys", { signal: signal ?? null });

/** POST /account/api-keys */
export const createApiKey = (input: { name?: string } = {}) =>
  request<ApiKey>("/account/api-keys", { method: "POST", body: JSON.stringify(input) });

/** DELETE /account/api-keys/{id} */
export const revokeApiKey = (id: string) => request<void>(`/account/api-keys/${id}`, { method: "DELETE" });

// ---------- account management ----------

/** POST /account/export — queues a data export, returns a download URL when ready. */
export const exportAccountData = () =>
  request<{ download_url?: string; status?: string }>("/account/export", { method: "POST" });

/** DELETE /account */
export const deleteAccount = () => request<void>("/account", { method: "DELETE" });

// ---------- option catalogues (static UI choices, not data) ----------

export const roleLabels: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  viewer: "Viewer",
};

export const roleDescriptions: Record<TeamRole, string> = {
  owner: "Full access including billing and account deletion",
  admin: "Manage stores, scans, team and settings",
  manager: "Run scans and manage assigned stores",
  viewer: "Read-only access to scans and reports",
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
export const timezoneOptions = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

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
}
