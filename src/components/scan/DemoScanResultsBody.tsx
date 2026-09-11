/**
 * Scan results sections — shared layout for demo and dashboard.
 */

import { Fragment, useMemo } from "react";
import {
  AlertsPanel,
  AnnotatedImageViewer,
  ComplianceAlertCard,
  InventoryTable,
} from "@/components/scan-results/ResultParts";
import {
  ActionCenterPanel,
  AiSummaryBlock,
  CompetitorIntelPanel,
  ExecutionImprovementBanner,
  AuditRoleIntroPanel,
  ExecutionKpiStripPanel,
  ExecutionScoreHero,
  FacingsSummaryStrip,
  FinancialImpactPanel,
  RecommendedActionsPanel,
  ResultViewSwitcher,
  ScanDetailsAccordion,
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
import type { ScanResult } from "@/lib/scan-results";
import { downloadBlob } from "@/lib/scan-results";
import { executionScore } from "@/lib/scan-execution";
import { cn } from "@/lib/utils";
import {
  AssortmentPanel,
  FixRescanCtaPanel,
  HistoricalIntelligencePanel,
  ImageQualityPanel,
  OpportunityLedgerPanel,
  PresentabilityPanel,
  VerifiedExecutionPanel,
} from "@/components/scan-results/RetailIntelligencePanels";
import {
  AuditScopePanel,
  MultiPhotoSummaryPanel,
  PricingCompliancePanel,
} from "@/components/scan-results/P2ExecutionPanels";
import {
  PlanogramComparisonSection,
  PlanogramMissingAlert,
} from "@/components/scan-results/PlanogramCompliance";
import { NeedsReviewSection } from "@/components/scan-results/NeedsReview";
import { BboxAnnotationEditor } from "@/components/scan-results/BboxAnnotationEditor";
import { PlanogramSideBySidePanel } from "@/components/scan-results/PlanogramSideBySidePanel";
import { UnifiedExceptionsPanel } from "@/components/scan-results/UnifiedExceptionsPanel";
import { DownloadsPanel } from "@/components/scan-results/DownloadsPanel";
import { SharePanel } from "@/components/scan-results/ResultHeader";
import {
  CategoryDistributionChart,
  ConfidenceDistributionChart,
  LowStockSummaryChart,
  QuantityDistributionChart,
  ShelfHealthChart,
  TopBrandsChart,
} from "@/components/scan-results/ResultCharts";
import { planogramComparisonFromResult } from "@/lib/planogram-display";
import { summaryCounts } from "@/lib/planogram-compliance";

/** Demo + dashboard parity — footer handles download/share; no duplicate in-scroll blocks. */
export const PARITY_LAYOUT_SKIP = new Set<ResultSectionKey>([
  "improvement_banner",
  "review_queue",
  "share",
  "scan_details",
  "downloads",
  "analytics",
  "historical_intel",
]);

export type ScanResultsBodyProps = {
  data: ScanResult;
  view: ResultViewMode;
  onViewChange: (mode: ResultViewMode) => void;
  loading?: boolean;
  compact?: boolean;
  /** Guest demo inline — slightly narrower; fullscreen uses dashboard parity. */
  guestInline?: boolean;
  imageUrl?: string | null;
  planogramComparison?: import("@/lib/planogram-compliance").PlanogramComparison | null;
  financialLocked?: boolean;
  planCode?: string;
  demoMode?: boolean;
  previousScore?: number;
  roleFamily?: import("@/lib/customer-context").RoleFamily;
  customerType?: import("@/lib/customer-context").CustomerType;
  competitorEnabled?: boolean;
  /** Hide legacy in-scroll download/share blocks — use ScanResultsActionsFooter instead. */
  parityLayout?: boolean;
  /** Unfiltered API payload for review queue, alerts, and exports. */
  rawData?: ScanResult;
  onCorrected?: () => void;
};

export function ScanResultsBody({
  data,
  view,
  onViewChange,
  loading = false,
  compact = false,
  guestInline = false,
  imageUrl,
  planogramComparison,
  financialLocked = false,
  planCode = "growth",
  demoMode = false,
  previousScore,
  roleFamily,
  customerType,
  competitorEnabled = true,
  parityLayout = true,
  rawData,
  onCorrected,
}: ScanResultsBodyProps) {
  const theme = VIEW_MODE_THEME[view];
  const skip = parityLayout ? PARITY_LAYOUT_SKIP : new Set<ResultSectionKey>();
  const sectionOrder = orderedVisibleSections(
    view,
    parityLayout ? undefined : roleFamily,
    parityLayout ? undefined : customerType,
  ).filter((key) => !skip.has(key));
  const source = rawData ?? data;

  const comparison = useMemo(
    () => planogramComparisonFromResult(data, planogramComparison),
    [data, planogramComparison],
  );
  const planogramCounts = summaryCounts(comparison?.summary ?? {});
  const showPlanogramWarning =
    Boolean(data.planogram?.requested) &&
    (!comparison || (planogramCounts.expected === 0 && !comparison.lines.length));

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
        <ResultViewSwitcher
          value={view}
          onChange={onViewChange}
          roleFamily={parityLayout ? undefined : roleFamily}
          customerType={parityLayout ? undefined : customerType}
        />
      </div>

      <div className={cn("space-y-3", compact ? "" : "space-y-4")}>
        {sectionOrder.map((key) => {
          switch (key) {
            case "improvement_banner":
              return (
                <ExecutionImprovementBanner
                  key={key}
                  current={executionScore(source)}
                  previous={source.navigation?.previous_execution_score ?? previousScore}
                  loading={loading}
                />
              );
            case "score_hero":
              return (
                <div
                  key={key}
                  className={cn(
                    "overflow-hidden rounded-2xl border-2 bg-gradient-to-br from-background to-muted/30 shadow-sm",
                    theme.accentBorder,
                  )}
                >
                  <ExecutionScoreHero
                    data={data}
                    loading={loading}
                    previousScore={previousScore ?? source.navigation?.previous_execution_score ?? undefined}
                  />
                </div>
              );
            case "kpi_strip":
              return (
                <div key={key} className="space-y-3">
                  <AuditRoleIntroPanel data={data} loading={loading} />
                  <ExecutionKpiStripPanel
                    data={data}
                    loading={loading}
                    compact={compact}
                    view={view}
                    customerType={customerType}
                  />
                </div>
              );
            case "facings_strip":
              return <FacingsSummaryStrip key={key} data={data} loading={loading} />;
            case "action_center":
              return (
                <ActionCenterPanel
                  key={key}
                  data={data}
                  loading={loading}
                  view={view}
                  demoMode={demoMode}
                />
              );
            case "financial_impact":
              return (
                <FinancialImpactPanel
                  key={key}
                  data={data}
                  loading={loading}
                  locked={financialLocked}
                  planCode={planCode}
                />
              );
            case "placement_alert":
              return (source.compliance_alerts?.length ?? 0) > 0 ? (
                <ComplianceAlertCard
                  key={key}
                  alerts={source.compliance_alerts}
                  mismatches={source.subcategory_mismatches}
                />
              ) : null;
            case "ai_summary":
              return <AiSummaryBlock key={key} data={data} loading={loading} view={view} />;
            case "competitor_intel":
              return competitorEnabled ? (
                <CompetitorIntelPanel key={key} snapshot={data.competitor_intel} loading={loading} />
              ) : null;
            case "share_of_shelf":
              return <ShareOfShelfPanel key={key} data={data} loading={loading} />;
            case "sku_availability":
              return (
                <SkuAvailabilityPanel
                  key={key}
                  data={data}
                  loading={loading}
                  matched={planogramCounts.found}
                  expected={planogramCounts.expected}
                />
              );
            case "recommended_actions":
              return <RecommendedActionsPanel key={key} data={data} loading={loading} />;
            case "planogram":
              return (
                <Fragment key={key}>
                  {comparison ? <PlanogramComparisonSection comparison={comparison} /> : null}
                  {showPlanogramWarning ? <PlanogramMissingAlert demoMode={demoMode} /> : null}
                </Fragment>
              );
            case "planogram_side_by_side":
              return (
                <PlanogramSideBySidePanel
                  key={key}
                  data={data}
                  comparison={comparison}
                  imageUrl={imageUrl}
                  loading={loading}
                />
              );
            case "unified_exceptions":
              return (
                <UnifiedExceptionsPanel
                  key={key}
                  data={source}
                  comparison={comparison}
                  view={view}
                  loading={loading}
                />
              );
            case "bbox_annotation":
              return onCorrected ? (
                <BboxAnnotationEditor
                  key={key}
                  data={source}
                  imageUrl={imageUrl}
                  onCorrected={onCorrected}
                />
              ) : null;
            case "review_queue":
              return onCorrected ? (
                <NeedsReviewSection key={key} data={source} onCorrected={onCorrected} />
              ) : null;
            case "annotated_image":
              return (
                <AnnotatedImageViewer
                  key={key}
                  src={imageUrl ?? data.annotated_image_url}
                  originalSrc={data.original_image_url}
                  scanId={data.scan_id}
                  loading={loading}
                />
              );
            case "inventory":
              return (
                <InventoryTable
                  key={key}
                  items={data.inventory?.length ? data.inventory : (rawData?.inventory ?? [])}
                  scanId={data.scan_id}
                  csvUrl={rawData?.downloads?.csv_url ?? data.downloads?.csv_url}
                  loading={loading}
                />
              );
            case "analytics":
              return (
                <details key={key} className="card-surface p-5 sm:p-6">
                  <summary className="cursor-pointer text-sm font-semibold tracking-tight">
                    Analytics
                  </summary>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Brand share, confidence distribution, and legacy shelf health charts.
                  </p>
                  <div className="mt-4 grid gap-4 xl:grid-cols-3">
                    <TopBrandsChart data={data.charts?.top_brands} loading={loading} />
                    <QuantityDistributionChart
                      data={source.charts?.quantity_distribution}
                      loading={loading}
                    />
                    <ConfidenceDistributionChart
                      data={source.charts?.confidence_distribution}
                      loading={loading}
                    />
                    <ShelfHealthChart score={source.summary?.shelf_health_score} loading={loading} />
                    <LowStockSummaryChart data={source.charts?.low_stock_summary} loading={loading} />
                    <CategoryDistributionChart
                      data={source.charts?.category_distribution}
                      loading={loading}
                    />
                  </div>
                </details>
              );
            case "alerts":
              return <AlertsPanel key={key} alerts={source.alerts} loading={loading} />;
            case "downloads":
              return <DownloadsPanel key={key} data={data} loading={loading} />;
            case "share":
              return <SharePanel key={key} data={source} loading={loading} />;
            case "scan_details":
              return (
                <ScanDetailsAccordion
                  key={key}
                  data={source}
                  loading={loading}
                  onExportJson={
                    source
                      ? () =>
                          downloadBlob(
                            JSON.stringify(source, null, 2),
                            `aislix-${source.scan_id}-result.json`,
                            "application/json",
                          )
                      : undefined
                  }
                />
              );
            case "image_quality":
              return <ImageQualityPanel key={key} data={data} loading={loading} />;
            case "multi_photo":
              return <MultiPhotoSummaryPanel key={key} data={data} loading={loading} />;
            case "audit_scope":
              return <AuditScopePanel key={key} data={data} loading={loading} />;
            case "pricing_compliance":
              return <PricingCompliancePanel key={key} data={data} loading={loading} />;
            case "assortment":
              return <AssortmentPanel key={key} data={data} loading={loading} />;
            case "opportunity_ledger":
              return <OpportunityLedgerPanel key={key} data={data} loading={loading} />;
            case "verified_execution":
              return <VerifiedExecutionPanel key={key} data={data} loading={loading} />;
            case "historical_intel":
              return <HistoricalIntelligencePanel key={key} data={data} loading={loading} />;
            case "presentability":
              return <PresentabilityPanel key={key} data={data} loading={loading} />;
            case "fix_rescan_cta":
              return <FixRescanCtaPanel key={key} scanId={data.scan_id} data={data} />;
            default:
              return null;
          }
        })}
      </div>
    </>
  );
}

/** @deprecated Use ScanResultsBody — kept for imports. */
export const DemoScanResultsBody = ScanResultsBody;
