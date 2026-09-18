/**
 * Demo evidence backfill — server only.
 * Pairs uploaded shelf photos 1:1 with the demo org's audits (oldest first) and
 * records them as audit evidence + scan images. Service-role client is passed in.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const DEMO_ORG_ID = "d0000000-0000-4000-8000-000000000001";
const BUCKET = "scan-images";

export type DemoEvidenceFile = {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type DemoEvidenceBackfillResult = {
  paired: number;
  uploaded: number;
  skipped: number;
  errors: string[];
};

function safeName(filename: string): string {
  const cleaned = filename.split(/[\\/]/).pop() ?? "evidence.jpg";
  return cleaned.replace(/[^\w.-]+/g, "_") || "evidence.jpg";
}

export async function backfillDemoEvidenceServer(
  supabaseAdmin: SupabaseClient,
  input: {
    files: DemoEvidenceFile[];
    capturedBy: string;
    maxImages?: number;
    force?: boolean;
  },
): Promise<DemoEvidenceBackfillResult> {
  const maxImages = Math.max(1, Math.min(input.maxImages ?? 20, 20));
  const force = Boolean(input.force);
  const files = input.files.slice(0, maxImages);
  const errors: string[] = [];

  if (!files.length) return { paired: 0, uploaded: 0, skipped: 0, errors: ["No images provided."] };

  const { data: scans, error: scansError } = await supabaseAdmin
    .from("shelf_scans")
    .select("id, org_id, created_at")
    .eq("org_id", DEMO_ORG_ID)
    .order("created_at", { ascending: true })
    .limit(maxImages);

  if (scansError) throw new Error(`Could not load demo audits: ${scansError.message}`);
  const rows = scans ?? [];
  if (!rows.length) {
    return { paired: 0, uploaded: 0, skipped: 0, errors: ["No demo audits found for the demo org."] };
  }

  const paired = Math.min(rows.length, files.length);
  let uploaded = 0;
  let skipped = 0;

  for (let i = 0; i < paired; i += 1) {
    const scan = rows[i] as { id: string; org_id: string };
    const file = files[i]!;
    const name = safeName(file.filename);
    const storagePath = `${DEMO_ORG_ID}/${scan.id}/evidence/bin-1-${name}`;

    try {
      if (!force) {
        const { data: existing } = await supabaseAdmin
          .from("audit_evidence")
          .select("storage_path")
          .eq("scan_id", scan.id)
          .eq("bin_key", "bin-1")
          .maybeSingle();
        if (existing?.storage_path === storagePath) {
          const { data: listed } = await supabaseAdmin.storage
            .from(BUCKET)
            .list(`${DEMO_ORG_ID}/${scan.id}/evidence`, { search: name, limit: 1 });
          if (listed?.length) {
            skipped += 1;
            continue;
          }
        }
      }

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(storagePath, file.bytes, { contentType: file.mimeType, upsert: true });
      if (uploadError) throw new Error(`upload failed: ${uploadError.message}`);

      const capturedAt = new Date().toISOString();

      const { error: evidenceError } = await supabaseAdmin.from("audit_evidence").upsert(
        {
          scan_id: scan.id,
          org_id: DEMO_ORG_ID,
          bin_key: "bin-1",
          storage_path: storagePath,
          captured_by: input.capturedBy,
          captured_at: capturedAt,
        } as never,
        { onConflict: "scan_id,bin_key" },
      );
      if (evidenceError) throw new Error(`evidence record failed: ${evidenceError.message}`);

      const imageRow = {
        scan_id: scan.id,
        kind: "original",
        storage_bucket: BUCKET,
        storage_path: storagePath,
        mime_type: file.mimeType,
        file_size_bytes: file.bytes.byteLength,
      };

      const { data: existingImage } = await supabaseAdmin
        .from("scan_images")
        .select("id")
        .eq("scan_id", scan.id)
        .eq("kind", "original")
        .maybeSingle();

      if (existingImage?.id) {
        const { error: updateError } = await supabaseAdmin
          .from("scan_images")
          .update(imageRow as never)
          .eq("id", existingImage.id);
        if (updateError) throw new Error(`image record update failed: ${updateError.message}`);
      } else {
        const { error: insertError } = await supabaseAdmin
          .from("scan_images")
          .insert(imageRow as never);
        if (insertError) throw new Error(`image record insert failed: ${insertError.message}`);
      }

      uploaded += 1;
    } catch (err) {
      errors.push(`${name}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return { paired, uploaded, skipped, errors };
}
