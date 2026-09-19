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
import type { ScanResult } from "@/lib/scan-results";

type Props = {
  data: ScanResult;
  ctx: AiAuditDisplayContext;
  imageUrl?: string | null;
};

function productLabel(row: AstraShelfProduct) {
  return `${row.brand} · ${row.product_name}${row.variant ? ` · ${row.variant}` : ""}`;
}

export function AiAuditShelfOnlyView({ data, ctx, imageUrl }: Props) {
  if (ctx.analysis.mode !== "shelf_only") return null;
  const analysis = ctx.analysis;
  const s = analysis.summary;

  const summaryTiles = [
    { label: "Products", value: String(s.products_identified), tone: "active" as const },
    { label: "Brands", value: String(s.brands_identified), tone: "healthy" as const },
    { label: "Variants", value: String(s.variants_identified), tone: "neutral" as const },
    { label: "Facings", value: String(s.visible_facings), tone: "active" as const },
    { label: "Units", value: String(s.visible_units), tone: "healthy" as const },
    { label: "Prices read", value: String(s.prices_read), tone: "neutral" as const },
    { label: "Promotions", value: String(s.promotions_identified), tone: "attention" as const },
    { label: "Shelf issues", value: String(s.shelf_issues_identified), tone: "attention" as const },
  ];

  const brandDonut = statusDonutSlices(
    Object.fromEntries(analysis.brand_analysis.map((b) => [b.brand, b.facings])),
  );
  const categoryDonut = statusDonutSlices(
    Object.fromEntries(analysis.category_analysis.map((c) => [c.category, c.facings])),
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
    { key: "cat", header: "Category", cell: (r: AstraShelfProduct) => (
      <div>{r.category || "—"}<br />{statusBadge(r.category_status)}</div>
    )},
    { key: "sub", header: "Subcategory", cell: (r: AstraShelfProduct) => (
      <div>{r.subcategory || "—"}<br />{statusBadge(r.subcategory_status)}</div>
    )},
    { key: "facings", header: "Facings", cell: (r: AstraShelfProduct) => r.actual_facings },
    { key: "units", header: "Visible units", cell: (r: AstraShelfProduct) => r.actual_visible_units },
    { key: "conf", header: "Confidence", cell: (r: AstraShelfProduct) => confCell(r.confidence) },
    { key: "ev", header: "Evidence", cell: (r: AstraShelfProduct) => (
      <span className="text-muted-foreground">{r.evidence_note || "—"}</span>
    )},
  ];

  return (
    <div className="space-y-4">
      <AiResultsHero
        scanId={data.scan_id}
        modeLabel="Shelf intelligence (image-only)"
        operatingModel={ctx.extras.operating_model_label ?? ctx.extras.operating_model}
        timestamp={data.created_at}
      />
      <AiExecutiveSummary text={data.executive_summary} />
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

      <AiAuditCard title="Summary KPIs" description="All shelf-only summary metrics">
        <MpTileGrid tiles={summaryTiles} />
      </AiAuditCard>

      {analysis.focus_brand_analysis ? (
        <AiAuditCard title="Focus brand analysis" description="Primary brand performance on this fixture">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <AiMetricStat label="Brand" value={analysis.focus_brand_analysis.brand} />
            <AiMetricStat label="Facings" value={analysis.focus_brand_analysis.facings} />
            <AiMetricStat label="Visible units" value={analysis.focus_brand_analysis.visible_units} />
            <AiMetricStat label="Facing share" value={pctCell(analysis.focus_brand_analysis.share_of_facings_percent)} />
            <AiMetricStat label="Unit share" value={pctCell(analysis.focus_brand_analysis.share_of_visible_units_percent)} />
          </div>
          <div className="mt-3">{statusBadge(analysis.focus_brand_analysis.status)}</div>
        </AiAuditCard>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {brandDonut.length ? (
          <AiAuditCard title="Brand share (facings)" description="From brand_analysis">
            <MpDonut slices={brandDonut} total={s.visible_facings} totalLabel="Facings" />
          </AiAuditCard>
        ) : null}
        {categoryDonut.length ? (
          <AiAuditCard title="Category share (facings)" description="From category_analysis">
            <MpDonut slices={categoryDonut} total={s.visible_facings} totalLabel="Facings" />
          </AiAuditCard>
        ) : null}
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
        <AiAuditCard title="Brand analysis table" description="All brand_analysis fields">
          <AiAuditMetricTable
            rows={analysis.brand_analysis}
            rowKey={(r) => r.brand}
            columns={[
              { key: "b", header: "Brand", cell: (r: AstraShelfBrandAnalysis) => r.brand },
              { key: "f", header: "Facings", cell: (r) => r.facings },
              { key: "u", header: "Units", cell: (r) => r.visible_units },
              { key: "fs", header: "Facing share %", cell: (r) => pctCell(r.share_of_facings_percent) },
              { key: "us", header: "Unit share %", cell: (r) => pctCell(r.share_of_visible_units_percent) },
              { key: "rf", header: "Rank facings", cell: (r) => r.rank_by_facings },
              { key: "ru", header: "Rank units", cell: (r) => r.rank_by_visible_units },
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

      <AiAuditCard title="Detected products" description="Every product field from Astra">
        <AiAuditMetricTable
          columns={productColumns}
          rows={analysis.products}
          rowKey={(r, i) => `${r.brand}-${r.variant}-${i}`}
        />
      </AiAuditCard>

      {analysis.visible_prices.length ? (
        <AiAuditCard title="Visible prices" description="All visible_prices from Astra">
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
      ) : null}

      {analysis.visible_promotions.length ? (
        <AiAuditCard title="Visible promotions" description="All visible_promotions from Astra">
          <AiAuditMetricTable
            rows={analysis.visible_promotions}
            rowKey={(r, i) => `promo-${i}`}
            columns={[
              { key: "b", header: "Brand", cell: (r: AstraVisiblePromotion) => r.brand ?? r.product_or_brand ?? "—" },
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
