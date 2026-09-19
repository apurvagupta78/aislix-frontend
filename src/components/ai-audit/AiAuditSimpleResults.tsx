import { Link } from "@tanstack/react-router";
import { AstraComparisonResults } from "@/components/ai-audit/AstraComparisonResults";
import { InventoryTable } from "@/components/scan-results/ResultParts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { astraAnalysisFromScanResult } from "@/lib/ai-audit/astra-response";
import type { ScanResult } from "@/lib/scan-results";

type Props = {
  data: ScanResult;
  imageUrl?: string;
};

/** Minimal AI audit results — Astra output + inventory until /results is rebuilt. */
export function AiAuditSimpleResults({ data, imageUrl }: Props) {
  const astra = astraAnalysisFromScanResult(data);
  const modeLabel =
    data.analysis_mode === "planogram_comparison" || astra.mode === "planogram"
      ? "Planogram comparison"
      : "Shelf intelligence (image-only)";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand/20 bg-brand-soft/20 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-full bg-status-ai-soft text-status-ai-strong">AI Audit</Badge>
          <Badge variant="outline">{modeLabel}</Badge>
          {data.analysis_mode ? (
            <Badge variant="secondary">analysis_mode: {data.analysis_mode}</Badge>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          This is the simplified AI results view — Astra comparison and detected products only. KPI
          charts and competitor panels are temporarily disabled while we rebuild the full results
          page.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3 rounded-xl">
          <Link to="/results/debug" search={{ scan: data.scan_id }}>
            Open full raw payload inspector
          </Link>
        </Button>
      </div>

      {data.executive_summary ? (
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Executive summary
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{data.executive_summary}</p>
        </div>
      ) : null}

      {imageUrl ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-2 text-sm font-medium">Shelf image</div>
          <img src={imageUrl} alt="Shelf audit" className="max-h-[480px] w-full object-contain bg-muted/20" />
        </div>
      ) : null}

      <AstraComparisonResults result={data} />

      {astra.mode === "shelf_only" && (data.inventory?.length ?? 0) > 0 ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold">Detected on shelf</p>
          <InventoryTable items={data.inventory ?? []} scanId={data.scan_id} />
        </div>
      ) : null}

      {data.summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Total facings", data.summary.total_facings ?? data.summary.total_products],
            ["Unique brands", data.summary.unique_brands],
            ["Avg confidence", data.summary.average_confidence
              ? `${Math.round(data.summary.average_confidence <= 1 ? data.summary.average_confidence * 100 : data.summary.average_confidence)}%`
              : "—"],
            ["Processing", data.summary.processing_time_ms
              ? `${(data.summary.processing_time_ms / 1000).toFixed(1)}s`
              : "—"],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-border bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{value ?? "—"}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
