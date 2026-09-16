/**
 * Manual Assignment Grid — manager overrides for location → employee → due → status.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId } from "@/lib/db/context";
import type { AssignmentState } from "./types";

export type AssignmentGridRow = {
  id: string;
  store_id: string;
  store_name: string;
  assignee_id: string;
  assignee_name: string;
  due_at: string | null;
  status: string;
  assignment_state: AssignmentState;
  campaign_id: string | null;
  schedule_id: string | null;
  template_id: string | null;
  created_at: string;
};

const GRID_SELECT =
  "id, store_id, assignee_id, due_at, status, assignment_state, campaign_id, schedule_id, template_id, created_at, stores:store_id (name)";

async function fetchNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", unique);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(
      row.id as string,
      (row.full_name as string | null)?.trim() || (row.email as string | null) || "Team member",
    );
  }
  return map;
}

export async function fetchAssignmentGridRows(filters?: {
  campaignId?: string;
  scheduleId?: string;
  status?: string;
}): Promise<AssignmentGridRow[]> {
  const orgId = await requireOrgId();
  let query = supabase
    .from("scan_assignments")
    .select(GRID_SELECT)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (filters?.campaignId) query = query.eq("campaign_id", filters.campaignId);
  if (filters?.scheduleId) query = query.eq("schedule_id", filters.scheduleId);
  if (filters?.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) {
    if (error.code === "42703") {
      throw new Error("Assignment grid columns not available. Apply universal assignment migration.");
    }
    dbError(error, "Could not load assignment grid.");
  }

  const rows = data ?? [];
  const nameMap = await fetchNames(rows.flatMap((r) => [r.assignee_id as string]));

  return rows.map((row) => ({
    id: row.id as string,
    store_id: row.store_id as string,
    store_name: (row.stores as { name?: string })?.name ?? "Store",
    assignee_id: row.assignee_id as string,
    assignee_name: nameMap.get(row.assignee_id as string) ?? "Team member",
    due_at: row.due_at as string | null,
    status: row.status as string,
    assignment_state: (row.assignment_state as AssignmentState) ?? "assigned",
    campaign_id: (row.campaign_id as string) ?? null,
    schedule_id: (row.schedule_id as string) ?? null,
    template_id: (row.template_id as string) ?? null,
    created_at: row.created_at as string,
  }));
}

export async function updateAssignmentGridRow(input: {
  assignmentId: string;
  assigneeId?: string;
  dueAt?: string;
  assignmentState?: AssignmentState;
  status?: string;
}): Promise<void> {
  const { data, error } = await supabase.rpc("update_assignment_grid_row", {
    p_assignment_id: input.assignmentId,
    p_assignee_id: input.assigneeId ?? null,
    p_due_at: input.dueAt ?? null,
    p_assignment_state: input.assignmentState ?? null,
    p_status: input.status ?? null,
  });

  if (error) {
    if (error.code === "42883") {
      const orgId = await requireOrgId();
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.assigneeId) patch.assignee_id = input.assigneeId;
      if (input.dueAt) patch.due_at = input.dueAt;
      if (input.assignmentState) patch.assignment_state = input.assignmentState;
      if (input.status) patch.status = input.status;
      const { error: updErr } = await supabase
        .from("scan_assignments")
        .update(patch)
        .eq("org_id", orgId)
        .eq("id", input.assignmentId);
      if (updErr) dbError(updErr, "Could not update assignment.");
      return;
    }
    dbError(error, "Could not update assignment.");
  }

  void data;
}

export async function bulkUpdateAssignmentGrid(input: {
  assignmentIds: string[];
  assigneeId?: string;
  dueAt?: string;
  assignmentState?: AssignmentState;
  status?: string;
}): Promise<void> {
  for (const id of input.assignmentIds) {
    await updateAssignmentGridRow({
      assignmentId: id,
      assigneeId: input.assigneeId,
      dueAt: input.dueAt,
      assignmentState: input.assignmentState,
      status: input.status,
    });
  }
}
