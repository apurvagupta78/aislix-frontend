/**
 * Server function entrypoints for the AI scan pipeline.
 *
 * Thin wrappers only — all runtime logic lives in `scan-pipeline.server.ts`,
 * which is imported inside the handler so nothing server-only reaches the
 * client bundle.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const processScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scanId: string }) => {
    const scanId = typeof input?.scanId === "string" ? input.scanId.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(scanId)) throw new Error("A valid scan id is required.");
    return { scanId };
  })
  .handler(async ({ data, context }) => {
    const { runScanPipelineServer } = await import("@/lib/scan-pipeline.server");
    return runScanPipelineServer(context.supabase, data.scanId);
  });
