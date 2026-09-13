/**
 * Landing demo session viewer (platform admin only).
 *
 * Anonymous campaign visitors scan shelves through /api/public/landing/scan,
 * which records each attempt in landing_demo_sessions and stores uploaded
 * photos privately under scan-images/landing-demo/. This server function lets
 * a platform admin list those attempts with short-lived signed image URLs.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePlatformAdminContext } from "@/lib/platform-admin.server";

export type DemoScanRow = {
  id: string;
  created_at: string;
  scan_status: string | null;
  scan_error: string | null;
  source: "uploaded" | "sample";
  sample_id: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  lead_email: string | null;
  products: number | null;
  shelf_health: number | null;
  image_url: string | null;
};

export type DemoScanListResult = {
  rows: DemoScanRow[];
  totals: { attempts: number; completed: number; uploads: number; withImage: number };
};

const SIGNED_URL_TTL = 60 * 60; // 1 hour

function numberField(record: Record<string, unknown> | null, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export const listLandingDemoScans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number } | undefined) => ({
    days: Math.min(Math.max(Number(input?.days ?? 7) || 7, 1), 180),
  }))
  .handler(async ({ data, context }): Promise<DemoScanListResult> => {
    const email = String(context.claims?.email ?? "").toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requirePlatformAdminContext(supabaseAdmin, email);

    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();
    const { data: sessions, error } = await supabaseAdmin
      .from("landing_demo_sessions")
      .select(
        "id, created_at, scan_status, scan_error, sample_id, category, image_storage_path, utm_source, utm_campaign, referrer, lead_email, scan_result",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const paths = (sessions ?? [])
      .map((row) => row.image_storage_path)
      .filter((path): path is string => Boolean(path));

    const signed = new Map<string, string>();
    if (paths.length > 0) {
      const { data: urls } = await supabaseAdmin.storage
        .from("scan-images")
        .createSignedUrls(paths, SIGNED_URL_TTL);
      for (const entry of urls ?? []) {
        if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
      }
    }

    const rows: DemoScanRow[] = (sessions ?? []).map((row) => {
      const result =
        row.scan_result && typeof row.scan_result === "object" && !Array.isArray(row.scan_result)
          ? (row.scan_result as Record<string, unknown>)
          : null;
      const summary =
        result && typeof result.summary === "object" && result.summary && !Array.isArray(result.summary)
          ? (result.summary as Record<string, unknown>)
          : null;
      return {
        id: row.id as string,
        created_at: row.created_at as string,
        scan_status: (row.scan_status as string | null) ?? null,
        scan_error: (row.scan_error as string | null) ?? null,
        source: row.sample_id ? "sample" : "uploaded",
        sample_id: (row.sample_id as string | null) ?? null,
        utm_source: (row.utm_source as string | null) ?? null,
        utm_campaign: (row.utm_campaign as string | null) ?? null,
        referrer: (row.referrer as string | null) ?? null,
        lead_email: (row.lead_email as string | null) ?? null,
        products:
          numberField(summary, ["total_products", "total_facings", "products"]) ??
          numberField(result, ["total_products", "total_facings"]),
        shelf_health:
          numberField(summary, ["shelf_health", "shelf_health_score"]) ??
          numberField(result, ["shelf_health", "shelf_health_score"]),
        image_url: row.image_storage_path ? signed.get(row.image_storage_path) ?? null : null,
      };
    });

    return {
      rows,
      totals: {
        attempts: rows.length,
        completed: rows.filter((row) => row.scan_status === "completed").length,
        uploads: rows.filter((row) => row.source === "uploaded").length,
        withImage: rows.filter((row) => Boolean(row.image_url)).length,
      },
    };
  });
