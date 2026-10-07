/**
 * Finishes AI scans whose processing page was closed before analysis ended
 * (app closed, phone locked, user navigated away). Runs wherever the signed-in
 * user has the app open, for that user's own scans only.
 */

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Only scans uploaded at least this long ago — fresh ones still have their page. */
const MIN_AGE_MS = 90_000;
const MAX_AGE_MS = 24 * 60 * 60_000;
const CHECK_EVERY_MS = 2 * 60_000;
const MAX_PER_PASS = 3;

let passRunning = false;

export async function resumeStrandedScans(): Promise<number> {
  if (passRunning) return 0;
  passRunning = true;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return 0;

    const now = Date.now();
    const { data: scans } = await supabase
      .from("shelf_scans")
      .select("id")
      .eq("created_by", userId)
      .eq("status", "processing")
      .eq("audit_mode", "ai")
      .gte("created_at", new Date(now - MAX_AGE_MS).toISOString())
      .lte("created_at", new Date(now - MIN_AGE_MS).toISOString())
      .order("created_at", { ascending: true })
      .limit(MAX_PER_PASS);
    const ids = (scans ?? []).map((row) => row.id as string);
    if (!ids.length) return 0;

    // A scan with no stored photo is still uploading (or was abandoned mid-upload).
    const { data: images } = await supabase
      .from("scan_images")
      .select("scan_id")
      .in("scan_id", ids)
      .eq("kind", "original");
    const uploaded = new Set((images ?? []).map((row) => row.scan_id as string));

    const { resumeScanAnalysis } = await import("@/lib/scan-api");
    let resumed = 0;
    for (const id of ids) {
      if (!uploaded.has(id)) continue;
      try {
        const result = await resumeScanAnalysis(id);
        if (result) resumed++;
      } catch {
        // The pipeline records the failure on the scan; the user sees it in their audits.
      }
    }
    return resumed;
  } finally {
    passRunning = false;
  }
}

export function useResumeStrandedScans(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const run = () => {
      if (document.visibilityState === "visible") void resumeStrandedScans();
    };
    const first = window.setTimeout(run, 5_000);
    const timer = window.setInterval(run, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", run);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
    };
  }, [enabled]);
}
