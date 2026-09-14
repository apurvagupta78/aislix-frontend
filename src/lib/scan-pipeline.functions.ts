/**
 * Server function entrypoints for the AI scan pipeline.
 *
 * Thin wrappers only — all runtime logic lives in `scan-pipeline.server.ts`,
 * which is imported inside the handler so nothing server-only reaches the
 * client bundle.
 *
 * Large shelf scans can take 5+ minutes, so the flow is split into a fast
 * `startScanPipeline` (submit to Railway) plus repeated short
 * `pollScanPipeline` calls. `processScan` remains as the legacy one-shot call.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function validateScanId(input: { scanId: string }) {
  const scanId = typeof input?.scanId === "string" ? input.scanId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(scanId)) throw new Error("A valid audit id is required.");
  return { scanId };
}

export const startScanPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scanId: string }) => validateScanId(input))
  .handler(async ({ data, context }) => {
    const { startScanPipelineServer } = await import("@/lib/scan-pipeline.server");
    return startScanPipelineServer(context.supabase, data.scanId);
  });

export const pollScanPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scanId: string; jobId?: string | null }) => {
    const { scanId } = validateScanId(input);
    const jobId = typeof input?.jobId === "string" && input.jobId.trim() ? input.jobId.trim() : null;
    return { scanId, jobId };
  })
  .handler(async ({ data, context }) => {
    const { pollScanPipelineServer } = await import("@/lib/scan-pipeline.server");
    return pollScanPipelineServer(context.supabase, data.scanId, data.jobId);
  });

/** Legacy single blocking request — kept for existing callers. */
export const processScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scanId: string }) => validateScanId(input))
  .handler(async ({ data, context }) => {
    const { runScanPipelineServer } = await import("@/lib/scan-pipeline.server");
    return runScanPipelineServer(context.supabase, data.scanId);
  });

/** Rebuilds missing PDF / annotated / CSV downloads for an existing scan. */
export const backfillScanAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scanId: string }) => validateScanId(input))
  .handler(async ({ data, context }) => {
    const { backfillScanAssetsServer } = await import("@/lib/scan-pipeline.server");
    return backfillScanAssetsServer(context.supabase, data.scanId);
  });
