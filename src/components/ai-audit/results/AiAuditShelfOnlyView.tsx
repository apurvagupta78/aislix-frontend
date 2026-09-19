import { AiAstraOutputSections } from "@/components/ai-audit/results/AiAstraExtrasSections";
import {
  AiAuditCard,
  AiEvidencePanel,
  AiExecutiveSummary,
  AiMetricStat,
  AiResultsHero,
} from "@/components/ai-audit/results/AiAuditUi";
import { InventoryTable } from "@/components/scan-results/ResultParts";
import { MpDonut, MpRankBars } from "@/components/control-tower/MpCharts";
import type { AiAuditDisplayContext } from "@/lib/ai-audit/astra-display";
import type { ScanResult } from "@/lib/scan-results";

type Props = {
  data: ScanResult;
  ctx: AiAuditDisplayContext;
  imageUrl?: string | null;
};

export function AiAuditShelfOnlyView({ data, ctx, imageUrl }: Props) {
  const inventory = data.inventory ?? [];
  const brandShare = data.charts?.top_brands ?? [];

  const donutSlices = brandShare.length
    ? brandShare.map((b, i) => ({
        label: b.brand,
        value: b.quantity ?? b.share ?? 0,
        color: ["#AEDEF9", "#86EFAC", "#FCD34D", "#FCA5A5", "#C4B5FD"][i % 5]!,
      }))
    : [];

  const rankBars = [...inventory]
    .sort((a, b) => (b.facings ?? b.quantity) - (a.facings ?? a.quantity))
    .slice(0, 8)
    .map((row) => ({
      label: `${row.brand} · ${row.variant || row.product}`,
      value: row.facings ?? row.quantity,
      color: "#AEDEF9",
    }));

  const execScore =
    data.summary?.shelf_execution_score ??
    data.retail_intelligence?.retail_execution_score?.overall;

  return (
    <div className="space-y-4">
      <AiResultsHero
        scanId={data.scan_id}
        modeLabel="Shelf intelligence (image-only)"
        operatingModel={ctx.extras.operating_model_label ?? ctx.extras.operating_model}
        timestamp={data.created_at}
      />

      <AiExecutiveSummary text={data.executive_summary} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AiMetricStat label="Total facings" value={data.summary?.total_facings ?? inventory.reduce((s, i) => s + (i.facings ?? i.quantity), 0)} />
        <AiMetricStat label="Unique brands" value={data.summary?.unique_brands ?? new Set(inventory.map((i) => i.brand)).size} />
        <AiMetricStat
          label="Avg confidence"
          value={
            data.summary?.average_confidence
              ? `${Math.round(data.summary.average_confidence <= 1 ? data.summary.average_confidence * 100 : data.summary.average_confidence)}%`
              : "—"
          }
        />
        <AiMetricStat
          label="Execution score"
          value={execScore != null ? `${Math.round(Number(execScore))}%` : "—"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {donutSlices.length ? (
          <AiAuditCard title="Brand share" description="Facings share on this fixture">
            <MpDonut
              slices={donutSlices}
              total={data.summary?.total_facings ?? donutSlices.reduce((s, d) => s + d.value, 0)}
              totalLabel="Facings"
            />
          </AiAuditCard>
        ) : null}
        {rankBars.length ? (
          <AiAuditCard title="Facings by variant" description="Top detected products on shelf">
            <MpRankBars data={rankBars} unit=" facings" />
          </AiAuditCard>
        ) : null}
      </div>

      {inventory.length ? (
        <AiAuditCard title="Detected on shelf" description="All products identified by Astra">
          <InventoryTable items={inventory} scanId={data.scan_id} />
        </AiAuditCard>
      ) : null}

      <AiEvidencePanel imageUrl={imageUrl} />

      <AiAstraOutputSections result={data} extras={ctx.extras} />
    </div>
  );
}
