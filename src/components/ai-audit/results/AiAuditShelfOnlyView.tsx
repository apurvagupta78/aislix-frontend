import { AiAstraOutputSections, AiImageQualityBanner } from "@/components/ai-audit/results/AiAstraExtrasSections";
import { statusDonutSlices } from "@/components/ai-audit/results/AiAuditCharts";
import {
  AiAuditMetricTable,
  confCell,
  pctCell,
  statusBadge,
} from "@/components/ai-audit/results/AiAuditMetricTable";
import {
  AiAuditCard,
  AiEvidencePanel,
  AiExecutiveSummary,
  AiMetricStat,
  AiResultsHero,
} from "@/components/ai-audit/results/AiAuditUi";
import { MpDonut, MpRankBars, MpTileGrid } from "@/components/control-tower/MpCharts";
import type { AiAuditDisplayContext } from "@/lib/ai-audit/astra-display";
import type {
  AstraShelfBrandAnalysis,
  AstraShelfCategoryAnalysis,
  AstraShelfProduct,
  AstraShelfIssue,
  AstraVisiblePrice,
  AstraVisiblePromotion,
} from "@/lib/ai-audit/astra-response";
import {
  metricDisplayValue,
  metricStatusLabel,
  sanitizeShelfOnlyExecutiveSummary,
} from "@/lib/ai-audit/metric-results";
import type { ScanResult } from "@/lib/scan-results";

type Props = {
  data: ScanResult;
  ctx: AiAuditDisplayContext;
  imageUrl?: string | null;
};

function productLabel(row: AstraShelfProduct) {
  return `${row.brand} · ${row.product_name}${row.variant ? ` · ${row.variant}` : ""}`;
}

function tileTone(status: string | undefined): "active" | "healthy" | "neutral" | "attention" {
  if (status === "COUNT_MISMATCH") return "attention";
  if (status === "VERIFIED" || status === "CALCULATED") return "healthy";
  if (status === "NOT_APPLICABLE" || status === "UNAVAILABLE") return "neutral";
  return "active";
}

export function AiAuditShelfOnlyView({ data, ctx, imageUrl }: Props) {
  if (ctx.analysis.mode !== "shelf_only") return null;
  const analysis = ctx.analysis;
  const s = analysis.summary;
  const calc = ctx.calculatedMetrics;
  const productsMetric = calc.products_identified;
  const brandsMetric = calc.brands_identified;
  const facingsMetric = calc.total_actual_facings;
  const unitsMetric = calc.total_actual_visible_units;

  const productsValue = metricDisplayValue(productsMetric, s.products_identified);
  const brandsValue = metricDisplayValue(brandsMetric, s.brands_identified);
  const facingsValue = metricDisplayValue(facingsMetric, s.visible_facings);
  const unitsValue = metricDisplayValue(unitsMetric, s.visible_units);
  const facingsNum = Number(facingsValue);
  const facingsTotal = Number.isFinite(facingsNum) ? facingsNum : s.visible_facings;

  const summaryTiles = [
    {
      label: "Products",
      value: productsValue,
      tone: tileTone(productsMetric?.status),
    },
    {
      label: "Brands",
      value: brandsValue,
      tone: tileTone(brandsMetric?.status),
    },
    {
      label: "Variants",
      value: String(s.variants_identified || analysis.products.filter((p) => p.variant).length),
      tone: "neutral" as const,
    },
    {
      label: "Facings",
      value: facingsValue,
      tone: tileTone(facingsMetric?.status),
    },
    {
      label: "Units",
      value: unitsValue,
      tone: tileTone(unitsMetric?.status),
    },
    {
      label: "Prices read",
      value: analysis.visible_prices.length ? String(analysis.visible_prices.length) : "N/A",
      tone: "neutral" as const,
    },
    {
      label: "Promotions",
      value: analysis.visible_promotions.length ? String(analysis.visible_promotions.length) : "N/A",
      tone: "neutral" as const,
    },
    {
      label: "Shelf issues",
      value: analysis.shelf_issues.length ? String(analysis.shelf_issues.length) : "N/A",
      tone: analysis.shelf_issues.length ? ("attention" as const) : ("neutral" as const),
    },
  ];

  const brandDonut = statusDonutSlices(
    Object.fromEntries(
      analysis.brand_analysis
        .filter((b) => b.brand && b.facings > 0)
        .map((b) => [b.brand, b.facings]),
    ),
  );
  const categoryDonut = statusDonutSlices(
    Object.fromEntries(
      analysis.category_analysis
        .filter((c) => c.category && c.facings > 0)
        .map((c) => [c.category, c.facings]),
    ),
  );

  const facingsBars = [...analysis.products]
    .sort((a, b) => b.actual_facings - a.actual_facings)
    .slice(0, 10)
    .map((row, i) => ({
      label: productLabel(row),
      value: row.actual_facings,
      color: ["#AEDEF9", "#86EFAC", "#FCD34D", "#FCA5A5", "#C4B5FD"][i % 5],
    }));

  const unitsBars = [...analysis.products]
    .sort((a, b) => b.actual_visible_units - a.actual_visible_units)
    .slice(0, 10)
    .map((row, i) => ({
      label: productLabel(row),
      value: row.actual_visible_units,
      color: ["#CFEEFF", "#BBF7D0", "#FDE68A", "#FECACA", "#E9D5FF"][i % 5],
    }));

  const risk = ctx.executionRisk;
  const summaryText = sanitizeShelfOnlyExecutiveSummary(data.executive_summary);

  const productColumns = [
    {
      key: "product",
      header: "Product",
      cell: (r: AstraShelfProduct) => (
        <div>
          <p className="font-medium">{productLabel(r)}</p>
          <p className="text-muted-foreground">{r.shelf_position || "—"}</p>
        </div>
      ),
    },
    { key: "brand", header: "Brand", cell: (r: AstraShelfProduct) => statusBadge(r.brand_status) },
    { key: "product_st", header: "Product", cell: (r: AstraShelfProduct) => statusBadge(r.product_status) },
    { key: "variant", header: "Variant", cell: (r: AstraShelfProduct) => statusBadge(r.variant_status) },
    {
      key: "cat",
      header: "Category",
      cell: (r: AstraShelfProduct) => (
        <div>
          {r.category || "—"}
          <br />
          {statusBadge(r.category_status)}
        </div>
      ),
    },
    {
      key: "sub",
      header: "Subcategory",
      cell: (r: AstraShelfProduct) => (
        <div>
          {r.subcategory || "—"}
          <br />
          {statusBadge(r.subcategory_status)}
        </div>
      ),
    },
    { key: "facings", header: "Facings", cell: (r: AstraShelfProduct) => r.actual_facings },
    { key: "units", header: "Visible units", cell: (r: AstraShelfProduct) => r.actual_visible_units },
    { key: "conf", header: "Confidence", cell: (r: AstraShelfProduct) => confCell(r.confidence) },
    {
      key: "ev",
      header: "Evidence",
      cell: (r: AstraShelfProduct) => (
        <span className="text-muted-foreground">{r.evidence_note || "—"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AiResultsHero
        scanId={data.scan_id}
        modeLabel="Shelf intelligence (image-only)"
        operatingModel={ctx.extras.operating_model_label ?? ctx.extras.operating_model}
        timestamp={data.created_at}
      />
      <AiExecutiveSummary text={summaryText} />
      <AiImageQualityBanner extras={ctx.extras} />

      <AiAuditCard title="Location & shelf structure" description="Context from Astra shelf analysis">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AiMetricStat label="Location" value={analysis.location || ctx.extras.location || "—"} />
          <AiMetricStat label="Location status" value={analysis.location_status || "—"} />
          <AiMetricStat
            label="Shelf levels"
            value={analysis.shelf_structure?.visible_shelf_levels ?? "—"}
          />
          <AiMetricStat
            label="Image quality"
            value={analysis.image_quality?.status ?? ctx.extras.image_quality?.status ?? "—"}
          />
        </div>
        {analysis.shelf_structure?.notes ? (
          <p className="mt-3 text-sm text-muted-foreground">{analysis.shelf_structure.notes}</p>
        ) : null}
      </AiAuditCard>

      <AiAuditCard
        title="Summary KPIs"
        description="Aislix calculated metrics (MetricResults) — planogram compliance is N/A for shelf-only"
      >
        <MpTileGrid tiles={summaryTiles} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AiMetricStat
            label="Products identified"
            value={productsValue}
            status={metricStatusLabel(productsMetric?.status)}
          />
          <AiMetricStat
            label="Brands identified"
            value={brandsValue}
            status={metricStatusLabel(brandsMetric?.status)}
          />
          <AiMetricStat
            label="Total facings"
            value={facingsValue}
            status={metricStatusLabel(facingsMetric?.status)}
            sub={facingsMetric?.source ? `Source: ${facingsMetric.source}` : undefined}
          />
          <AiMetricStat
            label="Visible units"
            value={unitsValue}
            status={metricStatusLabel(unitsMetric?.status)}
            sub={unitsMetric?.source ? `Source: ${unitsMetric.source}` : undefined}
          />
          <AiMetricStat label="Planogram compliance" value="N/A" status="Not applicable" sub="Shelf-only audit" />
          <AiMetricStat label="Facing compliance" value="N/A" status="Not applicable" sub="No expected facings" />
        </div>
      </AiAuditCard>

      {risk ? (
        <AiAuditCard title="Execution risk" description="Rule-based severity from Aislix calc">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AiMetricStat label="Severity" value={risk.severity || "NONE"} />
            <AiMetricStat label="Rules triggered" value={risk.rules_triggered.length} />
            <AiMetricStat label="Reasons" value={risk.reasons.length || "—"} />
          </div>
          {risk.rules_triggered.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {risk.rules_triggered.slice(0, 5).map((rule, i) => (
                <li key={i}>{String(rule.description ?? rule.rule_id ?? "Rule triggered")}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No execution-risk rules triggered.</p>
          )}
        </AiAuditCard>
      ) : null}

      {analysis.focus_brand_analysis ? (
        <AiAuditCard title="Focus brand analysis" description="Primary brand performance on this fixture">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <AiMetricStat label="Brand" value={analysis.focus_brand_analysis.brand} />
            <AiMetricStat label="Facings" value={analysis.focus_brand_analysis.facings} />
            <AiMetricStat label="Visible units" value={analysis.focus_brand_analysis.visible_units} />
            <AiMetricStat
              label="Facing share"
              value={pctCell(analysis.focus_brand_analysis.share_of_facings_percent)}
            />
            <AiMetricStat
              label="Unit share"
              value={pctCell(analysis.focus_brand_analysis.share_of_visible_units_percent)}
            />
          </div>
          <div className="mt-3">{statusBadge(analysis.focus_brand_analysis.status)}</div>
        </AiAuditCard>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {brandDonut.length ? (
          <AiAuditCard title="Brand share (facings)" description="From Aislix brand_analysis">
            <MpDonut slices={brandDonut} total={facingsTotal || brandDonut.reduce((a, s) => a + s.value, 0)} totalLabel="Facings" />
          </AiAuditCard>
        ) : null}
        {categoryDonut.length ? (
          <AiAuditCard title="Category share (facings)" description="From category_analysis when available">
            <MpDonut slices={categoryDonut} total={facingsTotal || categoryDonut.reduce((a, s) => a + s.value, 0)} totalLabel="Facings" />
          </AiAuditCard>
        ) : (
          <AiAuditCard title="Category share (facings)" description="Trusted category mapping">
            <p className="text-sm text-muted-foreground">
              Not available — category share requires trusted category mapping (not LLM-only labels).
            </p>
          </AiAuditCard>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {facingsBars.length ? (
          <AiAuditCard title="Top products by facings" description="Ranked bar chart">
            <MpRankBars data={facingsBars} unit=" facings" />
          </AiAuditCard>
        ) : null}
        {unitsBars.length ? (
          <AiAuditCard title="Top products by visible units" description="Ranked bar chart">
            <MpRankBars data={unitsBars} unit=" units" />
          </AiAuditCard>
        ) : null}
      </div>

      {analysis.brand_analysis.length ? (
        <AiAuditCard title="Brand analysis table" description="Aislix calculated brand shares">
          <AiAuditMetricTable
            rows={analysis.brand_analysis}
            rowKey={(r) => r.brand}
            columns={[
              { key: "b", header: "Brand", cell: (r: AstraShelfBrandAnalysis) => r.brand },
              { key: "f", header: "Facings", cell: (r) => r.facings },
              { key: "u", header: "Units", cell: (r) => r.visible_units || "—" },
              { key: "fs", header: "Facing share %", cell: (r) => pctCell(r.share_of_facings_percent) },
              { key: "us", header: "Unit share %", cell: (r) => pctCell(r.share_of_visible_units_percent) },
              { key: "rf", header: "Rank facings", cell: (r) => r.rank_by_facings || "—" },
              { key: "ru", header: "Rank units", cell: (r) => r.rank_by_visible_units || "—" },
              { key: "c", header: "Confidence", cell: (r) => confCell(r.confidence) },
            ]}
          />
        </AiAuditCard>
      ) : null}

      {analysis.category_analysis.length ? (
        <AiAuditCard title="Category analysis table" description="All category_analysis fields">
          <AiAuditMetricTable
            rows={analysis.category_analysis}
            rowKey={(r) => r.category}
            columns={[
              { key: "c", header: "Category", cell: (r: AstraShelfCategoryAnalysis) => r.category },
              { key: "f", header: "Facings", cell: (r) => r.facings },
              { key: "u", header: "Units", cell: (r) => r.visible_units },
              { key: "fs", header: "Facing share %", cell: (r) => pctCell(r.share_of_facings_percent) },
              { key: "us", header: "Unit share %", cell: (r) => pctCell(r.share_of_visible_units_percent) },
              { key: "conf", header: "Confidence", cell: (r) => confCell(r.confidence) },
            ]}
          />
        </AiAuditCard>
      ) : null}

      <AiAuditCard title="Detected products" description="Every product field from Astra CV">
        <AiAuditMetricTable
          columns={productColumns}
          rows={analysis.products}
          rowKey={(r, i) => `${r.brand}-${r.variant}-${i}`}
        />
      </AiAuditCard>

      {analysis.visible_prices.length ? (
        <AiAuditCard title="Visible prices" description="All visible_prices from secondary vision">
          <AiAuditMetricTable
            rows={analysis.visible_prices}
            rowKey={(r, i) => `price-${i}`}
            columns={[
              { key: "p", header: "Product", cell: (r: AstraVisiblePrice) => r.product_name ?? "—" },
              { key: "b", header: "Brand", cell: (r) => r.brand ?? "—" },
              { key: "pr", header: "Price", cell: (r) => r.price ?? "—" },
              { key: "t", header: "Type", cell: (r) => r.price_type ?? "—" },
              { key: "c", header: "Confidence", cell: (r) => confCell(r.confidence) },
            ]}
          />
        </AiAuditCard>
      ) : (
        <AiAuditCard title="Visible prices" description="Secondary vision (Luna)">
          <p className="text-sm text-muted-foreground">
            Not assessed — price reading requires Luna secondary vision (not enabled for this scan).
          </p>
        </AiAuditCard>
      )}

      {analysis.visible_promotions.length ? (
        <AiAuditCard title="Visible promotions" description="All visible_promotions from Astra">
          <AiAuditMetricTable
            rows={analysis.visible_promotions}
            rowKey={(r, i) => `promo-${i}`}
            columns={[
              {
                key: "b",
                header: "Brand",
                cell: (r: AstraVisiblePromotion) => r.brand ?? r.product_or_brand ?? "—",
              },
              { key: "p", header: "Product", cell: (r) => r.product_name ?? "—" },
              { key: "t", header: "Text", cell: (r) => r.promotion_text ?? "—" },
              { key: "ty", header: "Type", cell: (r) => r.promotion_type ?? "—" },
              { key: "c", header: "Confidence", cell: (r) => confCell(r.confidence) },
            ]}
          />
        </AiAuditCard>
      ) : null}

      {analysis.shelf_issues.length ? (
        <AiAuditCard title="Shelf issues" description="All shelf_issues from Astra">
          <AiAuditMetricTable
            rows={analysis.shelf_issues}
            rowKey={(r, i) => `issue-${i}`}
            columns={[
              { key: "t", header: "Type", cell: (r: AstraShelfIssue) => r.issue_type ?? "—" },
              { key: "d", header: "Description", cell: (r) => r.description ?? "—" },
              { key: "pos", header: "Position", cell: (r) => r.shelf_position ?? "—" },
              { key: "sev", header: "Severity", cell: (r) => statusBadge(r.severity) },
              { key: "c", header: "Confidence", cell: (r) => confCell(r.confidence) },
            ]}
          />
        </AiAuditCard>
      ) : null}

      <AiEvidencePanel imageUrl={imageUrl} />
      <AiAstraOutputSections result={data} extras={ctx.extras} />
    </div>
  );
}
