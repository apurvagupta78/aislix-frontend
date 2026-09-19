import { AstraComparisonResults } from "@/components/ai-audit/AstraComparisonResults";
import {
  AiAstraOutputSections,
} from "@/components/ai-audit/results/AiAstraExtrasSections";
import {
  AiAuditCard,
  AiEvidencePanel,
  AiExecutiveSummary,
  AiMetricStat,
  AiResultsHero,
} from "@/components/ai-audit/results/AiAuditUi";
import { MpDonut, MpRadialGauge, MpRankBars } from "@/components/control-tower/MpCharts";
import type { AiAuditDisplayContext } from "@/lib/ai-audit/astra-display";
import { findExtraDetections } from "@/lib/ai-audit/astra-expected-synthesis";
import type { ScanResult } from "@/lib/scan-results";

type Props = {
  data: ScanResult;
  ctx: AiAuditDisplayContext;
  imageUrl?: string | null;
};

function statusDonut(analysis: Extract<AiAuditDisplayContext["analysis"], { mode: "expected_products" }>) {
  let compliant = 0;
  let partial = 0;
  let notFound = 0;
  let above = 0;
  for (const row of analysis.products) {
    const s = row.overall_status.toUpperCase();
    if (s.includes("NOT_FOUND")) notFound++;
    else if (s.includes("COMPLIANT") && !s.includes("NON") && !s.includes("PARTIAL")) compliant++;
    else if (s.includes("ABOVE") || row.facing_status.includes("ABOVE")) above++;
    else partial++;
  }
  return [
    { label: "Compliant", value: compliant, color: "#86EFAC" },
    { label: "Partial", value: partial, color: "#FCD34D" },
    { label: "Above expected", value: above, color: "#AEDEF9" },
    { label: "Not found", value: notFound, color: "#FCA5A5" },
  ].filter((s) => s.value > 0);
}

export function AiAuditExpectedProductsView({ data, ctx, imageUrl }: Props) {
  const analysis = ctx.analysis;
  if (analysis.mode !== "expected_products") return null;

  const extras = ctx.extras;
  const extra = findExtraDetections(data.expected_products ?? [], data.inventory ?? []);
  const matchRate =
    ctx.matchRatePercent ??
    (analysis.summary.total_products
      ? Math.round(
          ((analysis.summary.matched_products ?? 0) / (analysis.summary.total_products ?? 1)) *
            100,
        )
      : 0);

  const avgConf = data.summary?.average_confidence;
  const confLabel = avgConf
    ? `${Math.round(avgConf <= 1 ? avgConf * 100 : avgConf)}%`
    : "—";

  const donutSlices = statusDonut(analysis);

  return (
    <div className="space-y-4">
      <AiResultsHero
        scanId={data.scan_id}
        modeLabel="Expected products comparison"
        operatingModel={extras.operating_model_label ?? extras.operating_model}
        timestamp={data.created_at}
        comparisonSynthesized={ctx.comparisonSynthesized}
      />

      <AiExecutiveSummary text={data.executive_summary} />

      <div className="grid gap-4 lg:grid-cols-[auto,1fr]">
        <AiAuditCard
          title="Match rate"
          description="Expected products meeting facing + unit targets"
          className="lg:max-w-xs"
        >
          <MpRadialGauge value={matchRate} label="Matched" sublabel={`${analysis.products.length} expected`} />
        </AiAuditCard>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AiMetricStat label="Total facings" value={data.summary?.total_facings ?? "—"} />
          <AiMetricStat label="Products expected" value={analysis.products.length} />
          <AiMetricStat label="Avg confidence" value={confLabel} />
          <AiMetricStat
            label="Processing"
            value={
              data.summary?.processing_time_ms
                ? `${(data.summary.processing_time_ms / 1000).toFixed(1)}s`
                : "—"
            }
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr,1fr]">
        <AstraComparisonResults result={data} />
        {donutSlices.length ? (
          <AiAuditCard title="Status mix" description="Overall compliance by expected SKU">
            <MpDonut
              slices={donutSlices}
              total={analysis.products.length}
              totalLabel="Expected"
            />
          </AiAuditCard>
        ) : null}
      </div>

      {extra.length ? (
        <AiAuditCard
          title="Extra detections on shelf"
          description="Variants visible but not in the expected products list"
        >
          <MpRankBars
            data={extra.map((row) => ({
              label: `${row.brand} · ${row.variant || row.product_name}`,
              value: row.facings,
              color: "#CFEEFF",
            }))}
            unit=" facings"
          />
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-3">Brand</th>
                  <th className="pb-2 pr-3">Product</th>
                  <th className="pb-2 pr-3">Variant</th>
                  <th className="pb-2 pr-3">Facings</th>
                  <th className="pb-2">Location</th>
                </tr>
              </thead>
              <tbody>
                {extra.map((row, i) => (
                  <tr key={`extra-${i}`} className="border-t border-border/60">
                    <td className="py-2 pr-3">{row.brand}</td>
                    <td className="py-2 pr-3">{row.product_name}</td>
                    <td className="py-2 pr-3">{row.variant || "—"}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.facings}</td>
                    <td className="py-2">{row.shelf_position ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AiAuditCard>
      ) : null}

      <AiEvidencePanel imageUrl={imageUrl} />
      <AiAstraOutputSections result={data} extras={extras} />
    </div>
  );
}
