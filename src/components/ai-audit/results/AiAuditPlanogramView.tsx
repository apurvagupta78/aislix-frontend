import {
  AiAstraOutputSections,
  AiCountApproximateNote,
  AiImageQualityBanner,
} from "@/components/ai-audit/results/AiAstraExtrasSections";
import {
  AiGroupedComparisonBars,
  AiShareComparisonBars,
  AiVarianceBars,
  statusDonutSlices,
} from "@/components/ai-audit/results/AiAuditCharts";
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
  LocationStatusPill,
  PriceStatusPill,
  ShelfPriceCell,
  locationStatusLabel,
  priceStatusLabel,
} from "@/components/ai-audit/results/AiLocationSections";
import { ReferenceMatchSection } from "@/components/ai-audit/results/ReferenceMatchSection";
import { MpDonut, MpRadialGauge, MpTileGrid } from "@/components/control-tower/MpCharts";
import type { AiAuditDisplayContext } from "@/lib/ai-audit/astra-display";
import type {
  AstraPlanogramBrandAnalysis,
  AstraPlanogramCategoryAnalysis,
  AstraPlanogramProduct,
  AstraPlanogramSubcategoryAnalysis,
  AstraUnplannedProduct,
} from "@/lib/ai-audit/astra-response";
import { capUnitsToFacings } from "@/lib/ai-audit/astra-response";
import { CHART_ACCENT, KPI_CARD, summaryFillAt } from "@/lib/ai-audit/kpi-palette";
import { metricDisplayValue, metricStatusLabel } from "@/lib/ai-audit/metric-results";
import { downloadKeyValueCsv, downloadSectionCsv } from "@/lib/ai-audit/section-csv";
import { referenceExpectsFacings } from "@/lib/ai-audit/reference-match";
import type { ScanResult } from "@/lib/scan-results";

type Props = {
  data: ScanResult;
  ctx: AiAuditDisplayContext;
  imageUrl?: string | null;
};

function identityLabel(brand?: string, product?: string, variant?: string) {
  const b = brand?.trim() || "Unknown brand";
  const name = product?.trim();
  const cleanName =
    !name || /^(unverifiable|unknown|unidentified)$/i.test(name) ? "Product" : name;
  const v = variant?.trim();
  const cleanVariant =
    v && !/^(unverifiable|unknown|unidentified)$/i.test(v)
      ? v
      : v
        ? "Variant: Unverifiable"
        : "";
  return cleanVariant ? `${b} · ${cleanName} · ${cleanVariant}` : `${b} · ${cleanName}`;
}

function productLabel(row: AstraPlanogramProduct) {
  return identityLabel(row.brand, row.product_name, row.variant);
}

function actualByAiLabel(row: AstraPlanogramProduct) {
  const brand = row.actual_brand?.trim();
  const product = row.actual_product_name?.trim();
  const variant = row.actual_variant?.trim();
  if (!brand && !product && !variant) return null;
  return identityLabel(brand || row.brand, product, variant);
}

function pickAstraCvProducts(data: ScanResult): Array<{
  brand: string;
  product: string;
  variant: string;
  category: string;
  actual_facings: number | null;
  actual_visible_units: number | null;
  confidence: number | null;
}> {
  const metrics = (data.metrics ?? {}) as Record<string, unknown>;
  const block =
    (data.astra_cv_analysis as Record<string, unknown> | undefined) ??
    (metrics.astra_cv_analysis as Record<string, unknown> | undefined);
  const products = Array.isArray(block?.products) ? block.products : [];
  return products
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object" && !Array.isArray(p))
    .map((p) => {
      const facings =
        p.actual_facings == null || p.actual_facings === "" ? null : Number(p.actual_facings);
      const units =
        p.actual_visible_units == null || p.actual_visible_units === ""
          ? null
          : Number(p.actual_visible_units);
      return {
        brand: String(p.brand ?? "").trim() || "—",
        product: String(p.product_name ?? p.product ?? "").trim() || "—",
        variant: String(p.variant ?? "").trim() || "—",
        category: String(p.category ?? "").trim() || "—",
        actual_facings: facings,
        actual_visible_units: capUnitsToFacings(units, facings),
        confidence: p.confidence == null || p.confidence === "" ? null : Number(p.confidence),
      };
    });
}

function countCell(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return String(value);
}

function varianceCell(value: number | null | undefined) {
  if (value == null) return "—";
  return value > 0 ? `+${value}` : String(value);
}

export function AiAuditPlanogramView({ data, ctx, imageUrl }: Props) {
  if (ctx.analysis.mode !== "planogram") return null;
  const analysis = ctx.analysis;
  const s = analysis.summary;
  const calc = ctx.calculatedMetrics;
  const documentMode = Boolean(analysis.reference_match);
  const facingTargets = referenceExpectsFacings(
    analysis.reference_match,
    analysis.products.map((row) => row.expected_facings),
  );
  const planoMetric = calc.planogram_compliance;
  const facingMetric = calc.overall_facing_compliance;
  const countPending =
    Boolean(analysis.count_verification_pending) ||
    planoMetric?.status === "COUNT_MISMATCH" ||
    facingMetric?.status === "COUNT_MISMATCH" ||
    calc.total_actual_facings?.status === "COUNT_MISMATCH";
  const rawCompliance =
    (typeof planoMetric?.value === "number" ? planoMetric.value : null) ??
    ctx.compliancePercent ??
    s.overall_planogram_compliance_percent;
  const compliance =
    countPending || rawCompliance == null ? null : Math.round(rawCompliance);
  const statusCounts: Record<string, number> = {};
  for (const row of analysis.products) {
    const key = row.overall_status || row.match_status || "UNKNOWN";
    statusCounts[key] = (statusCounts[key] ?? 0) + 1;
  }
  const donutSlices = statusDonutSlices(statusCounts);
  const locationAnalysis = analysis.location_analysis;
  const pricesAssessed = locationAnalysis?.metrics.prices_read != null;
  const wrongBinCount = analysis.products.filter((r) => r.location_status === "WRONG_LOCATION").length;

  const funnelTiles = [
    { label: "Matched", value: String(s.products_matched), tone: "healthy" as const, bg: KPI_CARD.auditPass },
    { label: "Not found", value: String(s.products_not_found), tone: "attention" as const, bg: KPI_CARD.criticalFindings },
    { label: "Non-compliant", value: String(s.non_compliant_products), tone: "attention" as const, bg: KPI_CARD.openFindings },
    { label: "Unverifiable", value: String(s.products_not_verifiable), tone: "neutral" as const, bg: KPI_CARD.overdueActions },
    { label: "Wrong placement", value: String(s.wrong_placements), tone: "attention" as const, bg: KPI_CARD.auditCompletion },
    { label: "Price mismatches", value: String(s.price_mismatches), tone: "attention" as const, bg: KPI_CARD.evidenceCoverage },
    ...(locationAnalysis
      ? [
          {
            label: "Wrong bin",
            value: String(wrongBinCount),
            tone: wrongBinCount ? ("attention" as const) : ("neutral" as const),
            bg: KPI_CARD.criticalFindings,
          },
        ]
      : []),
    { label: "Value gap ₹", value: String(s.total_potential_visible_unit_value_gap_inr), tone: "active" as const, bg: KPI_CARD.inventoryValueVariance },
  ];

  const allSummaryStats = [
    { label: documentMode ? "Document lines" : "Total rows", value: s.total_planogram_rows || analysis.products.length },
    {
      label: documentMode ? "Compliance" : "Planogram compliance",
      value: metricDisplayValue(planoMetric, pctCell(s.overall_planogram_compliance_percent)),
      status: metricStatusLabel(planoMetric?.status),
    },
    {
      label: "Facing compliance",
      value: metricDisplayValue(facingMetric, pctCell(s.overall_facing_compliance_percent)),
      status: metricStatusLabel(facingMetric?.status),
      facingTarget: true,
    },
    { label: "Unit compliance", value: pctCell(s.overall_shelf_unit_compliance_percent), facingTarget: true },
    {
      label: "Products identified",
      value: metricDisplayValue(calc.products_identified, analysis.products.length),
      status: metricStatusLabel(calc.products_identified?.status),
    },
    {
      label: "Brands identified",
      value: metricDisplayValue(calc.brands_identified, analysis.brand_analysis.length),
      status: metricStatusLabel(calc.brands_identified?.status),
    },
    {
      label: "Total Facings",
      value: metricDisplayValue(calc.total_actual_facings, s.total_actual_facings),
      status: metricStatusLabel(calc.total_actual_facings?.status),
      sub: facingTargets ? `Expected ${s.total_expected_facings}` : undefined,
    },
    {
      label: "Visible units",
      value: metricDisplayValue(calc.total_actual_visible_units, s.total_actual_visible_units),
      status: metricStatusLabel(calc.total_actual_visible_units?.status),
      sub: facingTargets ? `Expected ${s.total_expected_shelf_units}` : undefined,
    },
    { label: "Below exp facings", value: s.products_below_expected_facings, facingTarget: true },
    { label: "Below min facings", value: s.products_below_minimum_facings, facingTarget: true },
    { label: "Above max facings", value: s.products_above_maximum_facings, facingTarget: true },
    { label: "Below exp units", value: s.products_below_expected_units, facingTarget: true },
  ];
  const summaryStats = allSummaryStats.filter((stat) => facingTargets || !("facingTarget" in stat));

  const topVariance = [...analysis.products]
    .filter((row) => row.facing_variance != null)
    .sort((a, b) => Math.abs(b.facing_variance ?? 0) - Math.abs(a.facing_variance ?? 0))
    .slice(0, 8)
    .map((row) => ({ label: productLabel(row), variance: row.facing_variance ?? 0 }));

  const topUnitVariance = [...analysis.products]
    .filter((row) => row.shelf_unit_variance != null)
    .sort((a, b) => Math.abs(b.shelf_unit_variance ?? 0) - Math.abs(a.shelf_unit_variance ?? 0))
    .slice(0, 8)
    .map((row) => ({ label: productLabel(row), variance: row.shelf_unit_variance ?? 0 }));

  const facingCompare = [...analysis.products]
    .sort((a, b) => Math.abs(b.facing_variance ?? 0) - Math.abs(a.facing_variance ?? 0))
    .slice(0, 6)
    .map((row) => ({
      label: productLabel(row),
      expected: row.expected_facings,
      actual: row.actual_facings,
    }));

  const catHasCompliance = analysis.category_analysis.some((c) => c.compliance_percent != null);
  const catHasStatus = analysis.category_analysis.some((c) => Boolean(c.status));
  const subHasCompliance = analysis.subcategory_analysis.some((c) => c.compliance_percent != null);
  const subHasStatus = analysis.subcategory_analysis.some((c) => Boolean(c.status));

  const astraCvProducts = pickAstraCvProducts(data);

  const productColumns = [
    {
      key: "product",
      header: "Product",
      className: "min-w-[260px] sticky left-0 z-10 bg-card",
      cell: (r: AstraPlanogramProduct) => {
        const aiLabel = actualByAiLabel(r);
        return (
          <div className="max-w-[300px]">
            <p className="text-xs font-medium text-[#667085]">Expected</p>
            <p className="font-medium leading-snug text-[#04203F]">{productLabel(r)}</p>
            {aiLabel ? (
              <>
                <p className="mt-1.5 text-xs font-medium text-[#667085]">
                  Actual by AI
                </p>
                <p className="leading-snug text-[#04203F]">{aiLabel}</p>
              </>
            ) : (
              <p className="mt-1 text-[11px] text-[#667085]">Actual by AI: —</p>
            )}
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {[r.location, r.category, r.subcategory].filter(Boolean).join(" · ") || "—"}
            </p>
            {r.sku ? <p className="text-[11px] text-muted-foreground">SKU: {r.sku}</p> : null}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (r: AstraPlanogramProduct) => statusBadge(r.overall_status || r.match_status),
    },
    ...(facingTargets
      ? [{ key: "exp_f", header: "Expected", cell: (r: AstraPlanogramProduct) => r.expected_facings }]
      : []),
    {
      key: "act_f",
      header: "Total Facings",
      cell: (r: AstraPlanogramProduct) => countCell(r.actual_facings),
    },
    ...(facingTargets
      ? [
          {
            key: "f_var",
            header: "Facing Δ",
            cell: (r: AstraPlanogramProduct) => varianceCell(r.facing_variance),
          },
          {
            key: "f_pct",
            header: "Facing %",
            cell: (r: AstraPlanogramProduct) => pctCell(r.facing_compliance_percent),
          },
          {
            key: "exp_u",
            header: "Exp units",
            cell: (r: AstraPlanogramProduct) => r.expected_shelf_units || "—",
          },
        ]
      : []),
    {
      key: "act_u",
      header: "Visible units",
      cell: (r: AstraPlanogramProduct) => countCell(r.actual_visible_units),
    },
    ...(locationAnalysis
      ? [
          {
            key: "loc",
            header: "Location",
            cell: (r: AstraPlanogramProduct) => (
              <div className="space-y-1">
                {r.expected_location ? (
                  <p className="text-[11px] text-[#667085]">
                    Expected <span className="font-mono text-[#04203F]">{r.expected_location}</span>
                  </p>
                ) : null}
                {r.actual_facings != null ? (
                  <LocationLabelCell
                    label={r.actual_location_label}
                    status={r.actual_location_label_status}
                  />
                ) : null}
                {r.additional_location_labels.length ? (
                  <p className="font-mono text-[10px] text-[#667085]">
                    +{r.additional_location_labels.join(", ")}
                  </p>
                ) : null}
                {r.location_status ? <LocationStatusPill status={r.location_status} /> : null}
              </div>
            ),
          },
        ]
      : []),
    ...(pricesAssessed
      ? [
          {
            key: "price",
            header: "Shelf price",
            cell: (r: AstraPlanogramProduct) => (
              <div className="space-y-1">
                {r.expected_mrp_inr ? (
                  <p className="text-[11px] text-[#667085]">Expected ₹{r.expected_mrp_inr}</p>
                ) : null}
                {r.actual_facings != null ? <ShelfPriceCell price={r.visible_price} /> : null}
                {r.price_status ? (
                  <PriceStatusPill status={r.price_status} difference={r.price_difference} />
                ) : null}
              </div>
            ),
          },
        ]
      : []),
    {
      key: "variant_st",
      header: "Variant",
      cell: (r: AstraPlanogramProduct) => statusBadge(r.variant_status || r.match_status),
    },
    {
      key: "conf",
      header: "Conf.",
      cell: (r: AstraPlanogramProduct) => confCell(r.confidence),
    },
    {
      key: "ev",
      header: "Evidence",
      className: "min-w-[180px]",
      cell: (r: AstraPlanogramProduct) => (
        <span className="text-muted-foreground">{r.evidence_note || "—"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AiResultsHero
        modeLabel={documentMode ? "Document comparison" : "Planogram comparison"}
        operatingModel={ctx.extras.operating_model_label ?? ctx.extras.operating_model}
      />
      <AiExecutiveSummary text={data.executive_summary} scanId={data.scan_id} />
      <AiImageQualityBanner extras={ctx.extras} />

      {countPending ? (
        <div
          className="rounded-2xl border bg-white px-4 py-3 text-sm text-[#04203F] border-[#ECBDCC]"
          role="status"
        >
          <p className="font-semibold tracking-wide">COUNT VERIFICATION PENDING</p>
          <p className="mt-1 text-[#667085]">
            Visual counts need review. Aggregate compliance is not shown as valid — product rows
            remain available below.
          </p>
        </div>
      ) : (
        <AiCountApproximateNote metrics={data.metrics} />
      )}

      {analysis.reference_match ? (
        <ReferenceMatchSection
          scanId={data.scan_id}
          match={analysis.reference_match}
          imageUrl={imageUrl}
          documentItems={data.reference_items}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[auto,1fr]">
        <AiAuditCard
          title={documentMode ? "Compliance" : "Planogram compliance"}
          description={
            documentMode ? "How closely the shelf matches your document" : "How closely the shelf matches the plan"
          }
          csvDownload={{
            onDownload: () =>
              downloadKeyValueCsv(data.scan_id, "planogram-compliance", [
                {
                  label: "Planogram compliance %",
                  value: countPending ? "COUNT VERIFICATION PENDING" : compliance,
                },
                { label: "Status", value: metricStatusLabel(planoMetric?.status) },
                { label: "Rows", value: analysis.products.length },
              ]),
          }}
        >
          {countPending || compliance == null ? (
            <div className="flex min-h-[140px] flex-col items-center justify-center gap-2 px-4 text-center">
              <p className="text-sm font-semibold text-[#04203F]">COUNT VERIFICATION PENDING</p>
              <p className="text-xs text-[#667085]">
                {analysis.products.length} products · aggregate compliance unavailable
              </p>
            </div>
          ) : (
            <MpRadialGauge
              value={compliance}
              label="Compliant"
              sublabel={`${analysis.products.length} products`}
              color={CHART_ACCENT.brandFacingShare}
            />
          )}
        </AiAuditCard>
        <AiAuditCard
          title="Summary KPIs"
          description={documentMode ? "What was found versus your document" : "What was found versus the plan"}
          csvDownload={{
            onDownload: () =>
              downloadKeyValueCsv(data.scan_id, "summary-kpis", [
                ...funnelTiles.map((t) => ({ label: t.label, value: t.value })),
                ...summaryStats.map((t) => ({ label: t.label, value: t.value })),
              ]),
          }}
        >
          <MpTileGrid tiles={funnelTiles} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryStats.map((stat, i) => (
              <AiMetricStat
                key={stat.label}
                label={stat.label}
                value={stat.value}
                sub={"sub" in stat ? (stat as { sub?: string }).sub : undefined}
                bg={summaryFillAt(i)}
              />
            ))}
          </div>
        </AiAuditCard>
      </div>

      <AiLocationCards scanId={data.scan_id} locationAnalysis={locationAnalysis} countPending={countPending} />

      <div className="grid gap-4 xl:grid-cols-3">
        {donutSlices.length ? (
          <AiAuditCard
            title="Status mix"
            description="Overall row status distribution"
            csvDownload={{
              onDownload: () =>
                downloadSectionCsv(
                  data.scan_id,
                  "status-mix",
                  ["Status", "Count"],
                  donutSlices.map((slice) => [slice.label, slice.value]),
                ),
            }}
          >
            <MpDonut slices={donutSlices} total={analysis.products.length} totalLabel="Rows" />
          </AiAuditCard>
        ) : null}
        {facingTargets ? (
          <>
            <AiAuditCard
              title="Largest facing variance"
              description="Products furthest from their expected facings"
              className="xl:col-span-1"
              csvDownload={{
                onDownload: () =>
                  downloadSectionCsv(
                    data.scan_id,
                    "facing-variance",
                    ["Product", "Facing variance"],
                    topVariance.map((r) => [r.label, r.variance]),
                  ),
              }}
            >
              <AiVarianceBars
                items={topVariance}
                unit=" facings"
                accent={CHART_ACCENT.actualFacings}
                onTargetText="Every product is at its expected facings — no facing variance."
                unavailableText="Facing targets aren't set for these products, so facing variance isn't calculated."
              />
            </AiAuditCard>
            <AiAuditCard
              title="Largest unit variance"
              description="Products furthest from their expected visible units"
              csvDownload={{
                onDownload: () =>
                  downloadSectionCsv(
                    data.scan_id,
                    "unit-variance",
                    ["Product", "Unit variance"],
                    topUnitVariance.map((r) => [r.label, r.variance]),
                  ),
              }}
            >
              <AiVarianceBars
                items={topUnitVariance}
                unit=" units"
                accent={CHART_ACCENT.actualUnits}
                onTargetText="Every product is at its expected visible units — no unit variance."
                unavailableText="Unit targets aren't set in this planogram, so unit variance isn't calculated."
              />
            </AiAuditCard>
          </>
        ) : null}
      </div>

      {facingTargets ? (
        <AiAuditCard
          title="Expected vs actual facings"
          description="Side-by-side comparison for top variance SKUs"
          csvDownload={{
            onDownload: () =>
              downloadSectionCsv(
                data.scan_id,
                "expected-vs-actual-facings",
                ["Product", "Expected", "Actual"],
                facingCompare.map((r) => [r.label, r.expected, r.actual]),
              ),
          }}
        >
          <AiGroupedComparisonBars items={facingCompare} unit="" accent={CHART_ACCENT.rankByFacings} />
        </AiAuditCard>
      ) : null}

      {analysis.brand_analysis.length && !facingTargets ? (
        <AiAuditCard
          title="Brands on the shelf"
          description="Facings and share of shelf the AI counted per brand"
          csvDownload={{
            onDownload: () =>
              downloadSectionCsv(
                data.scan_id,
                "brand-analysis",
                ["Brand", "Total Facings", "Share %"],
                analysis.brand_analysis.map((b) => [b.brand, b.actual_facings, b.actual_share_percent]),
              ),
          }}
        >
          <AiAuditMetricTable
            rows={analysis.brand_analysis}
            rowKey={(r) => r.brand}
            columns={[
              { key: "b", header: "Brand", cell: (r: AstraPlanogramBrandAnalysis) => r.brand },
              { key: "af", header: "Total Facings", cell: (r) => countCell(r.actual_facings) },
              { key: "as", header: "Share %", cell: (r) => pctCell(r.actual_share_percent) },
            ]}
          />
        </AiAuditCard>
      ) : null}

      {analysis.brand_analysis.length && facingTargets ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <AiAuditCard
            title="Brand share vs plan"
            description="Expected vs actual brand facing share"
            csvDownload={{
              onDownload: () =>
                downloadSectionCsv(
                  data.scan_id,
                  "brand-share",
                  ["Brand", "Expected share %", "Actual share %", "Variance pp"],
                  analysis.brand_analysis.map((b) => [
                    b.brand,
                    b.expected_share_percent,
                    b.actual_share_percent,
                    b.share_variance_pp,
                  ]),
                ),
            }}
          >
            <AiShareComparisonBars
              accent={CHART_ACCENT.brandFacingShare}
              items={analysis.brand_analysis.map((b) => ({
                label: b.brand,
                expected: b.expected_share_percent,
                actual: b.actual_share_percent,
                variancePp: b.share_variance_pp,
              }))}
            />
          </AiAuditCard>
          <AiAuditCard
            title="Brand analysis table"
            description="All brand analysis fields"
            csvDownload={{
              onDownload: () =>
                downloadSectionCsv(
                  data.scan_id,
                  "brand-analysis",
                  [
                    "Brand",
                    "Exp facings",
                    "Total Facings",
                    "Exp share %",
                    "Act share %",
                    "Variance pp",
                    "Status",
                  ],
                  analysis.brand_analysis.map((b) => [
                    b.brand,
                    b.expected_facings,
                    b.actual_facings,
                    b.expected_share_percent,
                    b.actual_share_percent,
                    b.share_variance_pp,
                    b.status,
                  ]),
                ),
            }}
          >
            <AiAuditMetricTable
              rows={analysis.brand_analysis}
              rowKey={(r) => r.brand}
              columns={[
                { key: "b", header: "Brand", cell: (r: AstraPlanogramBrandAnalysis) => r.brand },
                { key: "ef", header: "Exp facings", cell: (r) => r.expected_facings },
                { key: "af", header: "Total Facings", cell: (r) => countCell(r.actual_facings) },
                { key: "es", header: "Exp share %", cell: (r) => pctCell(r.expected_share_percent) },
                { key: "as", header: "Act share %", cell: (r) => pctCell(r.actual_share_percent) },
                { key: "vp", header: "Variance pp", cell: (r) => r.share_variance_pp.toFixed(1) },
                { key: "st", header: "Status", cell: (r) => statusBadge(r.status) },
              ]}
            />
          </AiAuditCard>
        </div>
      ) : null}

      {analysis.category_analysis.length ? (
        <AiAuditCard
          title="Category analysis"
          description={
            catHasCompliance
              ? "Category facings, share, and compliance"
              : "Expected vs counted facings and share per category"
          }
          csvDownload={{
            onDownload: () =>
              downloadSectionCsv(
                data.scan_id,
                "category-analysis",
                [
                  "Category",
                  "Exp facings",
                  "Total Facings",
                  "Exp share %",
                  "Act share %",
                  "Compliance %",
                  "Status",
                ],
                analysis.category_analysis.map((c) => [
                  c.category,
                  c.expected_facings,
                  c.actual_facings,
                  c.expected_share_percent,
                  c.actual_share_percent,
                  c.compliance_percent,
                  c.status,
                ]),
              ),
          }}
        >
          <AiAuditMetricTable
            rows={analysis.category_analysis}
            rowKey={(r) => r.category}
            columns={[
              { key: "c", header: "Category", cell: (r: AstraPlanogramCategoryAnalysis) => r.category },
              ...(facingTargets
                ? [{ key: "ef", header: "Exp facings", cell: (r: AstraPlanogramCategoryAnalysis) => r.expected_facings }]
                : []),
              { key: "af", header: "Total Facings", cell: (r) => countCell(r.actual_facings) },
              ...(facingTargets
                ? [
                    {
                      key: "es",
                      header: "Exp share %",
                      cell: (r: AstraPlanogramCategoryAnalysis) => pctCell(r.expected_share_percent),
                    },
                  ]
                : []),
              { key: "as", header: facingTargets ? "Act share %" : "Share %", cell: (r) => pctCell(r.actual_share_percent) },
              ...(catHasCompliance
                ? [{ key: "cp", header: "Compliance %", cell: (r: AstraPlanogramCategoryAnalysis) => pctCell(r.compliance_percent) }]
                : []),
              ...(catHasStatus
                ? [{ key: "st", header: "Status", cell: (r: AstraPlanogramCategoryAnalysis) => statusBadge(r.status) }]
                : []),
            ]}
          />
        </AiAuditCard>
      ) : null}

      {analysis.subcategory_analysis.length ? (
        <AiAuditCard
          title="Subcategory analysis"
          description="Subcategory facings and compliance"
          csvDownload={{
            onDownload: () =>
              downloadSectionCsv(
                data.scan_id,
                "subcategory-analysis",
                ["Subcategory", "Exp facings", "Total Facings", "Compliance %", "Status"],
                analysis.subcategory_analysis.map((c) => [
                  c.subcategory,
                  c.expected_facings,
                  c.actual_facings,
                  c.compliance_percent,
                  c.status,
                ]),
              ),
          }}
        >
          <AiAuditMetricTable
            rows={analysis.subcategory_analysis}
            rowKey={(r) => r.subcategory}
            columns={[
              {
                key: "sc",
                header: "Subcategory",
                cell: (r: AstraPlanogramSubcategoryAnalysis) => r.subcategory,
              },
              ...(facingTargets
                ? [{ key: "ef", header: "Exp facings", cell: (r: AstraPlanogramSubcategoryAnalysis) => r.expected_facings }]
                : []),
              { key: "af", header: "Total Facings", cell: (r) => countCell(r.actual_facings) },
              ...(subHasCompliance
                ? [{ key: "cp", header: "Compliance %", cell: (r: AstraPlanogramSubcategoryAnalysis) => pctCell(r.compliance_percent) }]
                : []),
              ...(subHasStatus
                ? [{ key: "st", header: "Status", cell: (r: AstraPlanogramSubcategoryAnalysis) => statusBadge(r.status) }]
                : []),
            ]}
          />
        </AiAuditCard>
      ) : null}

      {astraCvProducts.length ? (
        <AiAuditCard
          title="AI detections"
          description="Every product identified on the shelf, shown exactly as returned"
          csvDownload={{
            onDownload: () =>
              downloadSectionCsv(
                data.scan_id,
                "astra-detections",
                ["Brand", "Product", "Variant", "Category", "Facings", "Visible units", "Confidence"],
                astraCvProducts.map((r) => [
                  r.brand,
                  r.product,
                  r.variant,
                  r.category,
                  r.actual_facings ?? "",
                  r.actual_visible_units ?? "",
                  r.confidence ?? "",
                ]),
              ),
          }}
        >
          <AiAuditMetricTable
            rows={astraCvProducts}
            rowKey={(r, i) => `${r.brand}-${r.variant}-${i}`}
            columns={[
              { key: "b", header: "Brand", cell: (r) => r.brand },
              { key: "p", header: "Product", cell: (r) => r.product },
              { key: "v", header: "Variant", cell: (r) => r.variant },
              { key: "c", header: "Category", cell: (r) => r.category },
              { key: "f", header: "Facings", cell: (r) => countCell(r.actual_facings) },
              { key: "u", header: "Visible units", cell: (r) => countCell(r.actual_visible_units) },
              {
                key: "conf",
                header: "Conf.",
                cell: (r) => (r.confidence == null ? "—" : confCell(r.confidence)),
              },
            ]}
          />
        </AiAuditCard>
      ) : null}

      <AiAuditCard
        title="Product comparison"
        description={
          documentMode
            ? "Your document vs shelf actuals — AI names shown as Actual by AI"
            : "Planogram expected vs shelf actuals — AI names shown as Actual by AI"
        }
        csvDownload={{
          onDownload: () =>
            downloadSectionCsv(
              data.scan_id,
              "product-comparison",
              [
                "Expected brand",
                "Expected product",
                "Expected variant",
                "Actual brand (AI)",
                "Actual product (AI)",
                "Actual variant (AI)",
                "SKU",
                "Expected facings",
                "Total Facings",
                "Facing variance",
                "Expected units",
                "Visible units",
                "Expected location",
                "Shelf location",
                "Location status",
                "Expected price",
                "Shelf price",
                "Price status",
                "Status",
                "Confidence",
                "Evidence",
              ],
              analysis.products.map((r) => [
                r.brand,
                r.product_name,
                r.variant,
                r.actual_brand ?? "",
                r.actual_product_name ?? "",
                r.actual_variant ?? "",
                r.sku,
                r.expected_facings,
                r.actual_facings ?? "",
                r.facing_variance ?? "",
                r.expected_shelf_units,
                r.actual_visible_units ?? "",
                r.expected_location || "N/A",
                [r.actual_location_label, ...r.additional_location_labels].filter(Boolean).join(" | ") || "N/A",
                r.location_status ? locationStatusLabel(r.location_status) : "N/A",
                r.expected_mrp_inr || "N/A",
                r.visible_price ?? "N/A",
                r.price_status ? priceStatusLabel(r.price_status) : "N/A",
                r.overall_status || r.match_status,
                r.confidence,
                r.evidence_note,
              ]),
            ),
        }}
      >
        <AiAuditMetricTable
          columns={productColumns}
          rows={analysis.products}
          rowKey={(r) => `${r.sku}-${r.brand}-${r.variant}`}
        />
      </AiAuditCard>

      {analysis.observed_unplanned_products.length ? (
        <AiAuditCard
          title={documentMode ? "Products not on your document" : "Unplanned products on shelf"}
          description={documentMode ? "On the shelf but not listed in your document" : "Products not in the planogram"}
          csvDownload={{
            onDownload: () =>
              downloadSectionCsv(
                data.scan_id,
                "unplanned-products",
                ["Brand", "Product", "Variant", "Total Facings", "Visible units", "Confidence"],
                analysis.observed_unplanned_products.map((r) => [
                  r.brand,
                  r.product_name,
                  r.variant,
                  r.actual_facings,
                  r.actual_visible_units,
                  r.confidence,
                ]),
              ),
          }}
        >
          <AiAuditMetricTable
            rows={analysis.observed_unplanned_products}
            rowKey={(r, i) => `${r.brand}-${i}`}
            columns={[
              { key: "b", header: "Brand", cell: (r: AstraUnplannedProduct) => r.brand },
              { key: "p", header: "Product", cell: (r) => r.product_name },
              { key: "v", header: "Variant", cell: (r) => r.variant || "—" },
              { key: "f", header: "Total Facings", cell: (r) => r.actual_facings },
              { key: "u", header: "Visible units", cell: (r) => r.actual_visible_units },
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
