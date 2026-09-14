/**
 * Expiry Control — inspections, packet observations, quarantine, review.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import type {
  ExpiryAssignment,
  ExpiryException,
  ExpiryInspectionAttempt,
  ExpiryOverviewMetrics,
  ExpiryPacketObservation,
  ExpiryPolicyVersion,
  ExpiryQuarantineTransfer,
} from "./types";

export * from "./types";
export * from "./reconciliation";
export * from "./date-policy";
export * from "./transitions";

export async function fetchOverviewMetrics(storeId?: string): Promise<ExpiryOverviewMetrics> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase.rpc("expiry_overview_metrics", {
    p_org_id: orgId,
    p_store_id: storeId ?? null,
  });
  if (error) {
    if (error.code === "42883") {
      return {
        units_in_scope: 0,
        units_inspected: 0,
        expired_detected: 0,
        near_expiry: 0,
        unresolved_dates: 0,
        awaiting_removal_verification: 0,
        in_quarantine: 0,
        disposition_pending: 0,
        overdue_inspections: 0,
        open_exceptions: 0,
        refreshed_at: new Date().toISOString(),
      };
    }
    dbError(error, "Could not load expiry overview metrics.");
  }
  return data as ExpiryOverviewMetrics;
}

export async function fetchExceptions(limit = 100): Promise<ExpiryException[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("expiry_exceptions")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "open")
    .order("sort_priority", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (error.code === "42P01") return [];
    dbError(error, "Could not load expiry exceptions.");
  }
  return (data ?? []) as ExpiryException[];
}

export async function fetchMyInspections(): Promise<ExpiryInspectionAttempt[]> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("expiry_inspection_attempts")
    .select("*")
    .eq("org_id", orgId)
    .eq("auditor_id", userId)
    .in("inspection_status", ["assigned", "in_progress", "rework_required"])
    .order("due_at", { ascending: true });
  if (error) {
    if (error.code === "42P01") return [];
    dbError(error, "Could not load inspections.");
  }
  return (data ?? []) as ExpiryInspectionAttempt[];
}

export async function fetchReviewQueue(): Promise<ExpiryInspectionAttempt[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("expiry_inspection_attempts")
    .select("*")
    .eq("org_id", orgId)
    .in("inspection_status", ["submitted", "under_review"])
    .order("submitted_at", { ascending: false });
  if (error) {
    if (error.code === "42P01") return [];
    dbError(error, "Could not load review queue.");
  }
  return (data ?? []) as ExpiryInspectionAttempt[];
}

export async function fetchAttempt(attemptId: string): Promise<ExpiryInspectionAttempt> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("expiry_inspection_attempts")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", attemptId)
    .single();
  if (error) dbError(error, "Could not load inspection attempt.");
  return data as ExpiryInspectionAttempt;
}

export async function fetchObservations(attemptId: string): Promise<ExpiryPacketObservation[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("expiry_packet_observations")
    .select("*")
    .eq("org_id", orgId)
    .eq("attempt_id", attemptId)
    .order("packet_ordinal", { ascending: true });
  if (error) {
    if (error.code === "42P01") return [];
    dbError(error, "Could not load observations.");
  }
  return (data ?? []) as ExpiryPacketObservation[];
}

export async function fetchAssignments(): Promise<ExpiryAssignment[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("expiry_inspection_assignments")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    if (error.code === "42P01") return [];
    dbError(error, "Could not load assignments.");
  }
  return (data ?? []) as ExpiryAssignment[];
}

export async function fetchHistory(): Promise<ExpiryInspectionAttempt[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("expiry_inspection_attempts")
    .select("*")
    .eq("org_id", orgId)
    .in("inspection_status", ["verified", "incomplete", "cancelled"])
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) {
    if (error.code === "42P01") return [];
    dbError(error, "Could not load history.");
  }
  return (data ?? []) as ExpiryInspectionAttempt[];
}

export async function fetchPolicies(): Promise<ExpiryPolicyVersion[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("expiry_policy_versions")
    .select("*")
    .eq("org_id", orgId)
    .order("version", { ascending: false });
  if (error) {
    if (error.code === "42P01") return [];
    dbError(error, "Could not load policies.");
  }
  return (data ?? []) as ExpiryPolicyVersion[];
}

export async function fetchQuarantineTransfers(): Promise<ExpiryQuarantineTransfer[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("expiry_quarantine_transfers")
    .select("*, container:expiry_quarantine_containers(container_code, quarantine_location)")
    .eq("org_id", orgId)
    .order("transferred_at", { ascending: false })
    .limit(200);
  if (error) {
    if (error.code === "42P01") return [];
    dbError(error, "Could not load quarantine transfers.");
  }
  return (data ?? []).map((row: Record<string, unknown>) => {
    const c = row.container as { container_code?: string; quarantine_location?: string } | null;
    return {
      ...(row as ExpiryQuarantineTransfer),
      container_code: c?.container_code,
      quarantine_location: c?.quarantine_location,
    };
  });
}

export async function createAssignment(input: {
  storeId: string;
  title: string;
  auditorId: string;
  reviewerId?: string;
  dueAt?: string;
  sku?: string;
  assuranceLevel?: string;
  instructions?: string;
}): Promise<string> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("expiry_inspection_assignments")
    .insert({
      org_id: orgId,
      store_id: input.storeId,
      title: input.title,
      status: "assigned",
      auditor_id: input.auditorId,
      reviewer_id: input.reviewerId ?? null,
      due_at: input.dueAt ?? null,
      sku_filters: input.sku ? { sku: input.sku } : {},
      assurance_level: input.assuranceLevel ?? "standard",
      instructions: input.instructions ?? null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) dbError(error, "Could not create assignment.");

  const { data: attempt, error: attemptErr } = await supabase
    .from("expiry_inspection_attempts")
    .insert({
      org_id: orgId,
      assignment_id: data!.id,
      store_id: input.storeId,
      sku: input.sku ?? "",
      auditor_id: input.auditorId,
      reviewer_id: input.reviewerId ?? null,
      inspection_status: "assigned",
      expected_quantity: 0,
      due_at: input.dueAt ?? null,
    })
    .select("id")
    .single();
  if (attemptErr) dbError(attemptErr, "Could not create inspection attempt.");
  return attempt!.id as string;
}

export async function uploadEvidence(file: File, attemptId: string): Promise<{ path: string; hash: string }> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const { hashFileContent } = await import("@/lib/audit-builder/evidence-validation");
  const hash = await hashFileContent(file);
  const path = `${orgId}/${attemptId}/${crypto.randomUUID()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from("audit-evidence").upload(path, file);
  if (upErr) dbError(upErr, "Evidence upload failed.");

  const { error: insErr } = await supabase.from("expiry_evidence_assets").insert({
    org_id: orgId,
    storage_path: path,
    file_hash: hash,
    mime_type: file.type,
    capture_source: "in_app",
    evidence_status: "uploaded",
    uploaded_by: userId,
    captured_at: new Date().toISOString(),
  });
  if (insErr && insErr.code !== "42P01") dbError(insErr, "Could not record evidence asset.");
  return { path, hash };
}

export async function createQuarantineTransfer(input: {
  attemptId: string;
  storeId: string;
  containerCode: string;
  quarantineLocation: string;
  sku: string;
  quantity: number;
  removalReason: string;
  receiverId?: string;
}): Promise<string> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();

  const { data: container, error: cErr } = await supabase
    .from("expiry_quarantine_containers")
    .upsert(
      {
        org_id: orgId,
        store_id: input.storeId,
        container_code: input.containerCode,
        quarantine_location: input.quarantineLocation,
      },
      { onConflict: "org_id,container_code" },
    )
    .select("id")
    .single();
  if (cErr) dbError(cErr, "Could not create quarantine container.");

  const { data: transfer, error: tErr } = await supabase
    .from("expiry_quarantine_transfers")
    .insert({
      org_id: orgId,
      attempt_id: input.attemptId,
      container_id: container!.id,
      removal_reason: input.removalReason,
      sku: input.sku,
      quantity: input.quantity,
      sender_id: userId,
      receiver_id: input.receiverId ?? null,
      transfer_status: "reported",
    })
    .select("id")
    .single();
  if (tErr) dbError(tErr, "Could not record quarantine transfer.");
  return transfer!.id as string;
}

export async function seedDemoScenario(): Promise<Record<string, unknown>> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const { data, error } = await supabase.rpc("seed_expiry_demo_scenario", {
    p_org_id: orgId,
    p_user_id: userId,
  });
  if (error) dbError(error, "Could not seed demo scenario.");
  return (data ?? {}) as Record<string, unknown>;
}
