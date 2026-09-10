/**
 * Shared scan results section loop for demo inline panel and guest fullscreen.
 */

import { AnnotatedImageViewer, ComplianceAlertCard, InventoryTable } from "@/components/scan-results/ResultParts";
import {
  ActionCenterPanel,
  AiSummaryBlock,
  CompetitorIntelPanel,
  ExecutionKpiStripPanel,
  ExecutionScoreHero,
  FacingsSummaryStrip,
  FinancialImpactPanel,
  RecommendedActionsPanel,
  ResultViewSwitcher,
  ShareOfShelfPanel,
  SkuAvailabilityPanel,
} from "@/components/scan-results/ExecutionPhase1";
import {
  orderedVisibleSections,
  VIEW_MODE_DESCRIPTIONS,
  VIEW_MODE_THEME,
  type ResultSectionKey,
  type ResultViewMode,
} from "@/lib/customer-context";
import { PlanogramComparisonSection } from "@/components/scan-results/PlanogramCompliance";
import type { ScanResult } from "@/lib/scan-results";
import { buildDemoPlanogramComparison } from "@/lib/scan-context";
import { cn } from "@/lib/utils";
import { displayVariant } from "@/lib/landing-inventory";
import type { LandingScanResult } from "@/lib/landing-scan-api";
import type { PlanogramMatchLine } from "@/lib/demo-planogram-match";

const INLINE_SKIP_SECTIONS = new Set<ResultSectionKey>([
  "annotated_image",
  "improvement_banner",
  "review_queue",
  "share",
  "scan_details",
  "downloads",
  "analytics",
  "competitor_intel",
]);

const DASHBOARD_SKIP_SECTIONS = new Set<ResultSectionKey>([
  "improvement_banner",
  "review_queue",
  "share",
  "scan_details",
  "downloads",
  "analytics",
]);

type DemoScanResultsBodyProps = {
  data: ScanResult;
  view: ResultViewMode;
  onViewChange: (mode: ResultViewMode) => void;
  compact?: boolean;
  layout?: "inline" | "dashboard";
  imageUrl?: string | null;
  landingInventory?: LandingScanResult["inventory"];
  showPlanogramStub?: boolean;
};

export function DemoScanResultsBody({
  data,
  view,
  onViewChange,
  compact = false,
  layout = "inline",
  imageUrl,
  landingInventory,
  showPlanogramStub = false,
}: DemoScanResultsBodyProps) {
  const theme = VIEW_MODE_THEME[view];
  const skip = layout === "dashboard" ? DASHBOARD_SKIP_SECTIONS : INLINE_SKIP_SECTIONS;
  const sectionOrder = orderedVisibleSections(view).filter((key) => !skip.has(key));

  return (
    <>
      <div
        className={cn(
          "shrink-0 border-b pb-3",
          theme.accentBorder,
          compact ? "mb-3 space-y-2" : "mb-4 space-y-3 pb-4",
        )}
      >
        <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
          {VIEW_MODE_DESCRIPTIONS[view]}
        </p>
        <ResultViewSwitcher value={view} onChange={onViewChange} />
      </div>

      <div className={cn("space-y-3", compact ? "" : "space-y-4")}>
        {sectionOrder.map((key) => {
          switch (key) {
            case "score_hero":
              return (
                <div key={key} className={cn("rounded-xl ring-1", theme.accentBorder, theme.ring)}>
                  <ExecutionScoreHero data={data} />
                </div>
              );
            case "kpi_strip":
              return <ExecutionKpiStripPanel key={key} data={data} compact={compact} />;
            case "facings_strip":
              return <FacingsSummaryStrip key={key} data={data} />;
            case "action_center":
              return <ActionCenterPanel key={key} data={data} />;
            case "financial_impact":
              return (
                <FinancialImpactPanel key={key} data={data} locked={false} planCode="growth" />
              );
            case "placement_alert":
              return (data.compliance_alerts?.length ?? 0) > 0 ? (
                <ComplianceAlertCard
                  key={key}
                  alerts={data.compliance_alerts}
                  mismatches={data.subcategory_mismatches}
                />
              ) : null;
            case "ai_summary":
              return <AiSummaryBlock key={key} data={data} view={view} />;
            case "competitor_intel":
              return data.competitor_intel ? (
                <CompetitorIntelPanel key={key} snapshot={data.competitor_intel} />
              ) : null;
            case "share_of_shelf":
              return <ShareOfShelfPanel key={key} data={data} />;
            case "sku_availability":
              return <SkuAvailabilityPanel key={key} data={data} />;
            case "recommended_actions":
              return <RecommendedActionsPanel key={key} data={data} />;
            case "annotated_image":
              return imageUrl ? (
                <AnnotatedImageViewer key={key} src={imageUrl} alt="Analyzed shelf photo" />
              ) : null;
            case "planogram":
              return showPlanogramStub || data.planogram?.requested ? (
                <PlanogramComplianceCard key={key} data={data} />
              ) : null;
            case "inventory":
              return layout === "dashboard" && data.inventory?.length ? (
                <InventoryTable key={key} items={data.inventory} />
              ) : landingInventory ? (
                <DemoInventoryCompact key={key} rows={landingInventory} />
              ) : null;
            default:
              return null;
          }
        })}
      </div>
    </>
  );
}

function PlanogramComplianceCard({ data }: { data: ScanResult }) {
  const pg = data.planogram;
  if (!pg?.requested) return null;

  const rawLines = pg.summary?.lines;
  if (Array.isArray(rawLines) && rawLines.length > 0) {
    const matchLines = rawLines as Array<{
      brand: string;
      product: string;
      expected_qty: number;
      detected_qty: number;
      issue_type: PlanogramMatchLine["issue_type"];
      detail?: string;
    }>;
    const comparison = buildDemoPlanogramComparison(
      {
        sku_match_percent: pg.sku_match_percent ?? 0,
        qty_compliance_percent: pg.qty_compliance_percent ?? 0,
        missing_count: Number(pg.summary?.missing ?? 0),
        wrong_product_count: Number(pg.summary?.wrong_product ?? 0),
        qty_short_count: Number(pg.summary?.qty_short ?? 0),
        correct_count: Number(pg.summary?.correct ?? 0),
        lines: matchLines.map((l) => ({
          expected: {
            location: "",
            category: "",
            sub_category: "",
            brand: l.brand,
            product_name: l.product,
            variant: "",
            expected_qty: l.expected_qty,
            sku: "",
            shelf_position: "",
            match_key: `${l.brand}|${l.product}`,
          },
          detected_qty: l.detected_qty,
          expected_qty: l.expected_qty,
          issue_type: l.issue_type,
          present: l.issue_type !== "missing",
          qty_ok: l.issue_type === "correct",
          match_score: l.issue_type === "correct" ? 1 : 0,
          detail: l.detail,
        })),
      },
      data.scan_id,
    );
    return <PlanogramComparisonSection comparison={comparison} />;
  }

  if (pg.sku_match_percent != null) {
    return (
      <PlanogramComparisonSection
        comparison={{
          id: `${data.scan_id}-planogram`,
          compliance_percent: pg.sku_match_percent,
          created_at: data.created_at ?? new Date().toISOString(),
          summary: {
            expected: Number(pg.summary?.expected_sku_count ?? 0),
            missing: Number(pg.summary?.missing ?? 0),
            wrong_product: Number(pg.summary?.wrong_product ?? 0),
            qty_issues: Number(pg.summary?.qty_short ?? 0),
          },
          lines: [],
          actions: [],
        }}
      />
    );
  }

  return (
    <div className="card-surface p-4 text-sm">
      <h3 className="font-semibold tracking-tight">Planogram compliance</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Add a planogram in the setup panel to compare expected vs detected products.
      </p>
    </div>
  );
}

function DemoInventoryCompact({ rows }: { rows: LandingScanResult["inventory"] }) {
  return (
    <div className="card-surface overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">Complete inventory</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{rows.length} SKU groups detected</p>
      </div>
      <div className="max-h-48 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Brand</th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Qty</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`${row.brand}-${row.product_name}-${i}`} className="border-t border-border">
                <td className="px-3 py-2">{row.brand || "—"}</td>
                <td className="px-3 py-2">
                  {row.product_name || "—"}
                  {displayVariant(row) ? (
                    <span className="block text-xs text-muted-foreground">{displayVariant(row)}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 tabular-nums">{row.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
