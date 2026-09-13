import type { SupabaseClient } from "@supabase/supabase-js";

/** Cross-tenant admin reads — service role only, never expose to the browser. */
export async function assertPlatformAdminEmail(
  supabaseAdmin: SupabaseClient,
  email: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("Sign in with your platform admin account.");

  const { data: grant } = await supabaseAdmin
    .from("platform_access_grants")
    .select("email")
    .eq("is_active", true)
    .ilike("email", normalized)
    .maybeSingle();

  if (!grant) throw new Error("Platform admin access required.");
}

/** Optional second gate — set ADMIN_CONSOLE_PASSWORD in server env. */
export function assertAdminConsolePassword(provided?: string | null): void {
  const expected = process.env["ADMIN_CONSOLE_PASSWORD"]?.trim();
  if (!expected) return;
  if (!provided || provided !== expected) {
    throw new Error("Invalid admin console password.");
  }
}

export async function requirePlatformAdminContext(
  supabaseAdmin: SupabaseClient,
  email: string,
  adminPassword?: string | null,
): Promise<void> {
  assertAdminConsolePassword(adminPassword);
  await assertPlatformAdminEmail(supabaseAdmin, email);
}

const SIGNED_URL_TTL = 60 * 60;

export type ScanAssetUrls = {
  annotated_image_url?: string;
  original_image_url?: string;
  pdf_url?: string;
  csv_url?: string;
};

/** Signed URLs for a scan's stored assets (service role). */
export async function resolveAdminScanAssetUrls(
  supabaseAdmin: SupabaseClient,
  scanId: string,
): Promise<ScanAssetUrls> {
  const { data: images } = await supabaseAdmin
    .from("scan_images")
    .select("kind, storage_bucket, storage_path")
    .eq("scan_id", scanId);

  const pick = (kinds: string[]) =>
    (images ?? []).find((img) => kinds.includes(String(img.kind)));

  const urls: ScanAssetUrls = {};
  const entries: Array<[keyof ScanAssetUrls, string[]]> = [
    ["pdf_url", ["pdf", "report"]],
    ["annotated_image_url", ["annotated"]],
    ["original_image_url", ["original"]],
    ["csv_url", ["csv"]],
  ];

  await Promise.all(
    entries.map(async ([key, kinds]) => {
      const row = pick(kinds);
      if (!row?.storage_path) return;
      const { data: signed } = await supabaseAdmin.storage
        .from(String(row.storage_bucket))
        .createSignedUrl(String(row.storage_path), SIGNED_URL_TTL);
      if (signed?.signedUrl) urls[key] = signed.signedUrl;
    }),
  );

  return urls;
}

/** Batch preview thumbnails for admin scan tables. */
export async function resolveAdminScanPreviewUrls(
  supabaseAdmin: SupabaseClient,
  scanIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!scanIds.length) return out;

  const { data: images } = await supabaseAdmin
    .from("scan_images")
    .select("scan_id, kind, storage_bucket, storage_path")
    .in("scan_id", scanIds)
    .in("kind", ["annotated", "original"]);

  const byScan = new Map<string, { annotated?: typeof images[0]; original?: typeof images[0] }>();
  for (const img of images ?? []) {
    const sid = String(img.scan_id);
    const slot = byScan.get(sid) ?? {};
    if (img.kind === "annotated") slot.annotated = img;
    else if (img.kind === "original") slot.original = img;
    byScan.set(sid, slot);
  }

  await Promise.all(
    [...byScan.entries()].map(async ([scanId, slot]) => {
      const row = slot.annotated ?? slot.original;
      if (!row?.storage_path) return;
      const { data: signed } = await supabaseAdmin.storage
        .from(String(row.storage_bucket))
        .createSignedUrl(String(row.storage_path), SIGNED_URL_TTL);
      if (signed?.signedUrl) out.set(scanId, signed.signedUrl);
    }),
  );

  return out;
}
