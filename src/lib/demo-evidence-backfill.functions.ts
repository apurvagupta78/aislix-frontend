/**
 * Platform-admin only: upload demo shelf evidence into the demo showcase org.
 * Images arrive as base64 payloads; storage writes use the server-side admin client.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePlatformAdminContext } from "@/lib/platform-admin.server";
import type { DemoEvidenceBackfillResult } from "@/lib/demo-evidence-backfill.server";

const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_FILES = 20;
const MAX_BYTES = 10 * 1024 * 1024;

export type DemoEvidenceUploadInput = {
  files: { filename: string; mimeType: string; base64: string }[];
  force?: boolean;
  adminPassword?: string;
};

export const backfillDemoEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: DemoEvidenceUploadInput) => {
    const files = Array.isArray(input?.files) ? input.files : [];
    if (!files.length) throw new Error("Select at least one image.");
    if (files.length > MAX_FILES) throw new Error(`Select at most ${MAX_FILES} images.`);
    for (const file of files) {
      if (!file?.base64) throw new Error(`${file?.filename ?? "file"}: empty upload.`);
      const mime = String(file.mimeType ?? "").toLowerCase();
      if (!ALLOWED_MIME.has(mime)) {
        throw new Error(`${file.filename}: only JPEG, PNG or WebP images are allowed.`);
      }
    }
    return { files, force: Boolean(input?.force), adminPassword: input?.adminPassword };
  })
  .handler(async ({ data, context }): Promise<DemoEvidenceBackfillResult> => {
    const email = String(context.claims?.email ?? "").toLowerCase();
    if (!email) throw new Error("Sign in with your platform admin account.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requirePlatformAdminContext(supabaseAdmin, email, data.adminPassword);

    const { backfillDemoEvidenceServer } = await import("@/lib/demo-evidence-backfill.server");

    const files = data.files.map((file) => {
      const cleaned = String(file.base64).replace(/^data:[^;]+;base64,/, "");
      const bytes = Uint8Array.from(Buffer.from(cleaned, "base64"));
      if (!bytes.byteLength) throw new Error(`${file.filename}: unreadable image.`);
      if (bytes.byteLength > MAX_BYTES) throw new Error(`${file.filename}: larger than 10MB.`);
      const mime = String(file.mimeType).toLowerCase();
      return {
        filename: String(file.filename ?? "evidence.jpg"),
        mimeType: mime === "image/jpg" ? "image/jpeg" : mime,
        bytes,
      };
    });

    return backfillDemoEvidenceServer(supabaseAdmin, {
      files,
      capturedBy: context.userId,
      maxImages: MAX_FILES,
      force: data.force,
    });
  });
