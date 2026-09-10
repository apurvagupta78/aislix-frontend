import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { markScanNotificationsRead } from "@/lib/notifications";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  ScanLine,
} from "lucide-react";
import { fetchScanAssignmentId } from "@/lib/assignments";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import {
  AlertsPanel,
  AnnotatedImageViewer,
  ComplianceAlertCard,
  InventoryTable,
  ResultSection,
} from "@/components/scan-results/ResultParts";
import { FixRescanVerifyPanel } from "@/components/scan-results/FixRescanVerifyPanel";
import {
  ActionCenterPanel,
  AiSummaryBlock,
  CompetitorIntelPanel,
  ExecutionImprovementBanner,
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
import { planHasFeature } from "@/lib/plan-features";
import { fetchUsageSummary } from "@/lib/subscription-limits";
import { useWorkspaceContext } from "@/hooks/use-customer-context";
import {
  orderedVisibleSections,
  showCompetitorIntel,
  VIEW_MODE_DESCRIPTIONS,
  VIEW_MODE_THEME,
  type ResultViewMode,
} from "@/lib/customer-context";
import { ScanContextPanel } from "@/components/scan/ScanContextPanel";
import {
  applyScanContext,
  loadStoredScanContext,
  saveStoredScanContext,
  type ScanContextState,
} from "@/lib/scan-context";
import {
  PrintReportButton,
  ProcessingState,
  ResultNavigation,
  ScanResultHeader,
  SharePanel,
} from "@/components/scan-results/ResultHeader";
import {
  CategoryDistributionChart,
  ConfidenceDistributionChart,
  LowStockSummaryChart,
  QuantityDistributionChart,
  ShelfHealthChart,
  TopBrandsChart,
} from "@/components/scan-results/ResultCharts";
import { toast } from "sonner";
import {
  buildFullScanReportCsv,
  fetchScanResult,
  downloadBlob,
  downloadScanCsv,
  downloadScanPdf,
  downloadScanAnnotatedImage,
  type ScanResult,
} from "@/lib/scan-results";
import { executionScore } from "@/lib/scan-execution";
import { retryScanAnalysis } from "@/lib/scan-api";
import { GENERIC_EXPORT, networkErrorMessage, sanitizeUserMessage } from "@/lib/api-errors";
import {
  PlanogramComparisonSection,
  PlanogramMissingAlert,
} from "@/components/scan-results/PlanogramCompliance";
import { NeedsReviewSection } from "@/components/scan-results/NeedsReview";
import {
  fetchPlanogramComparison,
  summaryCounts,
  type PlanogramComparison,
} from "@/lib/planogram-compliance";

export const Route = createFileRoute("/results")({
  validateSearch: (search: Record<string, unknown>): { scan?: string } => {
    const scan = search["scan"];
    return typeof scan === "string" && scan.length > 0 ? { scan } : {};
  },
  head: () => ({
    meta: [
      { title: "Shelf Execution Report — Aislix" },
      {
        name: "description",
        content:
          "Shelf execution score, action center, share of shelf, planogram compliance and SKU availability for a single Aislix shelf audit.",
      },
      { property: "og:title", content: "Shelf execution report — Aislix" },
      {
        property: "og:description",
        content: "Execution-first shelf audit: score, KPIs, actions, inventory and planogram compliance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Results,
});

function Results() {
  const { scan } = Route.useSearch();
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ["scan-result", scan],
    queryFn: ({ signal }) => fetchScanResult(scan!, signal),
    enabled: !!scan,
    retry: 1,
    staleTime: 30_000,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === "processing" || status === "queued" ? 4000 : false;
    },
  });

  const scanStatus = query.data?.status;
  const comparisonQuery = useQuery({
    queryKey: ["planogram-comparison", scan],
    queryFn: () => fetchPlanogramComparison(scan!),
    enabled: Boolean(scan) && scanStatus === "completed",
    retry: false,
  });
  const comparison = comparisonQuery.data ?? null;

  const assignmentQuery = useQuery({
    queryKey: ["scan-assignment-id", scan],
    queryFn: () => fetchScanAssignmentId(scan!),
    enabled: Boolean(scan),
    retry: false,
  });
  const queryClient = useQueryClient();

  // Viewing a scan's results acknowledges its bell notifications.
  useEffect(() => {
    if (!scan) return;
    void markScanNotificationsRead(scan).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    });
  }, [scan, queryClient]);

  const data = query.data;
  const loading = !!scan && query.isPending;
  const processing = data?.status === "processing" || data?.status === "queued";
  const summary = data?.summary;
  const workspaceQuery = useWorkspaceContext();
  const usageQuery = useQuery({
    queryKey: ["org-usage"],
    queryFn: () => fetchUsageSummary(),
    retry: false,
    staleTime: 60_000,
  });
  const planCode = usageQuery.data?.plan_code ?? "free";
  const financialLocked =
    !usageQuery.data?.platform_bypass && !planHasFeature(planCode, "financial_impact");

  const [viewOverride, setViewOverride] = useState<ResultViewMode | undefined>();
  const [scanContext, setScanContext] = useState<ScanContextState>(() => loadStoredScanContext());
  const activeView = viewOverride ?? workspaceQuery.data?.viewMode ?? "execution";
  const viewTheme = VIEW_MODE_THEME[activeView];
  const contextualData = useMemo(
    () => (data ? applyScanContext(data, scanContext) : data),
    [data, scanContext],
  );
  const display = contextualData ?? data;
  const sectionOrder = orderedVisibleSections(
    activeView,
    workspaceQuery.data?.roleFamily,
  );
  const competitorEnabled =
    sectionOrder.includes("competitor_intel") &&
    showCompetitorIntel(
      workspaceQuery.data?.customerType ?? "supermarket",
      workspaceQuery.data?.roleFamily ?? "operations",
      workspaceQuery.data?.hasBrandConfig ?? false,
    );

  // Planogram compliance is shown for assigned scans AND ad-hoc "with planogram"
  // scans. When there is no comparison row we still render tiles from the
  // persisted metrics summary, and fall back to a warning when nothing exists.
  const planogram = data?.planogram;
  const planogramSummary = comparison?.summary ?? planogram?.summary ?? {};
  const hasSummaryCounts = Object.keys(planogramSummary).length > 0;
  // Headline = SKU presence match (all expected SKUs found = 100%). Quantity
  // accuracy is shown as subtext and detailed in the table below.
  const skuMatchPercent = planogram?.sku_match_percent ?? null;
  const qtyCompliancePercent = planogram?.qty_compliance_percent ?? null;
  const planogramPercent =
    skuMatchPercent ?? comparison?.compliance_percent ?? planogram?.percent ?? null;
  const planogramCounts = summaryCounts(planogramSummary as PlanogramComparison["summary"]);
  const expectedProducts = planogramCounts["expected"];
  const matchedProducts = planogramCounts["found"];
  const planogramSection: PlanogramComparison | null =
    comparison ??
    (planogram?.requested && (planogramPercent !== null || hasSummaryCounts)
      ? {
          id: `${data?.scan_id ?? "scan"}-planogram`,
          compliance_percent: planogramPercent,
          summary: planogramSummary as PlanogramComparison["summary"],
          created_at: data?.created_at ?? new Date().toISOString(),
          lines: [],
          actions: [],
        }
      : null);
  const showPlanogramWarning = Boolean(
    planogram?.requested &&
      (!planogramSection ||
        (expectedProducts === 0 && !planogramSection.lines.length)),
  );

  const goToScan = (id?: string | null) => {
    if (!id) return;
    navigate({ to: "/results", search: { scan: id } });
  };

  return (
    <AppShell
      title="Scan results"
      description={
        data
          ? [data.scan_id, data.store, data.aisle].filter(Boolean).join(" · ")
          : "AI breakdown of a single shelf scan."
      }
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="subtle"
            size="sm"
            className="rounded-xl"
            disabled={!data?.navigation?.previous_scan_id}
            onClick={() => goToScan(data?.navigation?.previous_scan_id)}
          >
            <ArrowLeft className="size-4" /> Previous
          </Button>
          <Button
            variant="subtle"
            size="sm"
            className="rounded-xl"
            disabled={!data?.navigation?.next_scan_id}
            onClick={() => goToScan(data?.navigation?.next_scan_id)}
          >
            Next <ArrowRight className="size-4" />
          </Button>
          <Button asChild variant="subtle" size="sm" className="rounded-xl">
            <Link to="/compare" search={scan ? { a: scan } : {}}>
              Compare
            </Link>
          </Button>
          <Button asChild variant="subtle" size="sm" className="rounded-xl">
            <Link to="/history">Scan history</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="rounded-xl">
            <Link to="/dashboard">Dashboard</Link>
          </Button>
        </div>
      }
    >
      {!scan ? (
        <EmptyState
          icon={<ScanLine className="size-5" />}
          title="No scan selected"
          description="Open a scan from your history, or run a new shelf scan to see results here."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="brand" size="sm" className="rounded-xl">
                <Link to="/scan">Start a new scan</Link>
              </Button>
              <Button asChild variant="subtle" size="sm" className="rounded-xl">
                <Link to="/history">Browse scan history</Link>
              </Button>
            </div>
          }
        />
      ) : query.isError ? (
        <ErrorState
          title="Couldn't load this scan"
          description={
            query.error instanceof Error
              ? sanitizeUserMessage(query.error.message)
              : "We couldn't load this scan right now. Please try again."
          }
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <div className="space-y-4">
          <ScanResultHeader
            data={data}
            loading={loading}
            assignmentId={assignmentQuery.data ?? null}
          />

          {data?.status === "failed" ? (
            <FailedState scanId={data.scan_id} onRetried={() => void query.refetch()} />
          ) : processing ? (
            <ProcessingState scanId={data?.scan_id} />
          ) : (
            <>
              {assignmentQuery.data && (
                <FixRescanVerifyPanel
                  assignmentId={assignmentQuery.data}
                  scanId={data?.scan_id}
                />
              )}

              <ScanContextPanel
                value={scanContext}
                onChange={(next) => {
                  setScanContext(next);
                  saveStoredScanContext(next);
                }}
                defaultCategory={data?.scan_category ?? ""}
                defaultSubCategory={data?.scan_sub_category ?? ""}
                defaultLocation={data?.location ?? data?.aisle ?? ""}
                className="mb-4"
              />

              <div
                className={`flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between ${viewTheme.accentBorder}`}
              >
                <p className="text-sm text-muted-foreground">
                  {VIEW_MODE_DESCRIPTIONS[activeView]}
                </p>
                <ResultViewSwitcher
                  value={activeView}
                  onChange={setViewOverride}
                  roleFamily={workspaceQuery.data?.roleFamily}
                  customerType={workspaceQuery.data?.customerType}
                />
              </div>

              {sectionOrder.map((key) => {
                switch (key) {
                  case "improvement_banner":
                    return (
                      <ExecutionImprovementBanner
                        key={key}
                        current={executionScore(data)}
                        previous={data?.navigation?.previous_execution_score ?? undefined}
                        loading={loading}
                      />
                    );
                  case "score_hero":
                    return (
                      <ExecutionScoreHero
                        key={key}
                        data={display}
                        loading={loading}
                        previousScore={data?.navigation?.previous_execution_score ?? undefined}
                      />
                    );
                  case "kpi_strip":
                    return <ExecutionKpiStripPanel key={key} data={display} loading={loading} />;
                  case "facings_strip":
                    return <FacingsSummaryStrip key={key} data={display} loading={loading} />;
                  case "action_center":
                    return (
                      <ActionCenterPanel
                        key={key}
                        data={display}
                        loading={loading}
                        view={activeView}
                      />
                    );
                  case "financial_impact":
                    return (
                      <FinancialImpactPanel
                        key={key}
                        data={display}
                        loading={loading}
                        locked={financialLocked}
                        planCode={planCode}
                      />
                    );
                  case "placement_alert":
                    return (data?.compliance_alerts?.length ?? 0) > 0 ? (
                      <ComplianceAlertCard
                        key={key}
                        alerts={data?.compliance_alerts}
                        mismatches={data?.subcategory_mismatches}
                      />
                    ) : null;
                  case "ai_summary":
                    return (
                      <AiSummaryBlock key={key} data={display} loading={loading} view={activeView} />
                    );
                  case "competitor_intel":
                    return competitorEnabled ? (
                      <CompetitorIntelPanel
                        key={key}
                        snapshot={data?.competitor_intel}
                        loading={loading}
                      />
                    ) : null;
                  case "share_of_shelf":
                    return <ShareOfShelfPanel key={key} data={display} loading={loading} />;
                  case "sku_availability":
                    return (
                      <SkuAvailabilityPanel
                        key={key}
                        data={display}
                        loading={loading}
                        matched={matchedProducts}
                        expected={expectedProducts}
                      />
                    );
                  case "recommended_actions":
                    return <RecommendedActionsPanel key={key} data={display} loading={loading} />;
                  case "planogram":
                    return (
                      <Fragment key={key}>
                        {planogramSection ? (
                          <PlanogramComparisonSection comparison={planogramSection} />
                        ) : null}
                        {showPlanogramWarning ? <PlanogramMissingAlert /> : null}
                      </Fragment>
                    );
                  case "review_queue":
                    return (
                      <NeedsReviewSection
                        key={key}
                        data={data}
                        onCorrected={() => {
                          void query.refetch();
                        }}
                      />
                    );
                  case "annotated_image":
                    return (
                      <AnnotatedImageViewer
                        key={key}
                        src={data?.annotated_image_url}
                        originalSrc={data?.original_image_url}
                        scanId={data?.scan_id}
                        loading={loading}
                      />
                    );
                  case "inventory":
                    return (
                      <InventoryTable
                        key={key}
                        items={display?.inventory}
                        scanId={data?.scan_id}
                        csvUrl={data?.downloads?.csv_url}
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
                          <TopBrandsChart data={display?.charts?.top_brands} loading={loading} />
                          <QuantityDistributionChart
                            data={data?.charts?.quantity_distribution}
                            loading={loading}
                          />
                          <ConfidenceDistributionChart
                            data={data?.charts?.confidence_distribution}
                            loading={loading}
                          />
                          <ShelfHealthChart score={summary?.shelf_health_score} loading={loading} />
                          <LowStockSummaryChart
                            data={data?.charts?.low_stock_summary}
                            loading={loading}
                          />
                          <CategoryDistributionChart
                            data={data?.charts?.category_distribution}
                            loading={loading}
                          />
                        </div>
                      </details>
                    );
                  case "alerts":
                    return <AlertsPanel key={key} alerts={data?.alerts} loading={loading} />;
                  case "downloads":
                    return <DownloadsPanel key={key} data={data} loading={loading} />;
                  case "share":
                    return <SharePanel key={key} data={data} loading={loading} />;
                  case "scan_details":
                    return (
                      <ScanDetailsAccordion
                        key={key}
                        data={data}
                        loading={loading}
                        onExportJson={
                          data
                            ? () =>
                                downloadBlob(
                                  JSON.stringify(data, null, 2),
                                  `aislix-${data.scan_id}-result.json`,
                                  "application/json",
                                )
                            : undefined
                        }
                      />
                    );
                  default:
                    return null;
                }
              })}

              <ResultSection
                title="Next steps"
                description="Continue auditing or review your scan portfolio."
              >
                <ResultNavigation />
              </ResultSection>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}

function DownloadsPanel({
  data,
  loading,
}: {
  data?: ScanResult | undefined;
  loading?: boolean | undefined;
}) {
  const imageUrl = data?.downloads?.annotated_image_url ?? data?.annotated_image_url;

  const downloadCsv = async () => {
    if (data?.scan_id) {
      try {
        await downloadScanCsv(data.scan_id, data.downloads?.csv_url);
        return;
      } catch {
        // fall back to the client-side export
      }
    }
    if (!data) return;
    downloadBlob(
      buildFullScanReportCsv(data),
      `aislix-${data.scan_id}-report.csv`,
      "text/csv;charset=utf-8",
    );
  };

  const downloadImage = async () => {
    if (!data?.scan_id) return;
    try {
      await downloadScanAnnotatedImage(data.scan_id, imageUrl, data.original_image_url);
      toast.success("Annotated image downloaded");
    } catch (e) {
      toast.error(networkErrorMessage(e, GENERIC_EXPORT));
    }
  };


  const downloadPdf = async () => {
    if (!data?.scan_id) return;
    try {
      await downloadScanPdf(data.scan_id, data.downloads?.pdf_url);
      toast.success("PDF report downloaded");
    } catch (e) {
      toast.error(networkErrorMessage(e, GENERIC_EXPORT));
    }
  };

  return (
    <ResultSection title="Downloads" description="Export this scan for sharing or analysis.">
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button
            variant="brand"
            size="lg"
            className="w-full rounded-xl"
            disabled={!data?.scan_id}
            onClick={() => void downloadPdf()}
          >
            <FileText className="size-4" /> PDF report
          </Button>

          <Button
            variant="subtle"
            size="lg"
            className="w-full rounded-xl"
            onClick={downloadCsv}
            disabled={inventory.length === 0}
          >
            <FileSpreadsheet className="size-4" /> CSV inventory
          </Button>

          <Button
            variant="subtle"
            size="lg"
            className="w-full rounded-xl"
            disabled={!data?.scan_id}
            onClick={() => void downloadImage()}
          >
            <ImageIcon className="size-4" /> Annotated image
          </Button>


          <PrintReportButton disabled={!data} />
        </div>
      )}
      {!loading && !data?.downloads?.pdf_url && (
        <p className="mt-3 text-xs text-muted-foreground">
          PDF reports become available once the Aislix reporting service returns a document URL for
          this scan.
        </p>
      )}
    </ResultSection>
  );
}

function FailedState({ scanId, onRetried }: { scanId: string; onRetried: () => void }) {
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const retry = async () => {
    setRetrying(true);
    setMessage(null);
    try {
      await retryScanAnalysis(scanId);
      onRetried();
    } catch (error) {
      setMessage(networkErrorMessage(error));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      className="card-surface flex flex-col items-center gap-4 px-6 py-14 text-center"
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </span>
      <div>
        <h2 className="text-base font-semibold tracking-tight">This scan failed to process</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          The uploaded images are safe in storage. Retrying re-runs the AI analysis without
          re-uploading anything.
        </p>
        {message && <p className="mt-3 text-sm text-destructive">{message}</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="brand"
          size="sm"
          className="rounded-xl"
          onClick={() => void retry()}
          disabled={retrying}
        >
          {retrying ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {retrying ? "Retrying analysis" : "Retry analysis"}
        </Button>
        <Button asChild variant="subtle" size="sm" className="rounded-xl">
          <Link to="/scan">Start a new scan</Link>
        </Button>
      </div>
    </div>
  );
}
