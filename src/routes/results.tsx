import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Braces,
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  ScanLine,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import {
  AlertsPanel,
  AnnotatedImageViewer,
  InventoryTable,
  RecommendationsPanel,
  ResultSection,
  SummaryCard,
} from "@/components/scan-results/ResultParts";
import {
  CategoryDistributionChart,
  ConfidenceDistributionChart,
  TopBrandsChart,
} from "@/components/scan-results/ResultCharts";
import {
  fetchScanResult,
  formatConfidence,
  formatDuration,
  inventoryToCsv,
  downloadBlob,
  type ScanResult,
} from "@/lib/scan-results";

export const Route = createFileRoute("/results")({
  validateSearch: (search: Record<string, unknown>) => ({
    scan: typeof search['scan'] === "string" ? (search['scan'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Scan Results — Aislix Shelf Audit" },
      {
        name: "description",
        content:
          "Detected products, brand shelf share, low-stock alerts and AI recommendations for a single Aislix shelf scan.",
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
  });

  const data = query.data;
  const loading = !!scan && query.isPending;
  const summary = data?.summary;

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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <SummaryCard
              label="Products detected"
              value={summary?.total_products}
              loading={loading}
            />
            <SummaryCard label="Unique SKUs" value={summary?.unique_skus} loading={loading} />
            <SummaryCard label="Unique brands" value={summary?.unique_brands} loading={loading} />
            <SummaryCard
              label="Low stock"
              value={summary?.low_stock_products}
              loading={loading}
              hint="Products below threshold"
            />
            <SummaryCard
              label="Avg AI confidence"
              value={
                summary ? formatConfidence(summary.average_confidence) : undefined
              }
              loading={loading}
              accent
            />
            <SummaryCard
              label="Processing time"
              value={summary ? formatDuration(summary.processing_time_ms) : undefined}
              loading={loading}
            />
          </div>

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

          <div className="grid gap-4 xl:grid-cols-3">
            <TopBrandsChart data={data?.charts?.top_brands} loading={loading} />
            <ConfidenceDistributionChart
              data={data?.charts?.confidence_distribution}
              loading={loading}
            />
            <CategoryDistributionChart
              data={data?.charts?.category_distribution}
              loading={loading}
            />
          </div>

          <InventoryTable items={data?.inventory} scanId={data?.scan_id} loading={loading} />

          <DownloadsPanel data={data} loading={loading} />
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

  const downloadCsv = () =>
    downloadBlob(
      inventoryToCsv(inventory),
      `aislix-${data?.scan_id ?? "scan"}-inventory.csv`,
      "text/csv;charset=utf-8",
    );

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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data?.downloads?.pdf_url ? (
            <Button asChild variant="brand" size="lg" className="w-full rounded-xl">
              <a href={data.downloads.pdf_url} target="_blank" rel="noreferrer">
                <FileText className="size-4" /> PDF report
              </a>
            </Button>
          ) : (
            <Button variant="brand" size="lg" className="w-full rounded-xl" disabled>
              <FileText className="size-4" /> PDF report
            </Button>
          )}

          <Button
            variant="subtle"
            size="lg"
            className="w-full rounded-xl"
            onClick={downloadCsv}
            disabled={inventory.length === 0}
          >
            <FileSpreadsheet className="size-4" /> CSV inventory
          </Button>

          {imageUrl ? (
            <Button asChild variant="subtle" size="lg" className="w-full rounded-xl">
              <a href={imageUrl} download={`aislix-${data?.scan_id ?? "scan"}-annotated.jpg`}>
                <ImageIcon className="size-4" /> Annotated image
              </a>
            </Button>
          ) : (
            <Button variant="subtle" size="lg" className="w-full rounded-xl" disabled>
              <ImageIcon className="size-4" /> Annotated image
            </Button>
          )}

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
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Download className="size-3.5" /> Export links activate when the scan service returns
          them.
        </p>
      )}
    </ResultSection>
  );
}
