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
  Braces,
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
  RecommendationsPanel,
  ResultSection,
  SummaryCard,
} from "@/components/scan-results/ResultParts";
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
  formatConfidence,
  formatPercent,
  inventoryToCsv,
  downloadBlob,
  downloadScanCsv,
  downloadScanPdf,
  downloadScanAnnotatedImage,
  type ScanResult,
} from "@/lib/scan-results";
import { retryScanAnalysis } from "@/lib/scan-api";
import { PlanogramComparisonSection } from "@/components/scan-results/PlanogramCompliance";
import { complianceTone, fetchPlanogramComparison } from "@/lib/planogram-compliance";

export const Route = createFileRoute("/results")({
  validateSearch: (search: Record<string, unknown>): { scan?: string } => {
    const scan = search["scan"];
    return typeof scan === "string" && scan.length > 0 ? { scan } : {};
  },
  head: () => ({
    meta: [
      { title: "Scan Results Dashboard — Aislix Shelf Audit" },
      {
        name: "description",
        content:
          "Shelf health score, detected products, brand share, low-stock alerts and AI recommendations for a single Aislix shelf scan.",
      },
      { property: "og:title", content: "Shelf scan results — Aislix" },
      {
        property: "og:description",
        content: "Full AI breakdown of one shelf audit: inventory, alerts and recommendations.",
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
  const planogramPercent = comparison?.compliance_percent ?? planogram?.percent ?? null;
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
  const showPlanogramWarning =
    !planogramSection ||
    (expectedProducts !== null && expectedProducts === 0 && !planogramSection.lines.length);

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
              ? query.error.message
              : "The scan service did not return a result."
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
              <ComplianceAlertCard
                alerts={data?.compliance_alerts}
                mismatches={data?.subcategory_mismatches}
              />

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                  label="Products detected"
                  value={summary?.total_products}
                  loading={loading}
                />
                <SummaryCard label="Unique SKUs" value={summary?.unique_skus} loading={loading} />
                <SummaryCard
                  label="Unique brands"
                  value={summary?.unique_brands}
                  loading={loading}
                />
                <SummaryCard
                  label="Low stock"
                  value={summary?.low_stock_products}
                  loading={loading}
                  hint="Products below threshold"
                />
                <SummaryCard
                  label="Out of stock"
                  value={summary?.out_of_stock_products}
                  loading={loading}
                  hint="Empty facings detected"
                />
                <SummaryCard
                  label="Misplaced facings"
                  value={summary?.misplaced_products || undefined}
                  loading={loading}
                  hint="Wrong sub-category on this shelf"
                />

                <SummaryCard
                  label={comparison ? "Planogram compliance" : "Shelf compliance"}
                  value={
                    comparison
                      ? comparison.compliance_percent === null
                        ? undefined
                        : `${Math.round(comparison.compliance_percent)}%`
                      : formatPercent(summary?.shelf_compliance)
                  }
                  loading={loading}
                  hint="Against planogram"
                  valueClassName={
                    comparison ? complianceTone(comparison.compliance_percent) : undefined
                  }
                />
                <SummaryCard
                  label="Avg confidence"
                  value={summary ? formatConfidence(summary.average_confidence) : undefined}
                  loading={loading}
                  accent
                />
              </div>

              {comparison && <PlanogramComparisonSection comparison={comparison} />}

              <AnnotatedImageViewer
                src={data?.annotated_image_url}
                scanId={data?.scan_id}
                loading={loading}
              />

              <ResultSection
                title="Executive summary"
                description="Narrative generated by the AI pipeline."
              >
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-11/12" />
                    <Skeleton className="h-4 w-9/12" />
                  </div>
                ) : data?.executive_summary ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {data.executive_summary}
                  </p>
                ) : (
                  <EmptyState
                    icon={<FileText className="size-5" />}
                    title="No summary yet"
                    description="The executive summary appears here once the scan service returns it."
                  />
                )}
              </ResultSection>

              <div className="grid gap-4 lg:grid-cols-2">
                <AlertsPanel alerts={data?.alerts} loading={loading} />
                <RecommendationsPanel recommendations={data?.recommendations} loading={loading} />
              </div>

              <InventoryTable
                items={data?.inventory}
                scanId={data?.scan_id}
                csvUrl={data?.downloads?.csv_url}
                loading={loading}
              />

              <div className="grid gap-4 xl:grid-cols-3">
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

              <DownloadsPanel data={data} loading={loading} />

              <SharePanel data={data} loading={loading} />

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
      await downloadScanAnnotatedImage(data.scan_id, imageUrl);
      toast.success("Annotated image downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const downloadPdf = async () => {
    if (!data?.scan_id) return;
    try {
      await downloadScanPdf(data.scan_id, data.downloads?.pdf_url);
      toast.success("PDF report downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const downloadJson = () =>
    data &&
    downloadBlob(
      JSON.stringify(data, null, 2),
      `aislix-${data.scan_id}-result.json`,
      "application/json",
    );


  return (
    <ResultSection title="Downloads" description="Export this scan for sharing or analysis.">
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

          <Button
            variant="subtle"
            size="lg"
            className="w-full rounded-xl"
            onClick={downloadJson}
            disabled={!data}
          >
            <Braces className="size-4" /> JSON payload
          </Button>
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
      setMessage(error instanceof Error ? error.message : "The analysis failed again.");
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
