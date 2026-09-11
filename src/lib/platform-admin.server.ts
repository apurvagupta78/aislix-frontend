import type { SupabaseClient } from "@supabase/supabase-js";

/** Cross-tenant admin reads — service role only, never expose to the browser. */
export async function assertPlatformAdminEmail(
  supabaseAdmin: SupabaseClient,
  email: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("Sign in with your platform admin account.");

  const { data: grant } = await supabaseAdmin
    .from("platform_access_grants")
    .select("email")
    .eq("is_active", true)
    .ilike("email", normalized)
    .maybeSingle();

  if (!grant) throw new Error("Platform admin access required.");
}

/** Optional second gate — set ADMIN_CONSOLE_PASSWORD in server env. */
export function assertAdminConsolePassword(provided?: string | null): void {
  const expected = process.env["ADMIN_CONSOLE_PASSWORD"]?.trim();
  if (!expected) return;
  if (!provided || provided !== expected) {
    throw new Error("Invalid admin console password.");
  }
}

export async function requirePlatformAdminContext(
  supabaseAdmin: SupabaseClient,
  email: string,
  adminPassword?: string | null,
): Promise<void> {
  assertAdminConsolePassword(adminPassword);
  await assertPlatformAdminEmail(supabaseAdmin, email);
}
