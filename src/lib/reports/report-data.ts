/**
 * Report center data: the same RPCs and builders run in the browser (screen, PDF, Excel)
 * and on the server (email), always under the caller's own row-level security.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SegmentId } from "@/lib/segments/segment-config";
import type { SegmentDashboard, SegmentDashboardStore } from "@/lib/segments/segment-dashboard";
import {
  buildClaimReport,
  buildExecReport,
  buildFieldReport,
  buildStoreReport,
  type ClaimPack,
  type FieldCoverage,
  type ReportDays,
  type ReportDocument,
  type ReportKind,
} from "@/lib/reports/report-document";

const DAY_MS = 86_400_000;
export const CLAIM_PACK_LIMIT = 200;

export function reportPeriod(days: ReportDays, now: Date = new Date()): { from: string; to: string } {
  return { from: new Date(now.getTime() - days * DAY_MS).toISOString(), to: now.toISOString() };
}

export type ReportQuery = {
  kind: ReportKind;
  segment: SegmentId;
  dataOrgId: string;
  labeledDemo: boolean;
  from: string;
  to: string;
  /** null = every store the caller can read. */
  storeIds: string[] | null;
  storeName?: string | null;
};

async function rpc<T>(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await client.rpc(fn as never, args as never);
  if (error) throw new Error(error.message);
  return (data as T | null) ?? null;
}

export async function fetchReportDocument(client: SupabaseClient, q: ReportQuery): Promise<ReportDocument> {
  const args = { p_org_id: q.dataOrgId, p_from: q.from, p_to: q.to, p_store_ids: q.storeIds };
  const meta = { from: q.from, to: q.to, labeledDemo: q.labeledDemo };
  switch (q.kind) {
    case "store": {
      const data = await rpc<SegmentDashboard>(client, "segment_dashboard", args);
      return buildStoreReport(q.segment, data, q.storeName ?? data?.stores?.[0]?.store_name ?? "Store", meta);
    }
    case "exec":
      return buildExecReport(q.segment, await rpc<SegmentDashboard>(client, "segment_dashboard", args), meta);
    case "field":
      return buildFieldReport(q.segment, await rpc<FieldCoverage>(client, "field_team_coverage", args), meta);
    case "claim":
      return buildClaimReport(
        q.segment,
        await rpc<ClaimPack>(client, "claim_proof_pack", { ...args, p_limit: CLAIM_PACK_LIMIT }),
        { ...meta, storeName: q.storeName },
      );
  }
}

export type ReportStoreOption = Pick<SegmentDashboardStore, "store_name" | "city" | "audits"> & { store_id: string };

/** Stores with completed AI audits in the period — the store picker for per-store reports. */
export async function fetchReportStores(
  client: SupabaseClient,
  q: Pick<ReportQuery, "dataOrgId" | "from" | "to" | "storeIds">,
): Promise<ReportStoreOption[]> {
  const data = await rpc<SegmentDashboard>(client, "segment_dashboard", {
    p_org_id: q.dataOrgId,
    p_from: q.from,
    p_to: q.to,
    p_store_ids: q.storeIds,
  });
  return (data?.stores ?? [])
    .filter((s): s is SegmentDashboardStore & { store_id: string } => Boolean(s.store_id))
    .map((s) => ({ store_id: s.store_id, store_name: s.store_name, city: s.city, audits: s.audits }));
}

const SIGNED_PHOTO_TTL = 3600;
const MAX_SIGNED_PHOTOS = 60;

/** Short-lived links for the claim pack photo grid. Photos the caller cannot read stay without a URL. */
export async function signReportPhotos(client: SupabaseClient, doc: ReportDocument): Promise<ReportDocument> {
  const photos = doc.photos.slice(0, MAX_SIGNED_PHOTOS);
  if (!photos.length) return doc;
  const byBucket = new Map<string, string[]>();
  for (const p of photos) {
    if (!p.path) continue;
    const bucket = p.bucket ?? "scan-images";
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), p.path]);
  }
  const urls = new Map<string, string>();
  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, paths]) => {
      const { data } = await client.storage.from(bucket).createSignedUrls(paths, SIGNED_PHOTO_TTL);
      for (const row of data ?? []) {
        if (row.path && row.signedUrl) urls.set(`${bucket}/${row.path}`, row.signedUrl);
      }
    }),
  );
  return {
    ...doc,
    photos: photos.map((p) => ({ ...p, url: p.path ? urls.get(`${p.bucket ?? "scan-images"}/${p.path}`) ?? null : null })),
  };
}

export function reportUrl(
  origin: string,
  params: { kind: ReportKind; days: ReportDays; storeId?: string | null },
): string {
  const search = new URLSearchParams({ type: params.kind, days: String(params.days) });
  if (params.storeId) search.set("store", params.storeId);
  return `${origin.replace(/\/$/, "")}/report?${search.toString()}`;
}
