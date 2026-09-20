import { AiAstraOutputSections, AiImageQualityBanner } from "@/components/ai-audit/results/AiAstraExtrasSections";
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
import { PlanogramSideBySidePanel } from "@/components/scan-results/PlanogramSideBySidePanel";
import { MpDonut, MpRadialGauge, MpTileGrid } from "@/components/control-tower/MpCharts";
import type { AiAuditDisplayContext } from "@/lib/ai-audit/astra-display";
import type {
  AstraPlanogramBrandAnalysis,
  AstraPlanogramCategoryAnalysis,
  AstraPlanogramProduct,
  AstraPlanogramSubcategoryAnalysis,
  AstraUnplannedProduct,
} from "@/lib/ai-audit/astra-response";
import { CHART_ACCENT, KPI_CARD, summaryFillAt } from "@/lib/ai-audit/kpi-palette";
import { metricDisplayValue, metricStatusLabel } from "@/lib/ai-audit/metric-results";
import { downloadKeyValueCsv, downloadSectionCsv } from "@/lib/ai-audit/section-csv";
import { planogramComparisonFromResult } from "@/lib/planogram-display";
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
    .map((p) => ({
      brand: String(p.brand ?? "").trim() || "—",
      product: String(p.product_name ?? p.product ?? "").trim() || "—",
      variant: String(p.variant ?? "").trim() || "—",
      category: String(p.category ?? "").trim() || "—",
      actual_facings:
        p.actual_facings == null || p.actual_facings === ""
          ? null
          : Number(p.actual_facings),
      actual_visible_units:
        p.actual_visible_units == null || p.actual_visible_units === ""
          ? null
          : Number(p.actual_visible_units),
      confidence: p.confidence == null || p.confidence === "" ? null : Number(p.confidence),
    }));
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
  const risk = ctx.executionRisk;
  const riskCount =
    risk?.rules_triggered.length ??
    s.high_priority_execution_risks ??
    0;

  const statusCounts: Record<string, number> = {};
  for (const row of analysis.products) {
    const key = row.overall_status || row.match_status || "UNKNOWN";
    statusCounts[key] = (statusCounts[key] ?? 0) + 1;
  }
  const donutSlices = statusDonutSlices(statusCounts);

  const funnelTiles = [
    { label: "Matched", value: String(s.products_matched), tone: "healthy" as const, bg: KPI_CARD.auditPass },
    { label: "Not found", value: String(s.products_not_found), tone: "attention" as const, bg: KPI_CARD.criticalFindings },
    { label: "Non-compliant", value: String(s.non_compliant_products), tone: "attention" as const, bg: KPI_CARD.openFindings },
    { label: "Unverifiable", value: String(s.products_not_verifiable), tone: "neutral" as const, bg: KPI_CARD.overdueActions },
    { label: "Wrong placement", value: String(s.wrong_placements), tone: "attention" as const, bg: KPI_CARD.auditCompletion },
    { label: "Price mismatches", value: String(s.price_mismatches), tone: "attention" as const, bg: KPI_CARD.evidenceCoverage },
    { label: "Exec. risks", value: String(riskCount), tone: "attention" as const, bg: KPI_CARD.slaCompliance },
    { label: "Value gap ₹", value: String(s.total_potential_visible_unit_value_gap_inr), tone: "active" as const, bg: KPI_CARD.inventoryValueVariance },
  ];

  const summaryStats = [
    { label: "Total rows", value: s.total_planogram_rows || analysis.products.length },
    {
      label: "Planogram compliance",
      value: metricDisplayValue(planoMetric, pctCell(s.overall_planogram_compliance_percent)),
      status: metricStatusLabel(planoMetric?.status),
    },
    {
      label: "Facing compliance",
      value: metricDisplayValue(facingMetric, pctCell(s.overall_facing_compliance_percent)),
      status: metricStatusLabel(facingMetric?.status),
    },
    { label: "Unit compliance", value: pctCell(s.overall_shelf_unit_compliance_percent) },
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
      sub: `Expected ${s.total_expected_facings}`,
    },
    {
      label: "Fully visible facings",
      value: metricDisplayValue(calc.total_actual_visible_units, s.total_actual_visible_units),
      status: metricStatusLabel(calc.total_actual_visible_units?.status),
      sub: `Expected ${s.total_expected_shelf_units}`,
    },
    { label: "Below exp facings", value: s.products_below_expected_facings },
    { label: "Below min facings", value: s.products_below_minimum_facings },
    { label: "Above max facings", value: s.products_above_maximum_facings },
    { label: "Below exp units", value: s.products_below_expected_units },
  ];

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

  const comparison = planogramComparisonFromResult(data, null);
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
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#667085]">Expected</p>
            <p className="font-medium leading-snug text-[#102A43]">{productLabel(r)}</p>
            {aiLabel ? (
              <>
                <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-[#667085]">
                  Actual by AI
                </p>
                <p className="leading-snug text-[#102A43]">{aiLabel}</p>
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
    { key: "exp_f", header: "Expected", cell: (r: AstraPlanogramProduct) => r.expected_facings },
    {
      key: "act_f",
      header: "Total Facings",
      cell: (r: AstraPlanogramProduct) => countCell(r.actual_facings),
    },
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
    {
      key: "act_u",
      header: "Fully visible",
      cell: (r: AstraPlanogramProduct) => countCell(r.actual_visible_units),
    },
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
        modeLabel="Planogram comparison"
        operatingModel={ctx.extras.operating_model_label ?? ctx.extras.operating_model}
      />
      <AiExecutiveSummary text={data.executive_summary} scanId={data.scan_id} />
      <AiImageQualityBanner extras={ctx.extras} />

      {countPending ? (
        <div
          className="rounded-2xl border border-[#D9E2E8] bg-[#FFEAF1] px-4 py-3 text-sm text-[#102A43]"
          role="status"
        >
          <p className="font-semibold tracking-wide">COUNT VERIFICATION PENDING</p>
          <p className="mt-1 text-[#667085]">
            Visual counts need review. Aggregate compliance is not shown as valid — product rows
            remain available below.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[auto,1fr]">
        <AiAuditCard
          title="Planogram compliance"
          description="How closely the shelf matches the plan"
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
              <p className="text-sm font-semibold text-[#102A43]">COUNT VERIFICATION PENDING</p>
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
          description="What was found versus the plan"
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

      {risk ? (
        <AiAuditCard
          title="Execution risk"
          description="Rule-based severity from Aislix calc"
          csvDownload={{
            onDownload: () =>
              downloadSectionCsv(
                data.scan_id,
                "execution-risk",
                ["Severity", "Rules triggered", "High-priority risks", "Rule"],
                risk.rules_triggered.length
                  ? risk.rules_triggered.map((rule) => [
                      risk.severity,
                      risk.rules_triggered.length,
                      s.high_priority_execution_risks,
                      String(rule.description ?? rule.rule_id ?? ""),
                    ])
                  : [[risk.severity, 0, s.high_priority_execution_risks, "None"]],
              ),
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AiMetricStat label="Severity" value={risk.severity || "NONE"} bg={KPI_CARD.criticalFindings} />
            <AiMetricStat label="Rules triggered" value={risk.rules_triggered.length} bg={KPI_CARD.openFindings} />
            <AiMetricStat
              label="High-priority risks"
              value={s.high_priority_execution_risks}
              bg={KPI_CARD.overdueActions}
            />
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
        <AiAuditCard
          title="Largest facing variance"
          description="Top rows by absolute facing delta"
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
          <AiVarianceBars items={topVariance} unit=" total facings" accent={CHART_ACCENT.actualFacings} />
        </AiAuditCard>
        <AiAuditCard
          title="Largest unit variance"
          description="Top rows by absolute unit delta"
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
          <AiVarianceBars items={topUnitVariance} unit=" fully visible facings" accent={CHART_ACCENT.actualUnits} />
        </AiAuditCard>
      </div>

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

      {analysis.brand_analysis.length ? (
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
            description="All brand_analysis fields"
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
          description="Category facings, share, and compliance"
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
              { key: "ef", header: "Exp facings", cell: (r) => r.expected_facings },
              { key: "af", header: "Total Facings", cell: (r) => countCell(r.actual_facings) },
              { key: "es", header: "Exp share %", cell: (r) => pctCell(r.expected_share_percent) },
              { key: "as", header: "Act share %", cell: (r) => pctCell(r.actual_share_percent) },
              { key: "cp", header: "Compliance %", cell: (r) => pctCell(r.compliance_percent) },
              { key: "st", header: "Status", cell: (r) => statusBadge(r.status) },
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
              { key: "ef", header: "Exp facings", cell: (r) => r.expected_facings },
              { key: "af", header: "Total Facings", cell: (r) => countCell(r.actual_facings) },
              { key: "cp", header: "Compliance %", cell: (r) => pctCell(r.compliance_percent) },
              { key: "st", header: "Status", cell: (r) => statusBadge(r.status) },
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
        description="Planogram expected vs shelf actuals — AI names shown as Actual by AI"
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
                "Fully visible facings",
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
          title="Unplanned products on shelf"
          description="Products not in the planogram"
          csvDownload={{
            onDownload: () =>
              downloadSectionCsv(
                data.scan_id,
                "unplanned-products",
                ["Brand", "Product", "Variant", "Total Facings", "Fully visible facings", "Confidence"],
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
              { key: "u", header: "Fully visible facings", cell: (r) => r.actual_visible_units },
              { key: "c", header: "Confidence", cell: (r) => confCell(r.confidence) },
            ]}
          />
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
