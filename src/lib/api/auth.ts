/**
 * Authentication service — interfaces only.
 *
 * Supabase Auth is NOT implemented yet. Every function here calls the
 * centralized client against its future endpoint, so switching to Supabase only
 * requires replacing these bodies (and registering the token provider in
 * `setAuthTokenProvider`) — no page or component changes.
 *
 *   POST /auth/login             POST /auth/logout
 *   POST /auth/register          POST /auth/refresh
 *   POST /auth/password/forgot   POST /auth/password/reset
 *   POST /auth/email/verify      POST /auth/email/resend
 *   GET  /auth/session
 */

import { api } from "./client";

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

/** POST /auth/login */
export const login = (input: LoginInput) =>
  api.post<AuthSession>("/auth/login", input, { anonymous: true });

/** POST /auth/register */
export const register = (input: RegisterInput) =>
  api.post<AuthSession>("/auth/register", input, { anonymous: true });

/** POST /auth/logout */
export const logout = () => api.post<{ ok: true }>("/auth/logout");

/** POST /auth/refresh */
export const refreshSession = (refresh_token: string) =>
  api.post<AuthSession>("/auth/refresh", { refresh_token }, { anonymous: true });

/** GET /auth/session — current user for the stored token. */
export const fetchSession = (signal?: AbortSignal) =>
  api.get<AuthSession>("/auth/session", { signal });

/** POST /auth/password/forgot — emails a reset link. */
export const requestPasswordReset = (input: { email: string }) =>
  api.post<{ ok: true }>("/auth/password/forgot", input, { anonymous: true });

/** POST /auth/password/reset — completes a reset with the emailed token. */
export const resetPassword = (input: { token: string; new_password: string }) =>
  api.post<{ ok: true }>("/auth/password/reset", input, { anonymous: true });

/** POST /auth/email/verify */
export const verifyEmail = (input: { token: string }) =>
  api.post<{ ok: true }>("/auth/email/verify", input, { anonymous: true });

/** POST /auth/email/resend */
export const resendVerificationEmail = (input: { email: string }) =>
  api.post<{ ok: true }>("/auth/email/resend", input, { anonymous: true });
