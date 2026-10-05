/**
 * Server re-check of audit evidence photos: the Aislix backend measures the stored file, the
 * audit's photo rules are applied again with server times, and the photo's fingerprint is matched
 * against every earlier photo in the organisation. Results gate submit in validate_audit_completion.
 */

import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { backendAuthHeaders } from "@/lib/backend-auth.server";
import { AUDIT_EVIDENCE_BUCKET, AUDIT_EVIDENCE_REF_PREFIX } from "@/lib/custom-audit-shared";
import type { AuditEvidencePolicy } from "@/lib/audit-evidence-policy";
import {
  SIMILAR_PHOTO_MAX_DISTANCE,
  captureTimeUtc,
  evaluateServerPhoto,
  type PhotoMetrics,
  type ServerPhotoIssue,
} from "@/lib/audit-engine/server-photo-check";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SWEEP = 150;
const SWEEP_BATCH = 6;

export type PhotoCheckResult = { ref: string; blocking: boolean; message: string | null; flags: string[] };

type PhotoContext = {
  org_id: string;
  policy: Partial<AuditEvidencePolicy> | null;
  opened_at: string | null;
  received_at: string | null;
  time_zone: string | null;
};

type PhotoMatches = {
  duplicate: { same_audit: boolean } | null;
  similar_count: number;
  similar_same_audit: boolean;
};

async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

function backendUrl(): string | null {
  const base = (process.env["AISLIX_AI_API_URL"] ?? process.env["RAILWAY_API_URL"] ?? process.env["SCAN_API_URL"] ?? "")
    .trim()
    .replace(/\/+$/, "");
  return base || null;
}

async function measurePhoto(signedUrl: string): Promise<PhotoMetrics | null> {
  const base = backendUrl();
  if (!base) return null;
  try {
    const response = await fetch(`${base}/evidence/photo-metrics`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...backendAuthHeaders() },
      body: JSON.stringify({ image_url: signedUrl }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as PhotoMetrics;
    return typeof body?.sha256 === "string" ? body : null;
  } catch {
    return null;
  }
}

/** Org of an assignment the signed-in user can see (row-level security). */
async function assignmentOrg(userClient: SupabaseClient, assignmentId: string): Promise<string> {
  const { data } = await userClient.from("scan_assignments").select("org_id").eq("id", assignmentId).maybeSingle();
  const org = (data as { org_id?: string } | null)?.org_id;
  if (!org) throw new Error("Audit not found.");
  return org;
}

function statusOf(issues: ServerPhotoIssue[]): "passed" | "flagged" | "rejected" | "not_checked" {
  if (issues.some((i) => i.blocking)) return "rejected";
  if (issues.some((i) => i.code === "not_checked")) return "not_checked";
  return issues.length ? "flagged" : "passed";
}

async function checkPhoto(input: {
  userClient: SupabaseClient;
  userId: string;
  assignmentId: string;
  orgId: string;
  ref: string;
}): Promise<PhotoCheckResult> {
  const { userClient, assignmentId, orgId, ref } = input;
  const path = ref.slice(AUDIT_EVIDENCE_REF_PREFIX.length);
  if (!ref.startsWith(AUDIT_EVIDENCE_REF_PREFIX) || !path.startsWith(`${orgId}/`) || path.includes("..")) {
    throw new Error("This photo doesn't belong to this organisation.");
  }
  const db = await admin();
  const { data: ctxData, error: ctxError } = await db.rpc("evidence_photo_context" as never, {
    p_assignment_id: assignmentId,
    p_path: path,
  } as never);
  const ctx = ctxData as PhotoContext | null;
  if (ctxError || !ctx) throw new Error("Could not check this photo. Try again.");
  const receivedAt = ctx.received_at ?? new Date().toISOString();

  const { data: signed } = ctx.received_at
    ? await userClient.storage.from(AUDIT_EVIDENCE_BUCKET).createSignedUrl(path, 120)
    : { data: null };
  const metrics = signed?.signedUrl ? await measurePhoto(signed.signedUrl) : null;

  let matches: PhotoMatches = { duplicate: null, similar_count: 0, similar_same_audit: false };
  if (metrics) {
    const { data } = await db.rpc("evidence_photo_matches" as never, {
      p_org: orgId,
      p_assignment_id: assignmentId,
      p_ref: ref,
      p_sha256: metrics.sha256,
      p_dhash: metrics.dhash,
      p_received_at: receivedAt,
      p_max_distance: SIMILAR_PHOTO_MAX_DISTANCE,
    } as never);
    if (data) matches = data as PhotoMatches;
  }

  const issues = evaluateServerPhoto({
    policy: ctx.policy,
    metrics,
    openedAt: ctx.opened_at ? new Date(ctx.opened_at) : null,
    receivedAt: new Date(receivedAt),
    timeZone: ctx.time_zone,
    duplicate: matches.duplicate ? { sameAudit: matches.duplicate.same_audit } : null,
    similar: { count: matches.similar_count ?? 0, sameAudit: Boolean(matches.similar_same_audit) },
  });
  const blocking = issues.some((i) => i.blocking);

  const { error: saveError } = await db.from("evidence_photo_checks" as never).upsert(
    {
      org_id: orgId,
      assignment_id: assignmentId,
      ref,
      storage_path: path,
      sha256: metrics?.sha256 ?? null,
      dhash: metrics?.dhash ?? null,
      taken_at: metrics ? (captureTimeUtc(metrics.exif_taken_at, metrics.exif_offset, ctx.time_zone)?.toISOString() ?? null) : null,
      received_at: receivedAt,
      width: metrics?.width ?? null,
      height: metrics?.height ?? null,
      brightness: metrics?.brightness ?? null,
      sharpness: metrics?.sharpness ?? null,
      decodable: metrics?.decodable ?? null,
      status: statusOf(issues),
      blocking,
      issues,
      checked_by: input.userId,
      checked_at: new Date().toISOString(),
    } as never,
    { onConflict: "assignment_id,ref" },
  );
  if (saveError) throw new Error("Could not save the photo check. Try again.");

  return {
    ref,
    blocking,
    message: issues.find((i) => i.blocking)?.message ?? null,
    // Missing camera time is common on phone browsers; it stays on the check row for reviewers.
    flags: issues.filter((i) => !i.blocking && i.code !== "no_capture_time").map((i) => i.message),
  };
}

/** Check one photo right after upload; a refused photo must not be saved to the audit. */
export const verifyEvidencePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { assignmentId: string; ref: string }) => {
    if (!UUID.test(input?.assignmentId ?? "")) throw new Error("Unknown audit.");
    if (typeof input.ref !== "string" || !input.ref.startsWith(AUDIT_EVIDENCE_REF_PREFIX) || input.ref.length > 500) {
      throw new Error("Unknown photo.");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<PhotoCheckResult> => {
    const userClient = context.supabase as unknown as SupabaseClient;
    const orgId = await assignmentOrg(userClient, data.assignmentId);
    return checkPhoto({ userClient, userId: context.userId, assignmentId: data.assignmentId, orgId, ref: data.ref });
  });

/** Before submit: check every photo the audit uses that hasn't been checked (or couldn't be). */
export const verifyPendingEvidencePhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { assignmentId: string }) => {
    if (!UUID.test(input?.assignmentId ?? "")) throw new Error("Unknown audit.");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ checked: number; refused: PhotoCheckResult[] }> => {
    const userClient = context.supabase as unknown as SupabaseClient;
    const orgId = await assignmentOrg(userClient, data.assignmentId);
    const db = await admin();
    const [{ data: refRows }, { data: checkRows }] = await Promise.all([
      db.rpc("audit_photo_refs" as never, { p_assignment_id: data.assignmentId } as never),
      db.from("evidence_photo_checks" as never).select("ref, status").eq("assignment_id", data.assignmentId),
    ]);
    const refs = ((refRows as unknown as Array<string | { audit_photo_refs?: string }> | null) ?? [])
      .map((r) => (typeof r === "string" ? r : (r?.audit_photo_refs ?? "")))
      .filter(Boolean);
    const status = new Map(((checkRows as Array<{ ref: string; status: string }> | null) ?? []).map((c) => [c.ref, c.status]));
    const pending = refs.filter((ref) => !status.has(ref) || status.get(ref) === "not_checked").slice(0, MAX_SWEEP);

    const refused: PhotoCheckResult[] = [];
    for (let i = 0; i < pending.length; i += SWEEP_BATCH) {
      const batch = await Promise.all(
        pending.slice(i, i + SWEEP_BATCH).map((ref) =>
          checkPhoto({ userClient, userId: context.userId, assignmentId: data.assignmentId, orgId, ref }).catch(() => null),
        ),
      );
      for (const result of batch) if (result?.blocking) refused.push(result);
    }
    return { checked: pending.length, refused };
  });
