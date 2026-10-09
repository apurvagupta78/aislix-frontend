/**
 * Shelf photos behind a corrective action, so the owner can see which audit and which
 * part of the shelf the action is about.
 */

import { supabase } from "@/integrations/supabase/client";
import type { FacingBox } from "@/lib/scan-results";

export type ActionPhoto = {
  url: string;
  label: string;
  /** Problem areas in image pixels (or 0–1 when the source stored normalised boxes). */
  boxes: FacingBox[];
};

const MAX_PHOTOS = 6;
const MAX_BOXES = 12;
const VIDEO_PATH = /\.(mp4|mov|webm|m4v)$/i;

async function signed(path: string, buckets: readonly string[]): Promise<string | null> {
  for (const bucket of buckets) {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (data?.signedUrl) return data.signedUrl;
  }
  return null;
}

function boxOf(raw: unknown): FacingBox | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const [x1, y1, x2, y2] = ["x1", "y1", "x2", "y2"].map((k) => Number(r[k]));
  if (![x1, y1, x2, y2].every(Number.isFinite) || x2! <= x1! || y2! <= y1!) return null;
  return { x1: x1!, y1: y1!, x2: x2!, y2: y2! };
}

const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** True when a detected product row is the product the action is about. */
export function matchesActionProduct(
  row: { sku?: string | null; name?: string | null },
  target: { sku?: string | null; productName?: string | null },
): boolean {
  const sku = norm(target.sku);
  if (sku && norm(row.sku) === sku) return true;
  const want = norm(target.productName);
  const have = norm(row.name);
  if (!want || !have) return false;
  return have === want || (want.length >= 6 && (have.includes(want) || want.includes(have)));
}

async function aiPhotos(
  scanId: string,
  target: { sku?: string | null; productName?: string | null },
): Promise<ActionPhoto[]> {
  const [{ data: images }, { data: products }] = await Promise.all([
    supabase.from("scan_images").select("kind, storage_bucket, storage_path").eq("scan_id", scanId),
    target.sku || target.productName
      ? supabase
          .from("detected_products")
          .select("sku, name, bounding_box")
          .eq("scan_id", scanId)
          .not("bounding_box", "is", null)
          .limit(500)
      : Promise.resolve({ data: [] as { sku: string | null; name: string | null; bounding_box: unknown }[] }),
  ]);
  const rows = (images ?? []) as { kind: string; storage_bucket: string; storage_path: string }[];
  const original = rows.find((r) => r.kind === "original") ?? rows.find((r) => r.kind === "annotated");
  if (!original) return [];
  const url = await signed(original.storage_path, [original.storage_bucket || "scan-images"]);
  if (!url) return [];
  const boxes = ((products ?? []) as { sku: string | null; name: string | null; bounding_box: unknown }[])
    .filter((p) => matchesActionProduct(p, target))
    .map((p) => boxOf(p.bounding_box))
    .filter((b): b is FacingBox => b !== null)
    .slice(0, MAX_BOXES);
  // Boxes are drawn on the untouched photo; they only line up with that one.
  return [{ url, label: "Shelf photo", boxes: original.kind === "original" ? boxes : [] }];
}

async function digitalPhotos(scanId: string): Promise<ActionPhoto[]> {
  const { data } = await supabase
    .from("audit_evidence")
    .select("storage_path, bin_key, device_info, captured_at")
    .eq("scan_id", scanId)
    .order("captured_at", { ascending: true })
    .limit(30);
  const rows = ((data ?? []) as {
    storage_path: string | null;
    bin_key: string | null;
    device_info: { media_type?: string } | null;
  }[]).filter(
    (r) => r.storage_path && r.device_info?.media_type !== "video" && !VIDEO_PATH.test(r.storage_path),
  );
  const photos = await Promise.all(
    rows.slice(0, MAX_PHOTOS).map(async (r, i): Promise<ActionPhoto | null> => {
      const url = await signed(r.storage_path!, ["audit-evidence", "scan-images"]);
      return url ? { url, label: `Evidence photo ${i + 1}`, boxes: [] } : null;
    }),
  );
  return photos.filter((p): p is ActionPhoto => p !== null);
}

export async function fetchActionPhotos(input: {
  scanId: string;
  source: "ai" | "digital";
  sku?: string | null;
  productName?: string | null;
}): Promise<ActionPhoto[]> {
  const photos =
    input.source === "digital"
      ? await digitalPhotos(input.scanId)
      : await aiPhotos(input.scanId, { sku: input.sku, productName: input.productName });
  // Older AI audits saved evidence the digital way; try the other store before giving up.
  if (photos.length) return photos;
  return input.source === "digital"
    ? aiPhotos(input.scanId, { sku: input.sku, productName: input.productName })
    : digitalPhotos(input.scanId);
}
