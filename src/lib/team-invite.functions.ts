/**
 * Team invites.
 *
 * Runs on the server because inviting requires the Auth Admin API: we must
 * resolve (or create) the auth user for the invited email before writing the
 * organization_members row. The membership write is an upsert on
 * (org_id, user_id) so re-inviting an existing member updates their role and
 * stores instead of failing with a duplicate key.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InviteMemberInput = {
  email: string;
  name?: string;
  role: string;
  store_ids?: string[];
  reports_to_user_id?: string | null;
};

export type InviteMemberResult = {
  member_id: string;
  user_id: string;
  email: string;
  mode: "invited" | "updated";
};

const MANAGER_ROLES = ["owner", "admin", "manager"];

/** UI role -> app_role enum used by the database. */
const APP_ROLE: Record<string, string> = {
  owner: "owner",
  admin: "admin",
  manager: "manager",
  store_manager: "manager",
  member: "member",
  viewer: "member",
};

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: InviteMemberInput) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
    return {
      email,
      name: String(input?.name ?? "").trim(),
      role: APP_ROLE[String(input?.role ?? "member")] ?? "member",
      store_ids: Array.isArray(input?.store_ids) ? input.store_ids.map(String) : [],
      reports_to_user_id: input?.reports_to_user_id
        ? String(input.reports_to_user_id)
        : null,
    };
  })
  .handler(async ({ data, context }): Promise<InviteMemberResult> => {
    const { supabase, userId } = context;

    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("org_id, role")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (membershipError) throw new Error(membershipError.message);
    if (!membership) throw new Error("No workspace found for your account yet.");
    if (!MANAGER_ROLES.includes(String(membership.role))) {
      throw new Error("Only owners, admins and managers can invite team members.");
    }
    const orgId = membership.org_id as string;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateInviteLink, sendInviteEmail } = await import("@/lib/team-invite.server");

    // 1) Existing account? profiles mirrors auth.users and is admin-readable.
    let invitedUserId: string | null = null;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", data.email)
      .maybeSingle();
    if (profile?.id) invitedUserId = profile.id as string;

    // 2) Otherwise create the account and mint an invite action link. Supabase
    //    does not email it — we send our own branded invitation below.
    let mode: InviteMemberResult["mode"] = "updated";
    let actionLink: string | null = null;
    if (!invitedUserId) {
      actionLink = await generateInviteLink(supabaseAdmin as never, data.email, orgId);
      const { data: listed } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const match = listed?.users?.find(
        (user) => (user.email ?? "").toLowerCase() === data.email,
      );
      if (match) {
        invitedUserId = match.id;
        mode = "invited";
      } else {
        const invited = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
          data: data.name ? { full_name: data.name } : undefined,
        });
        if (!invited.data?.user?.id) {
          throw new Error(invited.error?.message || "Could not invite this email address.");
        }
        invitedUserId = invited.data.user.id;
        mode = "invited";
      }
    }

    // 3) Upsert the membership: never a blind insert.
    const isExistingActive =
      mode === "updated" &&
      (
        await supabaseAdmin
          .from("organization_members")
          .select("status")
          .eq("org_id", orgId)
          .eq("user_id", invitedUserId)
          .maybeSingle()
      ).data?.status === "active";

    const { data: member, error: upsertError } = await supabaseAdmin
      .from("organization_members")
      .upsert(
        {
          org_id: orgId,
          user_id: invitedUserId,
          role: data.role as never,
          status: (isExistingActive ? "active" : "invited") as never,
          store_ids: data.store_ids,
          reports_to_user_id: data.reports_to_user_id || null,
          invited_email: data.email,
          invited_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,user_id" },
      )
      .select("id")
      .single();
    if (upsertError) throw new Error(upsertError.message);

    // 4) Branded invitation email (never blocks the invite itself).
    if (!isExistingActive) {
      const [{ data: org }, { data: inviter }] = await Promise.all([
        supabaseAdmin.from("organizations").select("name").eq("id", orgId).maybeSingle(),
        supabaseAdmin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      ]);
      await sendInviteEmail({
        email: data.email,
        orgId,
        orgName: (org?.name as string) || "your workspace",
        inviterName: (inviter?.full_name as string) ?? null,
        role: data.role,
        acceptUrl: actionLink,
        isNewUser: Boolean(actionLink),
        idempotencySuffix: member!.id as string,
      });
    }

    return {
      member_id: member!.id as string,
      user_id: invitedUserId!,
      email: data.email,
      mode: isExistingActive ? "updated" : mode === "invited" ? "invited" : "updated",
    };
  });


/** Re-sends the Auth invite email for a still-pending membership row. */
export const resendMemberInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { member_id: string }) => ({
    member_id: String(input?.member_id ?? "").trim(),
  }))
  .handler(async ({ data, context }): Promise<{ email: string }> => {
    const { supabase, userId } = context;

    const { data: membership } = await supabase
      .from("organization_members")
      .select("org_id, role")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!membership || !MANAGER_ROLES.includes(String(membership.role))) {
      throw new Error("Only owners, admins and managers can resend invites.");
    }

    const { data: row, error } = await supabase
      .from("organization_members")
      .select("id, invited_email, status")
      .eq("org_id", membership.org_id)
      .eq("id", data.member_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Invite not found.");
    if (row.status !== "invited") throw new Error("This member has already joined.");
    const email = String(row.invited_email ?? "").trim();
    if (!email) throw new Error("This invite has no email address.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateInviteLink, sendInviteEmail } = await import("@/lib/team-invite.server");

    const orgId = membership.org_id as string;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    // No account yet -> mint a fresh invite action link. Existing account ->
    // plain accept link they open after signing in.
    const actionLink = profile?.id ? null : await generateInviteLink(supabaseAdmin as never, email, orgId);

    const [{ data: org }, { data: inviter }] = await Promise.all([
      supabaseAdmin.from("organizations").select("name").eq("id", orgId).maybeSingle(),
      supabaseAdmin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    ]);

    await sendInviteEmail({
      email,
      orgId,
      orgName: (org?.name as string) || "your workspace",
      inviterName: (inviter?.full_name as string) ?? null,
      role: "member",
      acceptUrl: actionLink,
      isNewUser: Boolean(actionLink),
      idempotencySuffix: `resend-${Date.now()}`,
    });

    await supabaseAdmin
      .from("organization_members")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", row.id);

    return { email };
  });

export type AcceptInviteResult = {
  accepted: number;
  org_names: string[];
};

/**
 * Activates every pending membership belonging to the signed-in user. The
 * invite email link lands here, so accepting works regardless of which
 * workspace(s) invited them.
 */
export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AcceptInviteResult> => {
    // Members cannot update their own membership row (RLS restricts updates to
    // owners/admins), so activation runs with the privileged client after the
    // middleware has verified the caller.
    const { activateMembershipsForUser } = await import("@/lib/membership.server");
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    const result = await activateMembershipsForUser(context.userId, email);
    return { accepted: result.activated, org_names: result.org_names };
  });



