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
import {
  AiLocationCards,
  LocationLabelCell,
  ShelfPriceCell,
} from "@/components/ai-audit/results/AiLocationSections";
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
import { CHART_ACCENT, KPI_CARD, summaryFillAt } from "@/lib/ai-audit/kpi-palette";
import {
  metricCountDisplay,
  metricDisplayValue,
  sanitizeShelfOnlyExecutiveSummary,
} from "@/lib/ai-audit/metric-results";
import { downloadKeyValueCsv, downloadSectionCsv } from "@/lib/ai-audit/section-csv";
import type { ScanResult } from "@/lib/scan-results";

type Props = {
  data: ScanResult;
  ctx: AiAuditDisplayContext;
  imageUrl?: string | null;
};

function productLabel(row: AstraShelfProduct) {
  const brand = row.brand?.trim() || "Unknown brand";
  const name = row.product_name?.trim();
  const cleanName =
    !name || /^(unverifiable|unknown|unidentified)$/i.test(name) ? "Product" : name;
  const variant = row.variant?.trim();
  const cleanVariant =
    variant && !/^(unverifiable|unknown|unidentified)$/i.test(variant)
      ? variant
      : variant
        ? "Variant not readable"
        : "";
  return cleanVariant ? `${brand} · ${cleanName} · ${cleanVariant}` : `${brand} · ${cleanName}`;
}

function tileTone(status: string | undefined): "active" | "healthy" | "neutral" | "attention" {
  if (status === "COUNT_MISMATCH") return "attention";
  if (status === "VERIFIED" || status === "CALCULATED") return "healthy";
  if (status === "NOT_APPLICABLE" || status === "UNAVAILABLE") return "neutral";
  return "active";
}

const UNREADABLE_TEXT = /^(unverifiable|unknown|unidentified|not legible|illegible|unreadable|not identifiable|n\/a|none)$/i;
const UNREADABLE_VARIANT = /not (reliably )?legible|unclear|not identifiable|unverifiable|unknown|unreadable/i;

function brandKey(brand: string | undefined) {
  return (brand ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

type BrandRow = Omit<
  AstraShelfBrandAnalysis,
  "visible_units" | "share_of_visible_units_percent" | "rank_by_visible_units"
> & {
  key: string;
  visible_units: number | null;
  share_of_visible_units_percent: number | null;
  rank_by_visible_units: number | null;
};

/**
 * Older scans persisted brand rows keyed by a lowercase canonical brand ("cocacola") with no unit
 * totals. Show the brand as read from the product rows and sum their persisted per-product units.
 */
function brandRowsWithProductUnits(
  rows: AstraShelfBrandAnalysis[],
  products: AstraShelfProduct[],
): BrandRow[] {
  const byKey = new Map<string, { display: string; units: number; facings: number; confidence: number[] }>();
  for (const p of products) {
    const key = brandKey(p.brand);
    if (!key) continue;
    const cur = byKey.get(key) ?? {
      display: UNREADABLE_TEXT.test(p.brand.trim()) ? "Brand not legible" : p.brand.trim(),
      units: 0,
      facings: 0,
      confidence: [],
    };
    cur.units += p.actual_visible_units || 0;
    cur.facings += p.actual_facings || 0;
    if (p.confidence) cur.confidence.push(p.confidence);
    byKey.set(key, cur);
  }
  if (!rows.length) return brandRowsFromProducts(byKey);
  const hasPersistedUnits = rows.some((r) => r.visible_units > 0);
  const unitTotal = [...byKey.values()].reduce((n, v) => n + v.units, 0);
  const mapped = rows.map((r) => {
    const key = brandKey(r.brand);
    const fromProducts = byKey.get(key);
    const display = UNREADABLE_TEXT.test(r.brand.trim())
      ? "Brand not legible"
      : (fromProducts?.display ?? r.brand);
    const units = hasPersistedUnits ? r.visible_units : (fromProducts?.units ?? null);
    const unitShare = hasPersistedUnits
      ? r.share_of_visible_units_percent
      : units != null && unitTotal > 0
        ? Math.round((units / unitTotal) * 1000) / 10
        : null;
    return {
      ...r,
      key: key || r.brand,
      brand: display,
      visible_units: units,
      share_of_visible_units_percent: unitShare,
      rank_by_visible_units: hasPersistedUnits ? r.rank_by_visible_units || null : null,
    };
  });
  if (!hasPersistedUnits) {
    [...mapped]
      .filter((r) => r.visible_units != null)
      .sort((a, b) => (b.visible_units ?? 0) - (a.visible_units ?? 0))
      .forEach((r, index) => {
        r.rank_by_visible_units = index + 1;
      });
  }
  return mapped;
}

/** Aislix drops brand_analysis when Astra totals disagree; rebuild it from the detected product rows. */
function brandRowsFromProducts(
  byKey: Map<string, { display: string; units: number; facings: number; confidence: number[] }>,
): BrandRow[] {
  const entries = [...byKey.entries()].filter(([, v]) => v.facings > 0);
  const facingSum = entries.reduce((n, [, v]) => n + v.facings, 0);
  const unitSum = entries.reduce((n, [, v]) => n + v.units, 0);
  const share = (part: number, whole: number) =>
    whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
  const unitRank = new Map(
    [...entries].sort((a, b) => b[1].units - a[1].units).map(([key], i) => [key, i + 1]),
  );
  return [...entries]
    .sort((a, b) => b[1].facings - a[1].facings)
    .map(([key, v], i) => ({
      key,
      brand: v.display,
      facings: v.facings,
      visible_units: v.units,
      share_of_facings_percent: share(v.facings, facingSum),
      share_of_visible_units_percent: unitSum > 0 ? share(v.units, unitSum) : null,
      rank_by_facings: i + 1,
      rank_by_visible_units: unitRank.get(key) ?? null,
      confidence: v.confidence.length
        ? v.confidence.reduce((n, c) => n + c, 0) / v.confidence.length
        : 0,
    }));
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

  const productsValue = metricCountDisplay(
    productsMetric,
    analysis.products.length,
    s.products_identified,
  );
  const brandsValue = metricCountDisplay(
    brandsMetric,
    new Set(analysis.products.map((p) => p.brand.trim().toLowerCase()).filter(Boolean)).size,
    s.brands_identified,
  );
  const facingsValue = metricDisplayValue(
    facingsMetric,
    s.visible_facings || analysis.products.reduce((n, p) => n + (p.actual_facings || 0), 0),
  );
  const unitsValue = metricDisplayValue(
    unitsMetric,
    s.visible_units || analysis.products.reduce((n, p) => n + (p.actual_visible_units || 0), 0),
  );
  const facingsNum = Number(facingsValue);
  const facingsTotal = Number.isFinite(facingsNum) ? facingsNum : s.visible_facings;
  const locationAnalysis = analysis.location_analysis;
  const locationMetrics = locationAnalysis?.metrics;
  const countOrNa = (value: number | null | undefined) => (value == null ? "N/A" : String(value));

  const summaryTiles = [
    { label: "Products", value: productsValue, tone: tileTone(productsMetric?.status), bg: KPI_CARD.detectedProducts },
    { label: "Brands", value: brandsValue, tone: tileTone(brandsMetric?.status), bg: KPI_CARD.auditPass },
    {
      label: "Variants read",
      value: String(
        analysis.products.filter(
          (p) =>
            !/^unverifiable$/i.test((p.product_status || "").trim()) &&
            !/^unverifiable$/i.test((p.variant_status || "").trim()) &&
            Boolean(p.variant?.trim()) &&
            !UNREADABLE_VARIANT.test(p.variant),
        ).length,
      ),
      tone: "neutral" as const,
      bg: KPI_CARD.auditCompletion,
    },
    { label: "Total Facings", value: facingsValue, tone: tileTone(facingsMetric?.status), bg: KPI_CARD.evidenceCoverage },
    { label: "Visible units", value: unitsValue, tone: tileTone(unitsMetric?.status), bg: KPI_CARD.inventoryValueVariance },
    {
      label: "Prices read",
      value:
        locationMetrics?.prices_read != null
          ? String(locationMetrics.prices_read)
          : analysis.visible_prices.length
            ? String(analysis.visible_prices.length)
            : "N/A",
      tone: "neutral" as const,
      bg: KPI_CARD.criticalFindings,
    },
    {
      label: "Locations read",
      value: countOrNa(locationMetrics?.location_labels_read),
      tone: "neutral" as const,
      bg: KPI_CARD.slaCompliance,
    },
    {
      label: "Empty locations",
      value: countOrNa(locationMetrics?.empty_locations),
      tone: locationMetrics?.empty_locations ? ("attention" as const) : ("neutral" as const),
      bg: KPI_CARD.criticalFindings,
    },
    {
      label: "Racks",
      value: countOrNa(locationMetrics?.racks_detected),
      tone: "neutral" as const,
      bg: KPI_CARD.auditCompletion,
    },
    {
      label: "Promotions",
      value: analysis.visible_promotions.length ? String(analysis.visible_promotions.length) : "N/A",
      tone: "neutral" as const,
      bg: KPI_CARD.overdueActions,
    },
    {
      label: "Shelf issues",
      value: analysis.shelf_issues.length ? String(analysis.shelf_issues.length) : "N/A",
      tone: analysis.shelf_issues.length ? ("attention" as const) : ("neutral" as const),
      bg: KPI_CARD.slaCompliance,
    },
  ];

  const categoryFromProducts = (() => {
    if (analysis.category_analysis.length) return analysis.category_analysis;
    const totals = new Map<string, { facings: number; units: number }>();
    for (const row of analysis.products) {
      const cat = row.category?.trim();
      if (!cat || /^(unverifiable|unknown|other)$/i.test(cat)) continue;
      const cur = totals.get(cat) ?? { facings: 0, units: 0 };
      cur.facings += row.actual_facings || 0;
      cur.units += row.actual_visible_units || 0;
      totals.set(cat, cur);
    }
    const facingSum = [...totals.values()].reduce((n, v) => n + v.facings, 0) || 1;
    const unitSum = [...totals.values()].reduce((n, v) => n + v.units, 0) || 1;
    return [...totals.entries()].map(([category, v]) => ({
      category,
      facings: v.facings,
      visible_units: v.units,
      share_of_facings_percent: Math.round((v.facings / facingSum) * 1000) / 10,
      share_of_visible_units_percent: Math.round((v.units / unitSum) * 1000) / 10,
      confidence: 0,
    }));
  })();

  const brandRows = brandRowsWithProductUnits(analysis.brand_analysis, analysis.products);

  const brandDonut = statusDonutSlices(
    Object.fromEntries(
      brandRows
        .filter((b) => b.brand && b.facings > 0)
        .map((b) => [b.brand, b.facings]),
    ),
  );
  const categoryDonut = statusDonutSlices(
    Object.fromEntries(
      categoryFromProducts
        .filter((c) => c.category && c.facings > 0)
        .map((c) => [c.category, c.facings]),
    ),
  );

  const facingsBars = [...analysis.products]
    .sort((a, b) => b.actual_facings - a.actual_facings)
    .slice(0, 10)
    .map((row) => ({
      label: productLabel(row),
      value: row.actual_facings,
      color: CHART_ACCENT.rankByFacings,
    }));

  const unitsBars = [...analysis.products]
    .sort((a, b) => b.actual_visible_units - a.actual_visible_units)
    .slice(0, 10)
    .map((row) => ({
      label: productLabel(row),
      value: row.actual_visible_units,
      color: CHART_ACCENT.rankByUnits,
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
    ...(locationAnalysis
      ? [
          {
            key: "loc",
            header: "Location",
            cell: (r: AstraShelfProduct) => (
              <LocationLabelCell label={r.location_label} status={r.location_label_status} />
            ),
          },
          { key: "rack", header: "Rack", cell: (r: AstraShelfProduct) => r.rack_marker ?? "—" },
        ]
      : []),
    { key: "facings", header: "Total Facings", cell: (r: AstraShelfProduct) => r.actual_facings },
    { key: "units", header: "Visible units", cell: (r: AstraShelfProduct) => r.actual_visible_units },
    ...(locationMetrics?.prices_read != null
      ? [
          {
            key: "price",
            header: "Shelf price",
            cell: (r: AstraShelfProduct) => <ShelfPriceCell price={r.visible_price} />,
          },
        ]
      : []),
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
        modeLabel="Shelf photo audit"
        operatingModel={ctx.extras.operating_model_label ?? ctx.extras.operating_model}
      />
      <AiExecutiveSummary text={summaryText} scanId={data.scan_id} />
      <AiImageQualityBanner extras={ctx.extras} />

      <AiAuditCard
        title="Shelf context"
        description="Where this photo was taken and how clear it is"
        csvDownload={{
          onDownload: () =>
            downloadKeyValueCsv(data.scan_id, "shelf-context", [
              { label: "Location", value: analysis.location || ctx.extras.location || "—" },
              { label: "Location status", value: analysis.location_status || "—" },
              { label: "Shelf levels", value: analysis.shelf_structure?.visible_shelf_levels ?? "—" },
              {
                label: "Image quality",
                value: analysis.image_quality?.status ?? ctx.extras.image_quality?.status ?? "—",
              },
            ]),
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AiMetricStat label="Location" value={analysis.location || ctx.extras.location || "—"} bg={summaryFillAt(0)} />
          <AiMetricStat label="Location status" value={analysis.location_status || "—"} bg={summaryFillAt(1)} />
          <AiMetricStat
            label="Shelf levels"
            value={analysis.shelf_structure?.visible_shelf_levels ?? "—"}
            bg={summaryFillAt(2)}
          />
          <AiMetricStat
            label="Image quality"
            value={analysis.image_quality?.status ?? ctx.extras.image_quality?.status ?? "—"}
            bg={summaryFillAt(3)}
          />
        </div>
        {analysis.shelf_structure?.notes ? (
          <p className="mt-3 text-sm text-muted-foreground">{analysis.shelf_structure.notes}</p>
        ) : null}
      </AiAuditCard>

      <AiAuditCard
        title="Summary KPIs"
        description="What the AI found on this shelf"
        csvDownload={{
          onDownload: () =>
            downloadKeyValueCsv(
              data.scan_id,
              "summary-kpis",
              summaryTiles.map((t) => ({ label: t.label, value: t.value })),
            ),
        }}
      >
        <MpTileGrid tiles={summaryTiles} />
      </AiAuditCard>

      <AiLocationCards scanId={data.scan_id} locationAnalysis={locationAnalysis} />

      {risk ? (
        <AiAuditCard
          title="Execution risk"
          description="Issues that need attention"
          csvDownload={{
            onDownload: () =>
              downloadSectionCsv(
                data.scan_id,
                "execution-risk",
                ["Severity", "Rules triggered", "Reasons", "Rule"],
                risk.rules_triggered.length
                  ? risk.rules_triggered.map((rule) => [
                      risk.severity,
                      risk.rules_triggered.length,
                      risk.reasons.length,
                      String(rule.description ?? rule.rule_id ?? ""),
                    ])
                  : [[risk.severity, 0, risk.reasons.length, "None"]],
              ),
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AiMetricStat label="Severity" value={risk.severity || "NONE"} bg={KPI_CARD.criticalFindings} />
            <AiMetricStat label="Rules triggered" value={risk.rules_triggered.length} bg={KPI_CARD.openFindings} />
            <AiMetricStat label="Reasons" value={risk.reasons.length || "—"} bg={KPI_CARD.overdueActions} />
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
        <AiAuditCard
          title="Focus brand analysis"
          description="Primary brand performance on this fixture"
          csvDownload={{
            onDownload: () =>
              downloadKeyValueCsv(data.scan_id, "focus-brand", [
                { label: "Brand", value: analysis.focus_brand_analysis!.brand },
                { label: "Total Facings", value: analysis.focus_brand_analysis!.facings },
                { label: "Visible units", value: analysis.focus_brand_analysis!.visible_units },
                {
                  label: "Facing share %",
                  value: analysis.focus_brand_analysis!.share_of_facings_percent,
                },
                {
                  label: "Unit share %",
                  value: analysis.focus_brand_analysis!.share_of_visible_units_percent,
                },
                { label: "Status", value: analysis.focus_brand_analysis!.status },
              ]),
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <AiMetricStat label="Brand" value={analysis.focus_brand_analysis.brand} bg={summaryFillAt(0)} />
            <AiMetricStat label="Total Facings" value={analysis.focus_brand_analysis.facings} bg={summaryFillAt(1)} />
            <AiMetricStat
              label="Visible units"
              value={analysis.focus_brand_analysis.visible_units}
              bg={summaryFillAt(2)}
            />
            <AiMetricStat
              label="Facing share"
              value={pctCell(analysis.focus_brand_analysis.share_of_facings_percent)}
              bg={summaryFillAt(3)}
            />
            <AiMetricStat
              label="Unit share"
              value={pctCell(analysis.focus_brand_analysis.share_of_visible_units_percent)}
              bg={summaryFillAt(4)}
            />
          </div>
          <div className="mt-3">{statusBadge(analysis.focus_brand_analysis.status)}</div>
        </AiAuditCard>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {categoryDonut.length ? (
          <AiAuditCard
            title="Category share of total facings"
            description="How shelf space is split across categories"
            csvDownload={{
              onDownload: () =>
                downloadSectionCsv(
                  data.scan_id,
                  "category-facing-share",
                  ["Category", "Total Facings", "Share %"],
                  categoryFromProducts.map((c) => [
                    c.category,
                    c.facings,
                    c.share_of_facings_percent,
                  ]),
                ),
            }}
          >
            <MpDonut
              slices={categoryDonut.map((s, i) => ({
                ...s,
                color: i % 2 === 0 ? CHART_ACCENT.categoryFacingShare : CHART_ACCENT.rankByUnits,
              }))}
              total={facingsTotal || categoryDonut.reduce((a, slice) => a + slice.value, 0)}
              totalLabel="Total Facings"
            />
          </AiAuditCard>
        ) : (
          <AiAuditCard title="Category share of total facings" description="How shelf space is split across categories">
            <p className="text-sm text-muted-foreground">
              Data unavailable — categories were not clearly readable in this photo.
            </p>
          </AiAuditCard>
        )}
        {brandDonut.length ? (
          <AiAuditCard
            title="Brand share of total facings"
            description="How shelf space is split across brands"
            csvDownload={{
              onDownload: () =>
                downloadSectionCsv(
                  data.scan_id,
                  "brand-facing-share",
                  ["Brand", "Total Facings", "Share %"],
                  brandRows
                    .filter((b) => b.facings > 0)
                    .map((b) => [b.brand, b.facings, b.share_of_facings_percent]),
                ),
            }}
          >
            <MpDonut
              slices={brandDonut.map((s, i) => ({
                ...s,
                color: i % 2 === 0 ? CHART_ACCENT.brandFacingShare : CHART_ACCENT.brandUnitShare,
              }))}
              total={facingsTotal || brandDonut.reduce((a, slice) => a + slice.value, 0)}
              totalLabel="Total Facings"
            />
          </AiAuditCard>
        ) : (
          <AiAuditCard title="Brand share of total facings" description="How shelf space is split across brands">
            <p className="text-sm text-muted-foreground">
              Data unavailable — brands were not clearly readable in this photo.
            </p>
          </AiAuditCard>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {facingsBars.length ? (
          <AiAuditCard
            title="Top products by total facings"
            description="Front-row positions each product occupies on the shelf"
            csvDownload={{
              onDownload: () =>
                downloadSectionCsv(
                  data.scan_id,
                  "top-products-facings",
                  ["Product", "Total Facings"],
                  facingsBars.map((r) => [r.label, r.value]),
                ),
            }}
          >
            <MpRankBars data={facingsBars} unit=" total facings" />
          </AiAuditCard>
        ) : null}
        {unitsBars.length ? (
          <AiAuditCard
            title="Top products by visible units"
            description="Units fully in view — never more than the product's total facings"
            csvDownload={{
              onDownload: () =>
                downloadSectionCsv(
                  data.scan_id,
                  "top-products-units",
                  ["Product", "Visible units"],
                  unitsBars.map((r) => [r.label, r.value]),
                ),
            }}
          >
            <MpRankBars data={unitsBars} unit=" visible units" />
          </AiAuditCard>
        ) : null}
      </div>

      {brandRows.length ? (
        <AiAuditCard
          title="Brand analysis"
          description="Brand facing and unit share"
          csvDownload={{
            onDownload: () =>
              downloadSectionCsv(
                data.scan_id,
                "brand-analysis",
                [
                  "Brand",
                  "Total Facings",
                  "Visible units",
                  "Facing share %",
                  "Unit share %",
                  "Rank facings",
                  "Rank units",
                  "Confidence",
                ],
                brandRows.map((b) => [
                  b.brand,
                  b.facings,
                  b.visible_units ?? "N/A",
                  b.share_of_facings_percent,
                  b.share_of_visible_units_percent ?? "N/A",
                  b.rank_by_facings,
                  b.rank_by_visible_units ?? "N/A",
                  b.confidence || "N/A",
                ]),
              ),
          }}
        >
          <AiAuditMetricTable
            rows={brandRows}
            rowKey={(r) => r.key}
            columns={[
              { key: "b", header: "Brand", cell: (r: BrandRow) => r.brand },
              { key: "f", header: "Total Facings", cell: (r) => r.facings },
              { key: "u", header: "Visible units", cell: (r) => r.visible_units ?? "N/A" },
              { key: "fs", header: "Facing share %", cell: (r) => pctCell(r.share_of_facings_percent) },
              {
                key: "us",
                header: "Unit share %",
                cell: (r) =>
                  r.share_of_visible_units_percent == null ? "N/A" : pctCell(r.share_of_visible_units_percent),
              },
              { key: "rf", header: "Rank facings", cell: (r) => r.rank_by_facings || "—" },
              { key: "ru", header: "Rank units", cell: (r) => r.rank_by_visible_units ?? "—" },
              { key: "c", header: "Confidence", cell: (r) => (r.confidence ? confCell(r.confidence) : "—") },
            ]}
          />
        </AiAuditCard>
      ) : null}

      {analysis.category_analysis.length || categoryFromProducts.length ? (
        <AiAuditCard
          title="Category analysis"
          description="Facing and unit share by category"
          csvDownload={{
            onDownload: () =>
              downloadSectionCsv(
                data.scan_id,
                "category-analysis",
                ["Category", "Total Facings", "Visible units", "Facing share %", "Unit share %"],
                categoryFromProducts.map((c) => [
                  c.category,
                  c.facings,
                  c.visible_units,
                  c.share_of_facings_percent,
                  c.share_of_visible_units_percent,
                ]),
              ),
          }}
        >
          <AiAuditMetricTable
            rows={categoryFromProducts}
            rowKey={(r) => r.category}
            columns={[
              { key: "c", header: "Category", cell: (r: AstraShelfCategoryAnalysis) => r.category },
              { key: "f", header: "Total Facings", cell: (r) => r.facings },
              { key: "u", header: "Visible units", cell: (r) => r.visible_units },
              { key: "fs", header: "Facing share %", cell: (r) => pctCell(r.share_of_facings_percent) },
              { key: "us", header: "Unit share %", cell: (r) => pctCell(r.share_of_visible_units_percent) },
              { key: "conf", header: "Confidence", cell: (r) => confCell(r.confidence) },
            ]}
          />
        </AiAuditCard>
      ) : null}

      <AiAuditCard
        title="Detected products"
        description="Products found in the shelf photo"
        csvDownload={{
          onDownload: () =>
            downloadSectionCsv(
              data.scan_id,
              "detected-products",
              [
                "Brand",
                "Product",
                "Variant",
                "Category",
                "Subcategory",
                "Location",
                "Rack",
                "Total Facings",
                "Visible units",
                "Shelf price",
                "Confidence",
                "Evidence",
              ],
              analysis.products.map((r) => [
                r.brand,
                r.product_name,
                r.variant,
                r.category,
                r.subcategory,
                r.location_label ?? "N/A",
                r.rack_marker ?? "N/A",
                r.actual_facings,
                r.actual_visible_units,
                r.visible_price ?? "N/A",
                r.confidence,
                r.evidence_note,
              ]),
            ),
        }}
      >
        <AiAuditMetricTable
          columns={productColumns}
          rows={analysis.products}
          rowKey={(r, i) => `${r.brand}-${r.variant}-${i}`}
        />
      </AiAuditCard>

      {analysis.visible_prices.length ? (
        <AiAuditCard
          title="Visible prices"
          description="All visible_prices from secondary vision"
          csvDownload={{
            onDownload: () =>
              downloadSectionCsv(
                data.scan_id,
                "visible-prices",
                ["Product", "Brand", "Price", "Type", "Confidence"],
                analysis.visible_prices.map((r) => [
                  r.product_name,
                  r.brand,
                  r.price,
                  r.price_type,
                  r.confidence,
                ]),
              ),
          }}
        >
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
        <AiAuditCard title="Visible prices" description="Prices readable on shelf labels">
          <p className="text-sm text-muted-foreground">
            Data unavailable — prices were not readable in this photo.
          </p>
        </AiAuditCard>
      )}

      {analysis.visible_promotions.length ? (
        <AiAuditCard
          title="Visible promotions"
          description="Promotional offers found on the shelf"
          csvDownload={{
            onDownload: () =>
              downloadSectionCsv(
                data.scan_id,
                "visible-promotions",
                ["Brand", "Product", "Text", "Type", "Confidence"],
                analysis.visible_promotions.map((r) => [
                  r.brand ?? r.product_or_brand,
                  r.product_name,
                  r.promotion_text,
                  r.promotion_type,
                  r.confidence,
                ]),
              ),
          }}
        >
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
        <AiAuditCard
          title="Shelf issues"
          description="Problems spotted on the shelf"
          csvDownload={{
            onDownload: () =>
              downloadSectionCsv(
                data.scan_id,
                "shelf-issues",
                ["Type", "Description", "Position", "Severity", "Confidence"],
                analysis.shelf_issues.map((r) => [
                  r.issue_type,
                  r.description,
                  r.shelf_position,
                  r.severity,
                  r.confidence,
                ]),
              ),
          }}
        >
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
