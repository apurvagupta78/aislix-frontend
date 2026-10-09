/**
 * Corrective action + SLA chosen per product at the end of an AI or Digital audit.
 * Submitting creates the actions (owner and SLA clock start at once) or closes the audit
 * when nothing needs fixing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { dbError } from "@/lib/db/context";
import type { IssueCategory } from "@/lib/corrective-action-catalog";

export type SlaChoice = "60" | "720" | "1440" | "2880" | "other";

export const SLA_CHOICES: { value: SlaChoice; label: string }[] = [
  { value: "60", label: "Within 1 hour" },
  { value: "720", label: "Within 12 hours" },
  { value: "1440", label: "Within 24 hours" },
  { value: "2880", label: "Within 48 hours" },
  { value: "other", label: "Other" },
];

export type SlaUnit = "hours" | "days";

export const MIN_SLA_MINUTES = 15;
export const MAX_SLA_MINUTES = 30 * 1440;

export type IssueDraft = {
  key: string;
  product: string | null;
  sku: string | null;
  /** null = no issue on this product. */
  category: IssueCategory | null;
  detail: string;
  sla: SlaChoice;
  otherAmount: string;
  otherUnit: SlaUnit;
};

export function emptyDraft(key: string, product: string | null, sku: string | null): IssueDraft {
  return { key, product, sku, category: null, detail: "", sla: "1440", otherAmount: "", otherUnit: "hours" };
}

/** Minutes for the chosen SLA, or null when "Other" is blank or out of range. */
export function slaMinutesOf(d: Pick<IssueDraft, "sla" | "otherAmount" | "otherUnit">): number | null {
  if (d.sla !== "other") return Number(d.sla);
  const amount = Number(d.otherAmount.replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const minutes = Math.round(amount * (d.otherUnit === "days" ? 1440 : 60));
  return minutes >= MIN_SLA_MINUTES && minutes <= MAX_SLA_MINUTES ? minutes : null;
}

/** First problem that blocks submitting this issue, or null when it is complete. */
export function draftProblem(d: IssueDraft): string | null {
  if (!d.category) return null;
  if (d.category === "other" && !d.detail.trim()) return "Describe the issue";
  if (slaMinutesOf(d) == null) return "Enter a deadline between 15 minutes and 30 days";
  return null;
}

export type AuditActionItem = {
  category: IssueCategory;
  detail: string | null;
  product: string | null;
  sku: string | null;
  sla_minutes: number;
};

export function itemsFromDrafts(drafts: IssueDraft[]): AuditActionItem[] {
  return drafts
    .filter((d) => d.category && !draftProblem(d))
    .map((d) => ({
      category: d.category!,
      detail: d.detail.trim() || null,
      product: d.product?.trim() || null,
      sku: d.sku?.trim() || null,
      sla_minutes: slaMinutesOf(d)!,
    }));
}

export async function submitAuditActions(input: {
  scanId: string;
  items: AuditActionItem[];
  assigneeId: string | null;
  note?: string | null;
}): Promise<{ created: number }> {
  const { data, error } = await (supabase as unknown as SupabaseClient).rpc("submit_audit_actions", {
    p_scan_id: input.scanId,
    p_items: input.items,
    p_assignee: input.assigneeId,
    p_note: input.note?.trim() || null,
  });
  if (error) dbError(error, "Could not submit the corrective actions.");
  return { created: Number((data as { created?: number } | null)?.created ?? 0) };
}

export type AuditActionReview = {
  status: "actions_assigned" | "closed_no_issue" | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  note: string | null;
  canSubmit: boolean;
  actions: {
    id: string;
    code: string | null;
    title: string;
    status: string;
    dueAt: string | null;
    slaMinutes: number | null;
    assignedTo: string | null;
  }[];
};

export async function fetchAuditActionReview(scanId: string): Promise<AuditActionReview> {
  const db = supabase as unknown as SupabaseClient;
  const [{ data: scan, error }, { data: canSubmit }, { data: actions }] = await Promise.all([
    db
      .from("shelf_scans")
      .select("action_review_status, action_reviewed_at, action_reviewed_by, action_review_note")
      .eq("id", scanId)
      .maybeSingle(),
    db.rpc("can_review_scan_actions", { p_scan_id: scanId }),
    db
      .from("corrective_actions")
      .select("id, code, title, suggestion, status, due_at, sla_minutes, assigned_to")
      .eq("scan_id", scanId)
      .eq("raised_manually", true)
      .order("created_at", { ascending: true }),
  ]);
  if (error) dbError(error, "Could not load this audit's corrective actions.");
  const row = (scan ?? {}) as Record<string, unknown>;
  const actionRows = (actions ?? []) as Record<string, unknown>[];
  const ids = [
    ...new Set(
      [row.action_reviewed_by, ...actionRows.map((a) => a.assigned_to)].filter(
        (id): id is string => typeof id === "string",
      ),
    ),
  ];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of profiles ?? []) names.set(p.id, p.full_name || p.email || "Team member");
  }
  return {
    status: (row.action_review_status as AuditActionReview["status"]) ?? null,
    reviewedAt: (row.action_reviewed_at as string | null) ?? null,
    reviewedBy: row.action_reviewed_by ? (names.get(row.action_reviewed_by as string) ?? null) : null,
    note: (row.action_review_note as string | null) ?? null,
    canSubmit: canSubmit === true,
    actions: actionRows.map((a) => ({
      id: String(a.id),
      code: (a.code as string | null) ?? null,
      title: String(a.title ?? a.suggestion ?? "Corrective action"),
      status: String(a.status),
      dueAt: (a.due_at as string | null) ?? null,
      slaMinutes: a.sla_minutes == null ? null : Number(a.sla_minutes),
      assignedTo: a.assigned_to ? (names.get(a.assigned_to as string) ?? "Team member") : null,
    })),
  };
}
