/**
 * Authentication service — backed by the live Lovable Cloud auth.
 *
 * Sessions are stored and refreshed by the Supabase client; every domain module
 * reads identity through `@/lib/db/context`.
 */

import { supabase } from "@/integrations/supabase/client";
import { ApiError } from "./errors";
import {
  clearContextCache,
  createOrganizationForUser,
  ensureOrganizationForUser,
} from "@/lib/db/context";

export type AuthUser = {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  organization_id?: string;
  avatar_url?: string | null;
  email_verified?: boolean;
};

export type AuthSession = {
  access_token: string;
  refresh_token?: string;
  /** Seconds until the access token expires. */
  expires_in?: number;
  expires_at?: string;
  user: AuthUser;
};

export type LoginInput = { email: string; password: string; remember?: boolean };
export type RegisterInput = {
  email: string;
  password: string;
  full_name: string;
  company_name?: string;
  phone?: string;
};

function authError(message: string, status = 400): never {
  throw new ApiError({
    message,
    kind: status === 401 ? "unauthorized" : "bad_request",
    status,
  });
}

async function membershipFor(userId: string) {
  const { data } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function toSession(session: {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  user: { id: string; email?: string; email_confirmed_at?: string | null };
}): Promise<AuthSession> {
  const userId = session.user.id;
  const [{ data: profile }, membership] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url, email").eq("id", userId).maybeSingle(),
    membershipFor(userId),
  ]);

  return {
    access_token: session.access_token,
    ...(session.refresh_token ? { refresh_token: session.refresh_token } : {}),
    ...(session.expires_in ? { expires_in: session.expires_in } : {}),
    ...(session.expires_at
      ? { expires_at: new Date(session.expires_at * 1000).toISOString() }
      : {}),
    user: {
      id: userId,
      email: session.user.email ?? profile?.email ?? "",
      ...(profile?.full_name ? { full_name: profile.full_name } : {}),
      ...(membership?.role ? { role: membership.role } : {}),
      ...(membership?.org_id ? { organization_id: membership.org_id } : {}),
      avatar_url: profile?.avatar_url ?? null,
      email_verified: Boolean(session.user.email_confirmed_at),
    },
  };
}

/** Email + password sign-in. */
export async function login(input: LoginInput): Promise<AuthSession> {
  clearContextCache();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });
  if (error) authError(error.message, error.status === 400 ? 401 : (error.status ?? 400));
  if (!data.session) authError("Sign-in did not return a session.", 401);

  const meta = (data.user?.user_metadata ?? {}) as {
    company_name?: string;
    full_name?: string;
    name?: string;
  };
  const workspaceName =
    meta.company_name?.trim() ||
    (meta.full_name || meta.name)?.trim() ||
    data.user?.email?.split("@")[0] ||
    "My workspace";
  await ensureOrganizationForUser(data.user!.id, workspaceName);
  clearContextCache();

  return toSession(data.session as never);
}

/** Creates the account, profile (via trigger) and the user's workspace. */
export async function register(input: RegisterInput): Promise<AuthSession> {
  clearContextCache();
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: `${window.location.origin}/login`,
      data: {
        full_name: input.full_name,
        ...(input.company_name ? { company_name: input.company_name } : {}),
        ...(input.phone ? { phone: input.phone } : {}),
      },
    },
  });
  if (error) authError(error.message, error.status ?? 400);

  if (!data.session) {
    // Email confirmation is on: the user is not signed in yet.
    throw new ApiError({
      message: "Check your inbox to confirm your email, then log in.",
      kind: "bad_request",
      status: 202,
    });
  }

  if (input.phone) {
    await supabase.from("profiles").update({ phone: input.phone }).eq("id", data.user!.id);
  }
  await createOrganizationForUser(
    data.user!.id,
    input.company_name?.trim() || `${input.full_name}'s workspace`,
  );
  return toSession(data.session as never);
}

export async function logout(): Promise<{ ok: true }> {
  await supabase.auth.signOut();
  clearContextCache();
  return { ok: true };
}

export async function refreshSession(refresh_token: string): Promise<AuthSession> {
  const { data, error } = await supabase.auth.refreshSession({ refresh_token });
  if (error || !data.session) authError(error?.message ?? "Could not refresh session.", 401);
  return toSession(data.session as never);
}

/** Current session for the signed-in user. */
export async function fetchSession(_signal?: AbortSignal): Promise<AuthSession> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) authError("You are not signed in.", 401);
  return toSession(data.session as never);
}

/** Emails a password reset link pointing at /reset-password. */
export async function requestPasswordReset(input: { email: string }): Promise<{ ok: true }> {
  const { error } = await supabase.auth.resetPasswordForEmail(input.email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) authError(error.message, error.status ?? 400);
  return { ok: true };
}

/**
 * Completes a reset. The recovery link signs the user in, so the new password is
 * written straight to the account; a pasted code is exchanged first.
 */
export async function resetPassword(input: {
  token: string;
  new_password: string;
}): Promise<{ ok: true }> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    if (!input.token) {
      authError("This reset link has expired. Request a new one.", 401);
    }
    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash: input.token,
      type: "recovery",
    });
    if (otpError) authError(otpError.message, otpError.status ?? 400);
  }
  const { error } = await supabase.auth.updateUser({ password: input.new_password });
  if (error) authError(error.message, error.status ?? 400);
  return { ok: true };
}

/** Confirms an email address with the code from the verification link. */
export async function verifyEmail(input: { token: string }): Promise<{ ok: true }> {
  const { error } = await supabase.auth.verifyOtp({
    token_hash: input.token,
    type: "email",
  });
  if (error) authError(error.message, error.status ?? 400);
  return { ok: true };
}

export async function resendVerificationEmail(input: { email: string }): Promise<{ ok: true }> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: input.email.trim(),
    options: { emailRedirectTo: `${window.location.origin}/login` },
  });
  if (error) authError(error.message, error.status ?? 400);
  return { ok: true };
}

/* ------------------------------ social sign-in ----------------------------- */

export type OAuthProvider = "google" | "apple";

/**
 * Starts a managed social sign-in. Either redirects to the provider or sets the
 * session in place (editor preview / popup flow).
 */
export async function loginWithOAuth(
  provider: OAuthProvider,
): Promise<{ redirected: boolean }> {
  clearContextCache();
  const { lovable } = await import("@/integrations/lovable/index");
  const result = await lovable.auth.signInWithOAuth(provider, {
    redirect_uri: `${window.location.origin}/login`,
  });
  if (result.error) authError(result.error.message ?? "Social sign-in failed.", 400);
  if (result.redirected) return { redirected: true };
  await ensureOAuthWorkspace();
  return { redirected: false };
}

/** Creates the workspace for a social sign-in that has no membership yet. */
export async function ensureOAuthWorkspace(): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return;
  const meta = (user.user_metadata ?? {}) as {
    company_name?: string;
    full_name?: string;
    name?: string;
  };
  const workspaceName =
    meta.company_name?.trim() ||
    (meta.full_name || meta.name)?.trim() ||
    user.email?.split("@")[0] ||
    "My workspace";
  await ensureOrganizationForUser(user.id, workspaceName);
  clearContextCache();
}
