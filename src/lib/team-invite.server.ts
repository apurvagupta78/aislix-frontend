/**
 * Server-only invite email helpers.
 *
 * Branded invite emails go out through Lovable's managed email API. New users
 * get a Supabase invite action link (generated, not emailed by Supabase, so
 * they only ever receive the Aislix-branded message); existing users get a
 * plain /accept-invite link they open after signing in.
 */

import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import { serverAppOrigin } from "@/lib/app-origin";

/** Canonical origin for invite links; never a preview host. Read at call time. */
export const siteUrl = () => serverAppOrigin();

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Store manager",
  member: "Team member",
};

/** Creates an invite action link for an email with no Aislix account yet. */
export async function generateInviteLink(
  admin: {
    auth: {
      admin: {
        generateLink: (args: Record<string, unknown>) => Promise<{
          data: {
            properties?: { action_link?: string } | null;
            user?: { id?: string } | null;
          } | null;
          error: { message: string } | null;
        }>;
      };
    };
  },
  email: string,
  orgId: string,
  fullName?: string | null,
): Promise<{ link: string | null; userId: string | null }> {
  const redirectTo = `${siteUrl()}/accept-invite?org=${orgId}&email=${encodeURIComponent(email)}&setup=1`;
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo, ...(fullName ? { data: { full_name: fullName } } : {}) },
  });
  if (error) return { link: null, userId: null };
  return {
    link: data?.properties?.action_link ?? null,
    userId: data?.user?.id ?? null,
  };
}

/** True when the account exists but has never signed in (still needs a password). */
export async function accountNeedsSetup(
  admin: {
    auth: {
      admin: {
        getUserById: (id: string) => Promise<{
          data: { user: { last_sign_in_at?: string | null } | null } | null;
        }>;
      };
    };
  },
  userId: string,
): Promise<boolean> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return Boolean(data?.user) && !data?.user?.last_sign_in_at;
}

export async function sendInviteEmail(input: {
  email: string;
  orgName: string;
  orgId: string;
  inviterName?: string | null;
  role: string;
  acceptUrl?: string | null;
  isNewUser: boolean;
  idempotencySuffix: string;
}): Promise<void> {
  const acceptUrl =
    input.acceptUrl ||
    `${siteUrl()}/accept-invite?org=${input.orgId}&email=${encodeURIComponent(input.email)}`;
  try {
    await sendTemplateEmail("team-invite", input.email, {
      idempotencyKey: `team-invite-${input.orgId}-${input.email}-${input.idempotencySuffix}`,
      templateData: {
        orgName: input.orgName,
        inviterName: input.inviterName ?? undefined,
        roleLabel: ROLE_LABELS[input.role] ?? "Team member",
        acceptUrl,
        isNewUser: input.isNewUser,
      },
    });
  } catch (error) {
    // Membership is already written; a delivery failure must not fail the invite.
    console.error("[team-invite] email send failed", error);
  }
}
