/**
 * In-app notifications (notifications table).
 *
 * Rows are addressed to a single user, so reads are never scoped by the active
 * organization — an assignee must see their task even when their session is
 * pointed at a different workspace.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireUserId } from "@/lib/db/context";

export type InboxNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  org_id: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export async function fetchInbox(limit = 20): Promise<InboxNotification[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, org_id, payload, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) dbError(error, "Could not load your notifications.");
  return (data ?? []).map((row) => ({
    id: row.id as string,
    type: String(row.type),
    title: String(row.title),
    body: (row.body as string | null) ?? null,
    org_id: row.org_id as string,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    read_at: (row.read_at as string | null) ?? null,
    created_at: row.created_at as string,
  }));
}

export async function fetchUnreadCount(): Promise<number> {
  const userId = await requireUserId();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const userId = await requireUserId();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
}

export async function markAllNotificationsRead(): Promise<void> {
  const userId = await requireUserId();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
}

/** Route a notification to the surface that can act on it. */
export function notificationHref(notification: InboxNotification): string {
  if (notification.type === "scan_assigned") return "/my-scans";
  if (notification.type === "scan_completed") return "/assigned-scans";
  return "/dashboard";
}
