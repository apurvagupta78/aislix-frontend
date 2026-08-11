/**
 * Server-side notification delivery.
 *
 * The client-side insert policy requires the recipient to be an *active* member,
 * which silently drops notifications for freshly invited teammates. This server
 * function verifies the caller manages the org and then writes the row with
 * elevated privileges so delivery never fails silently.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MANAGER_ROLES = ["owner", "admin", "manager"];

export type NotifyMemberInput = {
  org_id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string | null;
  payload?: Record<string, unknown>;
};

export const notifyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: NotifyMemberInput) => {
    const orgId = String(input?.org_id ?? "").trim();
    const userId = String(input?.user_id ?? "").trim();
    if (!orgId || !userId) throw new Error("Missing notification recipient.");
    return {
      org_id: orgId,
      user_id: userId,
      type: String(input?.type ?? "announcement"),
      title: String(input?.title ?? "Notification"),
      body: input?.body ? String(input.body) : null,
      payload: (input?.payload ?? {}) as Record<string, unknown>,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: me, error } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", data.org_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!me || !MANAGER_ROLES.includes(String(me.role).toLowerCase())) {
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insertError } = await supabaseAdmin.from("notifications").insert({
      user_id: data.user_id,
      org_id: data.org_id,
      type: data.type,
      title: data.title,
      body: data.body,
      payload: data.payload,
    });
    if (insertError) throw new Error(insertError.message);
    return { ok: true };
  });
