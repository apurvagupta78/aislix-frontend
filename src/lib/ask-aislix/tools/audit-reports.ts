import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/** Report artifact kinds stored in scan_images (see scan-pipeline.server.ts + scan-results.ts). */
export const SCAN_REPORT_KINDS = ["pdf", "report", "csv", "annotated"] as const;

export type AuditReportArtifact = {
  source: "scan_images" | "scan_results" | "shelf_scans";
  scan_id: string;
  kind: string;
  label: string;
  storage_bucket?: string;
  storage_path?: string;
  mime_type?: string | null;
  created_at?: string;
  /** Text summary when no file exists. */
  summary_text?: string;
  /** Small CSV excerpt for model context. */
  text_excerpt?: string;
};

export async function fetchAuditReportsForScans(
  supabase: SupabaseClient<Database>,
  scanIds: string[],
  options: { includeSummaries?: boolean; csvExcerptMaxChars?: number } = {},
): Promise<AuditReportArtifact[]> {
  if (!scanIds.length) return [];

  const includeSummaries = options.includeSummaries ?? true;
  const csvMax = options.csvExcerptMaxChars ?? 4000;
  const artifacts: AuditReportArtifact[] = [];

  const [{ data: images }, { data: results }, { data: scans }] = await Promise.all([
    supabase
      .from("scan_images")
      .select("scan_id, kind, storage_bucket, storage_path, mime_type, created_at")
      .in("scan_id", scanIds)
      .in("kind", [...SCAN_REPORT_KINDS]),
    includeSummaries
      ? supabase
          .from("scan_results")
          .select("scan_id, executive_summary, created_at")
          .in("scan_id", scanIds)
      : Promise.resolve({ data: [] as { scan_id: string; executive_summary: string | null; created_at: string }[] }),
    includeSummaries
      ? supabase
          .from("shelf_scans")
          .select(
            "id, created_at, osa_percent, planogram_compliance_percent, shelf_health_score, share_of_shelf_percent, total_products, status",
          )
          .in("id", scanIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            created_at: string;
            osa_percent: number | null;
            planogram_compliance_percent: number | null;
            shelf_health_score: number | null;
            share_of_shelf_percent: number | null;
            total_products: number;
            status: string;
          }[],
        }),
  ]);

  for (const row of images ?? []) {
    artifacts.push({
      source: "scan_images",
      scan_id: row.scan_id as string,
      kind: row.kind as string,
      label: reportLabel(row.kind as string),
      storage_bucket: row.storage_bucket as string,
      storage_path: row.storage_path as string,
      mime_type: row.mime_type as string | null,
      created_at: row.created_at as string,
    });
  }

  for (const row of results ?? []) {
    if (!row.executive_summary) continue;
    artifacts.push({
      source: "scan_results",
      scan_id: row.scan_id as string,
      kind: "executive_summary",
      label: "Executive summary",
      summary_text: String(row.executive_summary).slice(0, 6000),
      created_at: row.created_at as string,
    });
  }

  for (const row of scans ?? []) {
    artifacts.push({
      source: "shelf_scans",
      scan_id: row.id as string,
      kind: "scan_summary",
      label: "Scan KPI summary",
      summary_text: [
        `Status: ${row.status}`,
        row.osa_percent != null ? `OSA: ${row.osa_percent}%` : null,
        row.planogram_compliance_percent != null
          ? `Planogram compliance: ${row.planogram_compliance_percent}%`
          : null,
        row.shelf_health_score != null ? `Shelf health: ${row.shelf_health_score}` : null,
        row.share_of_shelf_percent != null ? `Share of shelf: ${row.share_of_shelf_percent}%` : null,
        `Total products: ${row.total_products}`,
      ]
        .filter(Boolean)
        .join(" · "),
      created_at: row.created_at as string,
    });
  }

  const csvImages = (images ?? []).filter((img) => img.kind === "csv").slice(0, 3);
  for (const csv of csvImages) {
    try {
      const { data: blob } = await supabase.storage
        .from((csv.storage_bucket as string) || "scan-images")
        .download(csv.storage_path as string);
      if (!blob) continue;
      const text = await blob.text();
      const artifact = artifacts.find(
        (a) => a.scan_id === csv.scan_id && a.kind === "csv" && a.source === "scan_images",
      );
      if (artifact) artifact.text_excerpt = text.slice(0, csvMax);
    } catch {
      // skip unreadable csv
    }
  }

  return artifacts.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
}

function reportLabel(kind: string): string {
  switch (kind) {
    case "pdf":
    case "report":
      return "PDF report";
    case "csv":
      return "CSV report";
    case "annotated":
      return "Annotated shelf report";
    default:
      return kind;
  }
}
