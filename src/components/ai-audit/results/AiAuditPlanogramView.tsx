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
import { metricDisplayValue, metricStatusLabel } from "@/lib/ai-audit/metric-results";
import { planogramComparisonFromResult } from "@/lib/planogram-display";
import type { ScanResult } from "@/lib/scan-results";

type Props = {
  data: ScanResult;
  ctx: AiAuditDisplayContext;
  imageUrl?: string | null;
};

function productLabel(row: AstraPlanogramProduct) {
  return `${row.brand} · ${row.product_name}${row.variant ? ` · ${row.variant}` : ""}`;
}

export function AiAuditPlanogramView({ data, ctx, imageUrl }: Props) {
  if (ctx.analysis.mode !== "planogram") return null;
  const analysis = ctx.analysis;
  const s = analysis.summary;
  const calc = ctx.calculatedMetrics;
  const planoMetric = calc.planogram_compliance;
  const facingMetric = calc.overall_facing_compliance;
  const compliance = Math.round(
    (typeof planoMetric?.value === "number" ? planoMetric.value : null) ??
      ctx.compliancePercent ??
      s.overall_planogram_compliance_percent ??
      0,
  );
  const risk = ctx.executionRisk;
  const riskCount =
    risk?.rules_triggered.length ??
    s.high_priority_execution_risks ??
    0;

  const statusCounts: Record<string, number> = {};
  for (const row of analysis.products) {
    const key = row.overall_status || "UNKNOWN";
    statusCounts[key] = (statusCounts[key] ?? 0) + 1;
  }
  const donutSlices = statusDonutSlices(statusCounts);

  const funnelTiles = [
    { label: "Matched", value: String(s.products_matched), tone: "healthy" as const },
    { label: "Not found", value: String(s.products_not_found), tone: "attention" as const },
    { label: "Non-compliant", value: String(s.non_compliant_products), tone: "attention" as const },
    { label: "Unverifiable", value: String(s.products_not_verifiable), tone: "neutral" as const },
    { label: "Wrong placement", value: String(s.wrong_placements), tone: "attention" as const },
    { label: "Price mismatches", value: String(s.price_mismatches), tone: "attention" as const },
    { label: "Exec. risks", value: String(riskCount), tone: "attention" as const },
    { label: "Value gap ₹", value: String(s.total_potential_visible_unit_value_gap_inr), tone: "active" as const },
  ];

  const topVariance = [...analysis.products]
    .sort((a, b) => Math.abs(b.facing_variance) - Math.abs(a.facing_variance))
    .slice(0, 8)
    .map((row) => ({ label: productLabel(row), variance: row.facing_variance }));

  const topUnitVariance = [...analysis.products]
    .sort((a, b) => Math.abs(b.shelf_unit_variance) - Math.abs(a.shelf_unit_variance))
    .slice(0, 8)
    .map((row) => ({ label: productLabel(row), variance: row.shelf_unit_variance }));

  const facingCompare = [...analysis.products]
    .sort((a, b) => Math.abs(b.facing_variance) - Math.abs(a.facing_variance))
    .slice(0, 6)
    .map((row) => ({
      label: productLabel(row),
      expected: row.expected_facings,
      actual: row.actual_facings,
    }));

  const comparison = planogramComparisonFromResult(data, null);

  const productColumns = [
    { key: "product", header: "Product", cell: (r: AstraPlanogramProduct) => (
      <div>
        <p className="font-medium">{productLabel(r)}</p>
        <p className="text-muted-foreground">{r.location}{r.category ? ` · ${r.category}` : ""}{r.subcategory ? ` · ${r.subcategory}` : ""}</p>
        <p className="text-muted-foreground">SKU: {r.sku || "—"}</p>
      </div>
    )},
    { key: "brand", header: "Brand", cell: (r: AstraPlanogramProduct) => statusBadge(r.brand_status) },
    { key: "product_st", header: "Product", cell: (r: AstraPlanogramProduct) => statusBadge(r.product_status) },
    { key: "variant", header: "Variant", cell: (r: AstraPlanogramProduct) => statusBadge(r.variant_status) },
    { key: "sku_st", header: "SKU", cell: (r: AstraPlanogramProduct) => statusBadge(r.sku_status) },
    { key: "exp_f", header: "Exp facings", cell: (r: AstraPlanogramProduct) => r.expected_facings },
    { key: "act_f", header: "Act facings", cell: (r: AstraPlanogramProduct) => r.actual_facings },
    { key: "f_var", header: "Facing Δ", cell: (r: AstraPlanogramProduct) => r.facing_variance },
    { key: "f_pct", header: "Facing %", cell: (r: AstraPlanogramProduct) => pctCell(r.facing_compliance_percent) },
    { key: "f_rng", header: "Facing range", cell: (r: AstraPlanogramProduct) => statusBadge(r.facing_range_status) },
    { key: "exp_u", header: "Exp units", cell: (r: AstraPlanogramProduct) => r.expected_shelf_units },
    { key: "act_u", header: "Act units", cell: (r: AstraPlanogramProduct) => r.actual_visible_units },
    { key: "u_var", header: "Unit Δ", cell: (r: AstraPlanogramProduct) => r.shelf_unit_variance },
    { key: "u_pct", header: "Unit %", cell: (r: AstraPlanogramProduct) => pctCell(r.shelf_unit_compliance_percent) },
    { key: "exp_pos", header: "Exp position", cell: (r: AstraPlanogramProduct) => r.expected_shelf_position || "—" },
    { key: "act_pos", header: "Act position", cell: (r: AstraPlanogramProduct) => r.actual_shelf_position || "—" },
    { key: "place", header: "Placement", cell: (r: AstraPlanogramProduct) => statusBadge(r.placement_status) },
    { key: "mrp", header: "Exp MRP", cell: (r: AstraPlanogramProduct) => r.expected_mrp_inr ? `₹${r.expected_mrp_inr}` : "—" },
    { key: "vis_p", header: "Visible price", cell: (r: AstraPlanogramProduct) => r.visible_price ?? "—" },
    { key: "price", header: "Price", cell: (r: AstraPlanogramProduct) => statusBadge(r.price_status) },
    { key: "ads", header: "Avg daily sales", cell: (r: AstraPlanogramProduct) => r.avg_daily_sales || "—" },
    { key: "cov", header: "Coverage days", cell: (r: AstraPlanogramProduct) => r.estimated_visible_shelf_coverage_days ?? "—" },
    { key: "short", header: "Unit shortfall", cell: (r: AstraPlanogramProduct) => r.visible_unit_shortfall },
    { key: "gap", header: "Value gap ₹", cell: (r: AstraPlanogramProduct) => r.potential_visible_unit_value_gap_inr },
    { key: "risk", header: "Risk", cell: (r: AstraPlanogramProduct) => statusBadge(r.risk_status) },
    { key: "overall", header: "Overall", cell: (r: AstraPlanogramProduct) => statusBadge(r.overall_status) },
    { key: "conf", header: "Conf.", cell: (r: AstraPlanogramProduct) => confCell(r.confidence) },
    { key: "ev", header: "Evidence", cell: (r: AstraPlanogramProduct) => <span className="text-muted-foreground">{r.evidence_note || "—"}</span> },
  ];

  return (
    <div className="space-y-4">
      <AiResultsHero
        scanId={data.scan_id}
        modeLabel="Planogram comparison"
        operatingModel={ctx.extras.operating_model_label ?? ctx.extras.operating_model}
        timestamp={data.created_at}
      />
      <AiExecutiveSummary text={data.executive_summary} />
      <AiImageQualityBanner extras={ctx.extras} />

      <div className="grid gap-4 lg:grid-cols-[auto,1fr]">
        <AiAuditCard title="Planogram compliance" description="Check-based Aislix MetricResult">
          <MpRadialGauge
            value={compliance}
            label="Compliant"
            sublabel={`${analysis.products.length} rows · ${metricStatusLabel(planoMetric?.status) ?? "Calculated"}`}
            color="#86EFAC"
          />
        </AiAuditCard>
        <AiAuditCard title="Summary KPIs" description="Astra row funnel + Aislix calculated metrics">
          <MpTileGrid tiles={funnelTiles} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AiMetricStat label="Total rows" value={s.total_planogram_rows || analysis.products.length} />
            <AiMetricStat
              label="Planogram compliance"
              value={metricDisplayValue(planoMetric, pctCell(s.overall_planogram_compliance_percent))}
              status={metricStatusLabel(planoMetric?.status)}
            />
            <AiMetricStat
              label="Facing compliance"
              value={metricDisplayValue(facingMetric, pctCell(s.overall_facing_compliance_percent))}
              status={metricStatusLabel(facingMetric?.status)}
            />
            <AiMetricStat label="Unit compliance" value={pctCell(s.overall_shelf_unit_compliance_percent)} />
            <AiMetricStat
              label="Products identified"
              value={metricDisplayValue(calc.products_identified, analysis.products.length)}
              status={metricStatusLabel(calc.products_identified?.status)}
            />
            <AiMetricStat
              label="Brands identified"
              value={metricDisplayValue(calc.brands_identified, analysis.brand_analysis.length)}
              status={metricStatusLabel(calc.brands_identified?.status)}
            />
            <AiMetricStat
              label="Actual facings"
              value={metricDisplayValue(calc.total_actual_facings, s.total_actual_facings)}
              status={metricStatusLabel(calc.total_actual_facings?.status)}
              sub={`Expected ${s.total_expected_facings}`}
            />
            <AiMetricStat
              label="Actual units"
              value={metricDisplayValue(calc.total_actual_visible_units, s.total_actual_visible_units)}
              status={metricStatusLabel(calc.total_actual_visible_units?.status)}
              sub={`Expected ${s.total_expected_shelf_units}`}
            />
            <AiMetricStat label="Below exp facings" value={s.products_below_expected_facings} />
            <AiMetricStat label="Below min facings" value={s.products_below_minimum_facings} />
            <AiMetricStat label="Above max facings" value={s.products_above_maximum_facings} />
            <AiMetricStat label="Below exp units" value={s.products_below_expected_units} />
          </div>
        </AiAuditCard>
      </div>

      {risk ? (
        <AiAuditCard title="Execution risk" description="Rule-based severity from Aislix calc">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AiMetricStat label="Severity" value={risk.severity || "NONE"} />
            <AiMetricStat label="Rules triggered" value={risk.rules_triggered.length} />
            <AiMetricStat label="High-priority risks" value={s.high_priority_execution_risks} />
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
          <AiAuditCard title="Status mix" description="Overall row status distribution">
            <MpDonut slices={donutSlices} total={analysis.products.length} totalLabel="Rows" />
          </AiAuditCard>
        ) : null}
        <AiAuditCard title="Largest facing variance" description="Top rows by absolute facing delta" className="xl:col-span-1">
          <AiVarianceBars items={topVariance} unit=" facings" />
        </AiAuditCard>
        <AiAuditCard title="Largest unit variance" description="Top rows by absolute unit delta">
          <AiVarianceBars items={topUnitVariance} unit=" units" />
        </AiAuditCard>
      </div>

      <AiAuditCard title="Expected vs actual facings" description="Side-by-side comparison for top variance SKUs">
        <AiGroupedComparisonBars items={facingCompare} unit="" />
      </AiAuditCard>

      {analysis.brand_analysis.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <AiAuditCard title="Brand share vs plan" description="Expected vs actual brand facing share">
            <AiShareComparisonBars
              items={analysis.brand_analysis.map((b) => ({
                label: b.brand,
                expected: b.expected_share_percent,
                actual: b.actual_share_percent,
                variancePp: b.share_variance_pp,
              }))}
            />
          </AiAuditCard>
          <AiAuditCard title="Brand analysis table" description="All brand_analysis fields">
            <AiAuditMetricTable
              rows={analysis.brand_analysis}
              rowKey={(r) => r.brand}
              columns={[
                { key: "b", header: "Brand", cell: (r: AstraPlanogramBrandAnalysis) => r.brand },
                { key: "ef", header: "Exp facings", cell: (r) => r.expected_facings },
                { key: "af", header: "Act facings", cell: (r) => r.actual_facings },
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
        <AiAuditCard title="Category analysis" description="Category facings, share, and compliance">
          <AiAuditMetricTable
            rows={analysis.category_analysis}
            rowKey={(r) => r.category}
            columns={[
              { key: "c", header: "Category", cell: (r: AstraPlanogramCategoryAnalysis) => r.category },
              { key: "ef", header: "Exp facings", cell: (r) => r.expected_facings },
              { key: "af", header: "Act facings", cell: (r) => r.actual_facings },
              { key: "es", header: "Exp share %", cell: (r) => pctCell(r.expected_share_percent) },
              { key: "as", header: "Act share %", cell: (r) => pctCell(r.actual_share_percent) },
              { key: "cp", header: "Compliance %", cell: (r) => pctCell(r.compliance_percent) },
              { key: "st", header: "Status", cell: (r) => statusBadge(r.status) },
            ]}
          />
        </AiAuditCard>
      ) : null}

      {analysis.subcategory_analysis.length ? (
        <AiAuditCard title="Subcategory analysis" description="Subcategory facings and compliance">
          <AiAuditMetricTable
            rows={analysis.subcategory_analysis}
            rowKey={(r) => r.subcategory}
            columns={[
              { key: "sc", header: "Subcategory", cell: (r: AstraPlanogramSubcategoryAnalysis) => r.subcategory },
              { key: "ef", header: "Exp facings", cell: (r) => r.expected_facings },
              { key: "af", header: "Act facings", cell: (r) => r.actual_facings },
              { key: "cp", header: "Compliance %", cell: (r) => pctCell(r.compliance_percent) },
              { key: "st", header: "Status", cell: (r) => statusBadge(r.status) },
            ]}
          />
        </AiAuditCard>
      ) : null}

      <AiAuditCard title="Product comparison" description="Every planogram row metric from Astra">
        <AiAuditMetricTable
          columns={productColumns}
          rows={analysis.products}
          rowKey={(r) => `${r.sku}-${r.brand}-${r.variant}`}
        />
      </AiAuditCard>

      {analysis.observed_unplanned_products.length ? (
        <AiAuditCard title="Unplanned products on shelf" description="Products not in the planogram">
          <AiAuditMetricTable
            rows={analysis.observed_unplanned_products}
            rowKey={(r, i) => `${r.brand}-${i}`}
            columns={[
              { key: "b", header: "Brand", cell: (r: AstraUnplannedProduct) => r.brand },
              { key: "p", header: "Product", cell: (r) => r.product_name },
              { key: "v", header: "Variant", cell: (r) => r.variant || "—" },
              { key: "f", header: "Facings", cell: (r) => r.actual_facings },
              { key: "u", header: "Units", cell: (r) => r.actual_visible_units },
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
