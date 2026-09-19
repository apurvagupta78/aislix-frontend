import { AstraComparisonResults } from "@/components/ai-audit/AstraComparisonResults";
import { AiAstraOutputSections } from "@/components/ai-audit/results/AiAstraExtrasSections";
import {
  AiAuditCard,
  AiEvidencePanel,
  AiExecutiveSummary,
  AiMetricStat,
  AiResultsHero,
} from "@/components/ai-audit/results/AiAuditUi";
import { PlanogramSideBySidePanel } from "@/components/scan-results/PlanogramSideBySidePanel";
import { MpRankBars, MpRadialGauge, MpTileGrid } from "@/components/control-tower/MpCharts";
import type { AiAuditDisplayContext } from "@/lib/ai-audit/astra-display";
import { planogramComparisonFromResult } from "@/lib/planogram-display";
import type { ScanResult } from "@/lib/scan-results";

type Props = {
  data: ScanResult;
  ctx: AiAuditDisplayContext;
  imageUrl?: string | null;
};

export function AiAuditPlanogramView({ data, ctx, imageUrl }: Props) {
  const analysis = ctx.analysis;
  const hasAstraPlanogram = analysis.mode === "planogram";
  const s = hasAstraPlanogram ? analysis.summary : {};
  const compliance =
    (hasAstraPlanogram ? s.overall_compliance_percent : null) ??
    ctx.matchRatePercent ??
    data.planogram?.percent ??
    data.summary?.shelf_compliance ??
    data.summary?.facing_compliance_percent ??
    0;

  const funnelTiles = hasAstraPlanogram
    ? [
        { label: "Matched", value: String(s.matched_rows ?? 0), tone: "healthy" as const },
        { label: "Not found", value: String(s.not_found_rows ?? 0), tone: "attention" as const },
        {
          label: "Non-compliant",
          value: String(s.non_compliant_rows ?? 0),
          tone: "attention" as const,
        },
        {
          label: "Unverifiable",
          value: String(s.not_verifiable_rows ?? 0),
          tone: "neutral" as const,
        },
      ]
    : [
        {
          label: "Compliance",
          value: `${Math.round(Number(compliance) || 0)}%`,
          tone: "healthy" as const,
        },
        {
          label: "Products",
          value: String(data.summary?.total_products ?? data.inventory?.length ?? 0),
          tone: "active" as const,
        },
        {
          label: "Facings",
          value: String(data.summary?.total_facings ?? 0),
          tone: "neutral" as const,
        },
      ];

  const varianceRows =
    hasAstraPlanogram && analysis.mode === "planogram"
      ? [...analysis.rows]
          .sort((a, b) => Math.abs(b.facing_variance) - Math.abs(a.facing_variance))
          .slice(0, 5)
          .map((row) => ({
            label: `${row.brand} · ${row.product_name}`,
            value: Math.abs(row.facing_variance),
            color: row.facing_variance === 0 ? "#86EFAC" : "#FCA5A5",
          }))
      : [];

  const comparison = planogramComparisonFromResult(data, null);

  return (
    <div className="space-y-4">
      <AiResultsHero
        scanId={data.scan_id}
        modeLabel="Planogram comparison"
        operatingModel={ctx.extras.operating_model_label ?? ctx.extras.operating_model}
        timestamp={data.created_at}
      />

      <AiExecutiveSummary text={data.executive_summary} />

      <div className="grid gap-4 lg:grid-cols-[auto,1fr]">
        <AiAuditCard title="Planogram compliance" description="Rows passing all layout checks">
          <MpRadialGauge
            value={Math.round(Number(compliance) || 0)}
            label="Compliant"
            sublabel={
              hasAstraPlanogram && analysis.mode === "planogram"
                ? `${s.total_planogram_rows ?? analysis.rows.length} rows`
                : "Planogram audit"
            }
            color="#86EFAC"
          />
        </AiAuditCard>
        <AiAuditCard title="Row outcomes" description="Astra planogram analysis summary">
          <MpTileGrid tiles={funnelTiles} />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <AiMetricStat
              label="Total rows"
              value={
                hasAstraPlanogram && analysis.mode === "planogram"
                  ? (s.total_planogram_rows ?? analysis.rows.length)
                  : (data.planogram?.summary?.configured_rows as unknown[] | undefined)?.length ?? "—"
              }
            />
            <AiMetricStat
              label="Avg confidence"
              value={
                data.summary?.average_confidence
                  ? `${Math.round(data.summary.average_confidence <= 1 ? data.summary.average_confidence * 100 : data.summary.average_confidence)}%`
                  : "—"
              }
            />
            <AiMetricStat
              label="Processing"
              value={
                data.summary?.processing_time_ms
                  ? `${(data.summary.processing_time_ms / 1000).toFixed(1)}s`
                  : "—"
              }
            />
          </div>
        </AiAuditCard>
      </div>

      {hasAstraPlanogram ? <AstraComparisonResults result={data} /> : null}

      {varianceRows.length ? (
        <AiAuditCard title="Largest facing variance" description="Top planogram rows by absolute variance">
          <MpRankBars data={varianceRows} unit=" facings" />
        </AiAuditCard>
      ) : null}

      {comparison || data.planogram?.requested ? (
        <PlanogramSideBySidePanel data={data} comparison={comparison} imageUrl={imageUrl} />
      ) : (
        <AiEvidencePanel imageUrl={imageUrl} />
      )}

      <AiAstraOutputSections result={data} extras={ctx.extras} />
    </div>
  );
}
