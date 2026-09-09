import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
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
import {
  ActionCenterPanel,
  AiSummaryBlock,
  ExecutionImprovementBanner,
  ExecutionKpiStripPanel,
  ExecutionScoreHero,
  FacingsSummaryStrip,
  RecommendedActionsPanel,
  ScanDetailsAccordion,
  ShareOfShelfPanel,
  SkuAvailabilityPanel,
} from "@/components/scan-results/ExecutionPhase1";
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
  fetchScanResult,
  inventoryToCsv,
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
    retry: false,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === "processing" || status === "queued" ? 4000 : false;
    },
  });

  const scanStatus = query.data?.status;
  const comparisonQuery = useQuery({
    queryKey: ["planogram-comparison", scan],
    queryFn: () => fetchPlanogramComparison(scan!),
    enabled: Boolean(scan),
    retry: false,
    refetchInterval: scanStatus === "processing" || scanStatus === "queued" ? 4000 : false,
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
              <ExecutionImprovementBanner
                current={executionScore(data)}
                previous={data?.navigation?.previous_execution_score ?? undefined}
                loading={loading}
              />

              <ExecutionScoreHero
                data={data}
                loading={loading}
                previousScore={data?.navigation?.previous_execution_score ?? undefined}
              />

              <ExecutionKpiStripPanel data={data} loading={loading} />

              <FacingsSummaryStrip data={data} loading={loading} />

              <ActionCenterPanel data={data} loading={loading} />

              {(data?.compliance_alerts?.length ?? 0) > 0 && (
                <ComplianceAlertCard
                  alerts={data?.compliance_alerts}
                  mismatches={data?.subcategory_mismatches}
                />
              )}

              <AiSummaryBlock data={data} loading={loading} />

              <div className="grid gap-4 lg:grid-cols-2">
                <ShareOfShelfPanel data={data} loading={loading} />
                <SkuAvailabilityPanel
                  data={data}
                  loading={loading}
                  matched={matchedProducts}
                  expected={expectedProducts}
                />
              </div>

              <RecommendedActionsPanel data={data} loading={loading} />

              {planogramSection && <PlanogramComparisonSection comparison={planogramSection} />}
              {showPlanogramWarning && <PlanogramMissingAlert />}

              <NeedsReviewSection
                data={data}
                onCorrected={() => {
                  void query.refetch();
                }}
              />

              <AnnotatedImageViewer
                src={data?.annotated_image_url}
                originalSrc={data?.original_image_url}
                scanId={data?.scan_id}
                loading={loading}
              />

              <InventoryTable
                items={data?.inventory}
                scanId={data?.scan_id}
                csvUrl={data?.downloads?.csv_url}
                loading={loading}
              />

              <details className="card-surface p-5 sm:p-6">
                <summary className="cursor-pointer text-sm font-semibold tracking-tight">
                  Analytics
                </summary>
                <p className="mt-1 text-xs text-muted-foreground">
                  Brand share, confidence distribution, and legacy shelf health charts.
                </p>
                <div className="mt-4 grid gap-4 xl:grid-cols-3">
                  <TopBrandsChart data={data?.charts?.top_brands} loading={loading} />
                  <QuantityDistributionChart
                    data={data?.charts?.quantity_distribution}
                    loading={loading}
                  />
                  <ConfidenceDistributionChart
                    data={data?.charts?.confidence_distribution}
                    loading={loading}
                  />
                  <ShelfHealthChart score={summary?.shelf_health_score} loading={loading} />
                  <LowStockSummaryChart data={data?.charts?.low_stock_summary} loading={loading} />
                  <CategoryDistributionChart
                    data={data?.charts?.category_distribution}
                    loading={loading}
                  />
                </div>
              </details>

              <AlertsPanel alerts={data?.alerts} loading={loading} />

              <DownloadsPanel data={data} loading={loading} />

              <SharePanel data={data} loading={loading} />

              <ScanDetailsAccordion
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
  const inventory = data?.inventory ?? [];
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
    downloadBlob(
      inventoryToCsv(inventory),
      `aislix-${data?.scan_id ?? "scan"}-inventory.csv`,
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
