import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import { createScanAssignment, type AuditMode, type ScopeType, type ScopeValues } from "@/lib/assignments";
import { recordActivity } from "@/lib/audit-activity";
import { notifyMember } from "@/lib/notifications.functions";

export async function requestReaudit(input: {
  scanId: string;
  assignmentId: string;
  reason: string;
  assigneeId: string;
  assigneeName: string;
  dueAt?: string | null;
}): Promise<void> {
  if (!input.reason.trim()) throw new Error("A re-audit reason is required.");
  const orgId = await requireOrgId();
  const userId = await requireUserId();

  const { data: source } = await supabase
    .from("scan_assignments")
    .select("store_id, planogram_version_id, scope_type, scope_values, audit_mode, instructions")
    .eq("id", input.assignmentId)
    .maybeSingle();
  if (!source) throw new Error("Original assignment was not found.");

  await supabase
    .from("shelf_scans")
    .update({
      reaudit_reason: input.reason.trim(),
      locked_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("id", input.scanId);

  const createdId = await createScanAssignment({
    storeId: source.store_id as string,
    assigneeId: input.assigneeId,
    assigneeName: input.assigneeName,
    planogramVersionId: (source.planogram_version_id as string | null) ?? null,
    scopeType: ((source.scope_type as ScopeType) || "planogram") as ScopeType,
    scopeValues: (source.scope_values as ScopeValues) ?? {},
    dueAt: input.dueAt ?? null,
    instructions: `Re-audit of previous audit. Reason: ${input.reason.trim()}`,
    auditMode: (source.audit_mode as "ai" | "digital") ?? "digital",
  });

  await supabase
    .from("shelf_scans")
    .update({ parent_scan_id: input.scanId } as Record<string, unknown>)
    .eq("assignment_id", createdId);

  await recordActivity({
    orgId,
    scanId: input.scanId,
    eventType: "reaudit_requested",
    summary: `Re-audit requested: ${input.reason.trim()}`,
  });

  try {
    await notifyMember({
      data: {
        org_id: orgId,
        user_id: input.assigneeId,
        type: "reaudit_requested",
        title: "Re-audit requested",
        body: input.reason.trim(),
        payload: { scan_id: input.scanId, assignment_id: createdId, requested_by: userId },
      },
    });
  } catch {
    /* best effort */
  }
}

export async function uploadResolutionPhoto(file: File): Promise<string> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${orgId}/resolution/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("scan-images").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) dbError(error, "Could not upload resolution evidence.");
  return path;
}

export async function resolutionPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("scan-images").createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function fetchResolutionEvidence(actionId: string): Promise<
  { id: string; storage_path: string | null; notes: string | null; resolution_qty: number | null; created_at: string }[]
> {
  const { data, error } = await supabase
    .from("resolution_evidence")
    .select("id, storage_path, notes, resolution_qty, created_at")
    .eq("action_id", actionId)
    .order("created_at", { ascending: false });
  if (error) {
    if (error.code === "42P01") return [];
    dbError(error, "Could not load resolution evidence.");
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    storage_path: (row.storage_path as string) ?? null,
    notes: (row.notes as string) ?? null,
    resolution_qty: row.resolution_qty == null ? null : Number(row.resolution_qty),
    created_at: String(row.created_at),
  }));
}
