/**
 * Expiry Control — inspections, packet observations, quarantine, review.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import type {
  ExpiryAssignment,
  ExpiryAttemptEvidence,
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
export * from "./coverage";

export async function fetchOverviewMetrics(storeId?: string): Promise<ExpiryOverviewMetrics> {
  const orgId = await requireOrgId();
  let base: ExpiryOverviewMetrics = {
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

  try {
    const { data, error } = await supabase.rpc("expiry_overview_metrics", {
      p_org_id: orgId,
      p_store_id: storeId ?? null,
    });
    if (!error && data) {
      base = data as ExpiryOverviewMetrics;
    } else if (error && error.code !== "42883") {
      console.error("[expiry] overview metrics RPC failed", error.message);
    }
  } catch (err) {
    console.error("[expiry] overview metrics RPC threw", err);
  }

  // Coverage layer — physical required units vs verified observations (never planogram expected).
  let requiredSum = 0;
  let verifiedSum = 0;
  let incompleteCount = 0;
  let hasRequired = false;

  try {
    const { computeExpiryEvidenceCoverage, resolveExpiryRequiredUnits } = await import("./coverage");
    let attemptsQuery = supabase
      .from("expiry_inspection_attempts")
      .select("id, physical_count, actual_quantity, inspection_status")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (storeId) attemptsQuery = attemptsQuery.eq("store_id", storeId);
    const { data: attempts, error: attemptsErr } = await attemptsQuery;
    if (attemptsErr) {
      console.error("[expiry] attempts coverage query failed", attemptsErr.message);
      return {
        ...base,
        required_units: null,
        verified_units: null,
        evidence_coverage_pct: null,
        evidence_incomplete_count: 0,
      };
    }

    for (const attempt of attempts ?? []) {
      if (attempt.inspection_status === "incomplete") incompleteCount += 1;
      const required = resolveExpiryRequiredUnits({
        physicalCount: attempt.physical_count as number | null,
        actualQuantity: attempt.actual_quantity as number | null,
      });
      if (required == null || required <= 0) continue;
      hasRequired = true;
      requiredSum += required;
      const { data: obs } = await supabase
        .from("expiry_packet_observations")
        .select("unreadable, wrong_product, human_confirmed_date, parsed_date, ai_suggested_date")
        .eq("attempt_id", attempt.id as string);
      const verifiedUnits = (obs ?? []).filter(
        (o) =>
          !o.unreadable &&
          !o.wrong_product &&
          (o.human_confirmed_date || o.parsed_date || o.ai_suggested_date),
      ).length;
      verifiedSum += verifiedUnits;
    }

    const coverage = computeExpiryEvidenceCoverage({
      requiredUnits: hasRequired ? requiredSum : null,
      verifiedUnits: hasRequired ? verifiedSum : null,
    });

    return {
      ...base,
      required_units: coverage.requiredUnits,
      verified_units: coverage.verifiedUnits,
      evidence_coverage_pct: coverage.coveragePct,
      evidence_incomplete_count: incompleteCount,
    };
  } catch (err) {
    console.error("[expiry] coverage layer failed", err);
    return {
      ...base,
      required_units: null,
      verified_units: null,
      evidence_coverage_pct: null,
      evidence_incomplete_count: incompleteCount,
    };
  }
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

export async function getEvidenceSignedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("audit-evidence").createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function uploadEvidence(
  file: File,
  attemptId: string,
  options: {
    linkType?: "context" | "packet_date" | "quarantine_contents" | "quarantine_seal" | "live_session";
    observationId?: string;
    sessionTimestampMs?: number;
    captureSource?: "in_app" | "imported" | "live_session";
    deviceMetadata?: Record<string, unknown>;
  } = {},
): Promise<{ path: string; hash: string; evidenceId: string | null }> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const { hashFileContent } = await import("@/lib/audit-builder/evidence-validation");
  const hash = await hashFileContent(file);
  const path = `${orgId}/${attemptId}/${crypto.randomUUID()}-${file.name.replace(/\s+/g, "_")}`;
  const { error: upErr } = await supabase.storage.from("audit-evidence").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (upErr) dbError(upErr, "Evidence upload failed.");

  const { data: asset, error: insErr } = await supabase
    .from("expiry_evidence_assets")
    .insert({
      org_id: orgId,
      storage_path: path,
      file_hash: hash,
      mime_type: file.type,
      capture_source: options.captureSource ?? "in_app",
      evidence_status: "uploaded",
      uploaded_by: userId,
      captured_at: new Date().toISOString(),
      device_metadata: options.deviceMetadata ?? {},
    })
    .select("id")
    .single();

  if (insErr && insErr.code !== "42P01") dbError(insErr, "Could not record evidence asset.");

  const evidenceId = (asset?.id as string) ?? null;
  if (evidenceId) {
    const { error: linkErr } = await supabase.from("expiry_evidence_links").insert({
      org_id: orgId,
      evidence_id: evidenceId,
      attempt_id: attemptId,
      observation_id: options.observationId ?? null,
      link_type: options.linkType ?? "packet_date",
      session_timestamp_ms: options.sessionTimestampMs ?? null,
    });
    if (linkErr && linkErr.code !== "42P01") dbError(linkErr, "Could not link evidence.");
  }

  return { path, hash, evidenceId };
}

export async function uploadSessionVideo(
  blob: Blob,
  attemptId: string,
  report: {
    markers: { packetOrdinal: number; offsetMs: number; label: string }[];
    durationMs: number;
    missingSegments: number;
    interrupted: boolean;
    mimeType: string;
  },
): Promise<string | null> {
  const ext = report.mimeType.includes("mp4") ? "mp4" : "webm";
  const file = new File([blob], `session-${attemptId}.${ext}`, { type: report.mimeType });
  const { evidenceId } = await uploadEvidence(file, attemptId, {
    linkType: "live_session",
    captureSource: "live_session",
    deviceMetadata: {
      continuity: {
        durationMs: report.durationMs,
        missingSegments: report.missingSegments,
        interrupted: report.interrupted,
      },
      markers: report.markers,
    },
  });
  return evidenceId;
}

export async function linkEvidenceToObservation(evidenceId: string, observationId: string, attemptId: string): Promise<void> {
  const orgId = await requireOrgId();
  const { error } = await supabase
    .from("expiry_evidence_links")
    .update({ observation_id: observationId })
    .eq("org_id", orgId)
    .eq("evidence_id", evidenceId)
    .eq("attempt_id", attemptId);
  if (error && error.code !== "42P01") dbError(error, "Could not link evidence to observation.");
}

export async function fetchAttemptEvidence(attemptId: string): Promise<ExpiryAttemptEvidence> {
  const orgId = await requireOrgId();
  const attempt = await fetchAttempt(attemptId);

  const { data: links, error } = await supabase
    .from("expiry_evidence_links")
    .select("*, asset:expiry_evidence_assets(*)")
    .eq("org_id", orgId)
    .eq("attempt_id", attemptId);

  if (error) {
    if (error.code === "42P01") {
      return { sessionVideo: null, packetPhotos: [], assuranceFallback: !!attempt.assurance_fallback };
    }
    dbError(error, "Could not load evidence.");
  }

  let sessionVideo: ExpiryAttemptEvidence["sessionVideo"] = null;
  const packetPhotos: ExpiryAttemptEvidence["packetPhotos"] = [];

  for (const row of links ?? []) {
    const asset = row.asset as Record<string, unknown> | null;
    if (!asset) continue;
    const signedUrl = (await getEvidenceSignedUrl(asset.storage_path as string)) ?? undefined;
    const enriched = { ...(asset as object), signedUrl } as ExpiryAttemptEvidence["sessionVideo"] & {
      signedUrl?: string;
    };

    if (row.link_type === "live_session") {
      sessionVideo = enriched;
    } else if (row.link_type === "packet_date" || row.link_type === "context") {
      packetPhotos.push({
        observationId: row.observation_id as string | null,
        packetOrdinal: null,
        asset: enriched as ExpiryAttemptEvidence["packetPhotos"][0]["asset"],
        sessionTimestampMs: row.session_timestamp_ms as number | null,
      });
    }
  }

  const observations = await fetchObservations(attemptId);
  for (const photo of packetPhotos) {
    if (photo.observationId) {
      const obs = observations.find((o) => o.id === photo.observationId);
      if (obs) photo.packetOrdinal = obs.packet_ordinal;
    }
  }

  return {
    sessionVideo,
    packetPhotos,
    assuranceFallback: !!attempt.assurance_fallback,
  };
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
