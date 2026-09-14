/**
 * Corrective action lifecycle on top of the existing corrective_actions table.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import type { Finding, FindingSeverity } from "@/lib/findings";
import { notifyMember } from "@/lib/notifications.functions";

export type LifecycleActionStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "pending_verification"
  | "resolved"
  | "rejected"
  | "overdue"
  | "closed";

export type LifecycleAction = {
  id: string;
  finding_id: string | null;
  scan_id: string | null;
  store_id: string | null;
  org_id: string;
  title: string;
  description: string | null;
  suggestion: string;
  issue_type: string;
  priority: FindingSeverity;
  status: LifecycleActionStatus;
  assigned_to: string | null;
  assigned_name: string;
  created_by: string | null;
  sla_hours: number | null;
  due_at: string | null;
  created_at: string;
  start_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  resolution_qty: number | null;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  closed_at: string | null;
  sku: string | null;
};

export const LIFECYCLE_STATUSES: { value: LifecycleActionStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "pending_verification", label: "Pending verification" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
  { value: "overdue", label: "Overdue" },
  { value: "closed", label: "Closed" },
];

export function actionPriorityClass(priority: string): string {
  if (priority === "critical") return "bg-destructive/12 text-destructive";
  if (priority === "high") return "bg-orange-500/12 text-orange-700";
  if (priority === "medium") return "bg-amber-500/12 text-amber-700";
  return "bg-emerald-500/12 text-emerald-700";
}

export function slaRemainingLabel(dueAt: string | null, status: string): string {
  if (!dueAt) return "No SLA";
  if (["resolved", "closed"].includes(status)) return "Complete";
  const ms = new Date(dueAt).getTime() - Date.now();
  const hours = Math.abs(ms) / 36e5;
  const text = hours >= 24 ? `${(hours / 24).toFixed(1)} days` : `${Math.round(hours)} hours`;
  return ms < 0 ? `Overdue by ${text}` : `${text} remaining`;
}

export function daysOpen(createdAt: string, closedAt?: string | null): number {
  const end = closedAt ? new Date(closedAt).getTime() : Date.now();
  return Math.max(0, Math.round((end - new Date(createdAt).getTime()) / 864e5));
}

export type LifecycleActionsKpis = {
  open: number;
  critical: number;
  dueToday: number;
  overdue: number;
  pending_verification: number;
  resolved: number;
  closed: number;
};

export function lifecycleActionsKpis(actions: LifecycleAction[]): LifecycleActionsKpis {
  const openStatuses = new Set(["open", "assigned", "in_progress", "overdue", "rejected"]);
  const now = new Date();
  const open = actions.filter((a) => openStatuses.has(a.status));
  return {
    open: open.length,
    critical: open.filter((a) => a.priority === "critical").length,
    dueToday: open.filter((a) => {
      if (!a.due_at) return false;
      return new Date(a.due_at).toDateString() === now.toDateString();
    }).length,
    overdue: open.filter((a) => slaRemainingLabel(a.due_at, a.status).startsWith("Overdue")).length,
    pending_verification: actions.filter((a) => a.status === "pending_verification").length,
    resolved: actions.filter((a) => a.status === "resolved").length,
    closed: actions.filter((a) => a.status === "closed").length,
  };
}

async function slaHours(orgId: string, severity: FindingSeverity): Promise<number> {
  const { data } = await supabase.from("org_sla_defaults").select("*").eq("org_id", orgId).maybeSingle();
  if (!data) {
    return severity === "critical" ? 4 : severity === "high" ? 12 : severity === "medium" ? 24 : 72;
  }
  if (severity === "critical") return Number(data.critical_hours) || 4;
  if (severity === "high") return Number(data.high_hours) || 12;
  if (severity === "medium") return Number(data.medium_hours) || 24;
  return Number(data.low_hours) || 72;
}

export async function fetchLifecycleActions(input: {
  findingId?: string;
  scanId?: string;
  storeId?: string;
  status?: string;
} = {}): Promise<LifecycleAction[]> {
  const orgId = await requireOrgId();
  let query = supabase.from("corrective_actions").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(400);
  if (input.findingId) query = query.eq("finding_id", input.findingId);
  if (input.scanId) query = query.eq("scan_id", input.scanId);
  if (input.storeId && input.storeId !== "all") query = query.eq("store_id", input.storeId);
  if (input.status && input.status !== "all") query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) {
    if (error.code === "42703" || error.code === "42P01") return [];
    dbError(error, "Could not load corrective actions.");
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  const userIds = [
    ...new Set(rows.flatMap((r) => [r.assigned_to, r.created_by, r.verified_by]).filter(Boolean)),
  ] as string[];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const names = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || p.email || "Team member"]),
  );
  return rows.map((row) => mapAction(row, names));
}

export async function fetchLifecycleAction(id: string): Promise<LifecycleAction | null> {
  const rows = await fetchLifecycleActions();
  return rows.find((r) => r.id === id) ?? null;
}

export async function createActionFromFinding(input: {
  finding: Finding;
  title?: string;
  description?: string;
  assignedTo: string;
  dueAt?: string | null;
}): Promise<string> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const hours = await slaHours(orgId, input.finding.severity);
  const dueAt =
    input.dueAt ?? new Date(Date.now() + hours * 36e5).toISOString();
  const title =
    input.title?.trim() ||
    `Investigate ${input.finding.title.toLowerCase()} — ${input.finding.product_name || input.finding.sku || "SKU"}`;
  const description =
    input.description?.trim() ||
    `Investigate and reconcile ${Math.abs(input.finding.variance_units ?? 0)}-unit variance.`;

  const { data, error } = await supabase
    .from("corrective_actions")
    .insert({
      org_id: orgId,
      finding_id: input.finding.id,
      scan_id: input.finding.scan_id,
      store_id: input.finding.store_id,
      comparison_id: null,
      issue_type: input.finding.finding_type,
      suggestion: title,
      title,
      description,
      status: "assigned",
      priority: input.finding.severity,
      assigned_to: input.assignedTo,
      created_by: userId,
      sla_hours: hours,
      due_at: dueAt,
      start_at: new Date().toISOString(),
      sku: input.finding.sku,
    })
    .select("id")
    .single();
  if (error) dbError(error, "Could not create corrective action.");

  await supabase
    .from("findings")
    .update({ status: "assigned", assigned_to: input.assignedTo, due_at: dueAt, updated_at: new Date().toISOString() })
    .eq("id", input.finding.id);

  await supabase.from("audit_activity_events").insert({
    org_id: orgId,
    scan_id: input.finding.scan_id,
    finding_id: input.finding.id,
    action_id: data.id,
    actor_id: userId,
    event_type: "action_assigned",
    summary: `Corrective action assigned: ${title}`,
  });

  try {
    await notifyMember({
      data: {
        org_id: orgId,
        user_id: input.assignedTo,
        type: "action_assigned",
        title: "Corrective action assigned",
        body: title,
        payload: { action_id: data.id, finding_id: input.finding.id, scan_id: input.finding.scan_id },
      },
    });
  } catch {
    /* delivery is best-effort */
  }

  if (input.finding.severity === "critical") {
    try {
      const { notifyAuditManagers } = await import("@/lib/notifications.functions");
      await notifyAuditManagers({
        data: {
          org_id: orgId,
          assignment_id: input.finding.assignment_id ?? "",
          type: "critical_finding",
          title: "Critical finding",
          body: input.finding.title,
          payload: { finding_id: input.finding.id, scan_id: input.finding.scan_id },
        },
      });
    } catch {
      /* ignore */
    }
  }

  return data.id as string;
}

export async function startAction(id: string): Promise<void> {
  await patchAction(id, { status: "in_progress", start_at: new Date().toISOString() }, "action_started", "Work started");
}

export async function submitResolution(input: {
  actionId: string;
  findingId?: string | null;
  notes: string;
  qty?: number | null;
  storagePath?: string | null;
}): Promise<void> {
  if (!input.notes.trim()) throw new Error("Resolution notes are required.");
  const userId = await requireUserId();
  const orgId = await requireOrgId();
  const now = new Date().toISOString();
  await patchAction(
    input.actionId,
    {
      status: "pending_verification",
      resolution_notes: input.notes.trim(),
      resolution_qty: input.qty ?? null,
      resolved_at: now,
      resolved_by: userId,
    },
    "resolution_submitted",
    "Resolution submitted for verification",
  );
  if (input.findingId) {
    await supabase
      .from("findings")
      .update({ status: "pending_verification", resolved_at: now, updated_at: now })
      .eq("id", input.findingId);
  }
  if (input.storagePath) {
    await supabase.from("resolution_evidence").insert({
      org_id: orgId,
      finding_id: input.findingId ?? null,
      action_id: input.actionId,
      storage_path: input.storagePath,
      notes: input.notes.trim(),
      resolution_qty: input.qty ?? null,
      captured_by: userId,
    });
  }
}

export async function approveAndClose(input: { actionId: string; findingId?: string | null }): Promise<void> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  await patchAction(
    input.actionId,
    {
      status: "closed",
      verified_by: userId,
      verified_at: now,
      closed_at: now,
    },
    "resolution_approved",
    "Manager verified and closed the action",
  );
  if (input.findingId) {
    await supabase
      .from("findings")
      .update({ status: "closed", verified_at: now, closed_at: now, updated_at: now })
      .eq("id", input.findingId);
  }
}

export async function rejectResolution(input: {
  actionId: string;
  findingId?: string | null;
  reason: string;
}): Promise<void> {
  if (!input.reason.trim()) throw new Error("A rejection reason is required.");
  const now = new Date().toISOString();
  await patchAction(
    input.actionId,
    {
      status: "in_progress",
      rejection_reason: input.reason.trim(),
      verified_at: null,
      verified_by: null,
    },
    "resolution_rejected",
    `Resolution rejected: ${input.reason.trim()}`,
  );
  if (input.findingId) {
    await supabase
      .from("findings")
      .update({ status: "in_progress", updated_at: now })
      .eq("id", input.findingId);
  }
}

async function patchAction(
  id: string,
  patch: Record<string, unknown>,
  eventType: string,
  summary: string,
): Promise<void> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("corrective_actions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("org_id, scan_id, finding_id")
    .maybeSingle();
  if (error) dbError(error, "Could not update corrective action.");
  if (data) {
    await supabase.from("audit_activity_events").insert({
      org_id: data.org_id,
      scan_id: data.scan_id,
      finding_id: data.finding_id,
      action_id: id,
      actor_id: userId,
      event_type: eventType,
      summary,
    });
  }
}

function mapAction(row: Record<string, unknown>, names: Map<string, string>): LifecycleAction {
  return {
    id: String(row.id),
    finding_id: (row.finding_id as string) ?? null,
    scan_id: (row.scan_id as string) ?? null,
    store_id: (row.store_id as string) ?? null,
    org_id: String(row.org_id),
    title: String(row.title || row.suggestion || "Corrective action"),
    description: (row.description as string) ?? null,
    suggestion: String(row.suggestion ?? ""),
    issue_type: String(row.issue_type ?? ""),
    priority: ((row.priority as FindingSeverity) || "medium") as FindingSeverity,
    status: (row.status as LifecycleActionStatus) ?? "open",
    assigned_to: (row.assigned_to as string) ?? null,
    assigned_name: row.assigned_to ? (names.get(row.assigned_to as string) ?? "Assigned") : "Unassigned",
    created_by: (row.created_by as string) ?? null,
    sla_hours: row.sla_hours == null ? null : Number(row.sla_hours),
    due_at: (row.due_at as string) ?? null,
    created_at: String(row.created_at),
    start_at: (row.start_at as string) ?? null,
    resolved_at: (row.resolved_at as string) ?? null,
    resolution_notes: (row.resolution_notes as string) ?? null,
    resolution_qty: row.resolution_qty == null ? null : Number(row.resolution_qty),
    verified_by: (row.verified_by as string) ?? null,
    verified_at: (row.verified_at as string) ?? null,
    rejection_reason: (row.rejection_reason as string) ?? null,
    closed_at: (row.closed_at as string) ?? null,
    sku: (row.sku as string) ?? null,
  };
}
