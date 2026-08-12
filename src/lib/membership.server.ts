/**
 * Membership activation.
 *
 * Invited members cannot activate themselves through the Data API: the
 * `organization_members` UPDATE policy is restricted to owners and admins. The
 * link between an invite row and the signed-in account therefore happens here
 * with the privileged client, after the auth middleware has already proven who
 * the caller is.
 */

export type ActivateMembershipsResult = {
  activated: number;
  org_ids: string[];
  org_names: string[];
};

export async function activateMembershipsForUser(
  userId: string,
  email?: string | null,
): Promise<ActivateMembershipsResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const normalizedEmail = (email ?? "").trim().toLowerCase();

  const rows = new Map<string, { id: string; org_id: string }>();

  const { data: byUser } = await supabaseAdmin
    .from("organization_members")
    .select("id, org_id")
    .eq("user_id", userId)
    .eq("status", "invited");
  for (const row of (byUser ?? []) as Array<{ id: string; org_id: string }>) {
    rows.set(row.id, row);
  }

  if (normalizedEmail) {
    // Invites created before the account existed are keyed on the email only.
    const { data: byEmail } = await supabaseAdmin
      .from("organization_members")
      .select("id, org_id")
      .ilike("invited_email", normalizedEmail)
      .eq("status", "invited");
    for (const row of (byEmail ?? []) as Array<{ id: string; org_id: string }>) {
      rows.set(row.id, row);
    }
  }

  if (!rows.size) return { activated: 0, org_ids: [], org_names: [] };

  const ids = [...rows.keys()];
  await supabaseAdmin
    .from("organization_members")
    .update({
      user_id: userId,
      status: "active" as never,
      invited_email: null,
      updated_at: new Date().toISOString(),
    } as never)
    .in("id", ids);

  const orgIds = [...new Set([...rows.values()].map((row) => row.org_id))];
  const { data: orgs } = await supabaseAdmin
    .from("organizations")
    .select("id, name")
    .in("id", orgIds);

  return {
    activated: ids.length,
    org_ids: orgIds,
    org_names: ((orgs ?? []) as Array<{ name: string | null }>).map(
      (org) => org.name || "Workspace",
    ),
  };
}
