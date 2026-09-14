import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";

export type ActivityEvent = {
  id: string;
  scan_id: string | null;
  finding_id: string | null;
  action_id: string | null;
  actor_id: string | null;
  actor_name: string;
  event_type: string;
  summary: string;
  created_at: string;
};

export async function fetchAuditActivity(scanId: string): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("audit_activity_events")
    .select("*")
    .eq("scan_id", scanId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) {
    if (error.code === "42P01") return [];
    dbError(error, "Could not load activity.");
  }
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const names = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || p.email || "Team member"]),
  );
  return rows.map((row) => ({
    id: row.id as string,
    scan_id: (row.scan_id as string) ?? null,
    finding_id: (row.finding_id as string) ?? null,
    action_id: (row.action_id as string) ?? null,
    actor_id: (row.actor_id as string) ?? null,
    actor_name: row.actor_id ? (names.get(row.actor_id as string) ?? "Team member") : "System",
    event_type: String(row.event_type),
    summary: String(row.summary),
    created_at: String(row.created_at),
  }));
}

export async function recordActivity(input: {
  orgId?: string;
  scanId?: string | null;
  findingId?: string | null;
  actionId?: string | null;
  eventType: string;
  summary: string;
}): Promise<void> {
  const orgId = input.orgId ?? (await requireOrgId());
  const userId = await requireUserId();
  await supabase.from("audit_activity_events").insert({
    org_id: orgId,
    scan_id: input.scanId ?? null,
    finding_id: input.findingId ?? null,
    action_id: input.actionId ?? null,
    actor_id: userId,
    event_type: input.eventType,
    summary: input.summary,
  });
}
