import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { ArrowLeft, ArrowLeftRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/States";
import { Button } from "@/components/ui/button";
import {
  fetchScanResult,
  formatConfidence,
  formatDuration,
  type ScanResult,
} from "@/lib/scan-results";
import { formatScanDate, formatScanTime } from "@/lib/scan-history";

export const Route = createFileRoute("/compare")({
  validateSearch: (search: Record<string, unknown>): { a?: string; b?: string } => {
    const a = search['a'];
    const b = search['b'];
    return {
      ...(typeof a === "string" && a ? { a } : {}),
      ...(typeof b === "string" && b ? { b } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Compare Scans — Aislix Shelf Intelligence" },
      {
        name: "description",
        content:
          "Compare two shelf scans side by side to see how detected products, stock gaps and confidence changed over time.",
      },
      { property: "og:title", content: "Compare shelf scans — Aislix" },
      {
        property: "og:description",
        content: "Track inventory changes between any two Aislix shelf audits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComparePage,
});

type Metric = {
  label: string;
  value: (r: ScanResult) => string;
  raw: (r: ScanResult) => number | undefined;
  betterWhenHigher: boolean;
  formatDelta?: (diff: number) => string;
};

const metrics: Metric[] = [
  {
    label: "Products detected",
    value: (r) => r.summary.total_products.toLocaleString(),
    raw: (r) => r.summary.total_products,
    betterWhenHigher: true,
  },
  {
    label: "Unique SKUs",
    value: (r) => r.summary.unique_skus.toLocaleString(),
    raw: (r) => r.summary.unique_skus,
    betterWhenHigher: true,
  },
  {
    label: "Unique brands",
    value: (r) => r.summary.unique_brands.toLocaleString(),
    raw: (r) => r.summary.unique_brands,
    betterWhenHigher: true,
  },
  {
    label: "Low stock products",
    value: (r) => r.summary.low_stock_products.toLocaleString(),
    raw: (r) => r.summary.low_stock_products,
    betterWhenHigher: false,
  },
  {
    label: "Average confidence",
    value: (r) => formatConfidence(r.summary.average_confidence),
    raw: (r) => r.summary.average_confidence,
    betterWhenHigher: true,
  },
  {
    label: "Processing time",
    value: (r) => formatDuration(r.summary.processing_time_ms),
    raw: (r) => r.summary.processing_time_ms,
    betterWhenHigher: false,
    formatDelta: (diff) => `${diff > 0 ? "+" : "-"}${formatDuration(Math.abs(diff))}`,
  },
];

function Delta({
  from,
  to,
  betterWhenHigher,
  formatDelta,
}: {
  from?: number | undefined;
  to?: number | undefined;
  betterWhenHigher: boolean;
  formatDelta?: ((diff: number) => string) | undefined;
}) {
  if (from === undefined || to === undefined || !Number.isFinite(from) || !Number.isFinite(to)) {
    return <span className="text-muted-foreground">—</span>;
  }
  const diff = to - from;
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus className="size-3.5" /> No change
      </span>
    );
  }
  const good = betterWhenHigher ? diff > 0 : diff < 0;
  const Icon = diff > 0 ? TrendingUp : TrendingDown;
  const pct = from !== 0 ? ` (${((diff / Math.abs(from)) * 100).toFixed(1)}%)` : "";
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium ${good ? "text-accent-green" : "text-destructive"}`}
    >
      <Icon className="size-3.5" />
      {formatDelta
        ? formatDelta(diff)
        : `${diff > 0 ? "+" : ""}${Number.isInteger(diff) ? diff.toLocaleString() : diff.toFixed(1)}`}
      <span className="text-xs font-normal text-muted-foreground">{pct}</span>
    </span>
  );
}

function ScanHeading({ result, side }: { result: ScanResult; side: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {side}
      </p>
      <p className="mt-1 truncate text-sm font-semibold">{result.store ?? "Unknown store"}</p>
      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{result.scan_id}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatScanDate(result.created_at)} · {formatScanTime(result.created_at)}
      </p>
    </div>
  );
}

function ComparePage() {
  const { a, b } = Route.useSearch();
  const ids = [a, b].filter((id): id is string => typeof id === "string" && id.length > 0);

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["scan-result", id],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchScanResult(id, signal),
      retry: false,
    })),
  });

  const loading = results.some((r) => r.isPending);
  const failed = results.find((r) => r.isError);
  const [left, right] = results.map((r) => r.data);

  return (
    <AppShell
      title="Compare scans"
      description="Side-by-side inventory changes between two shelf audits."
      actions={
        <Button variant="subtle" size="sm" className="rounded-xl" asChild>
          <Link to="/history">
            <ArrowLeft className="size-4" /> Back to history
          </Link>
        </Button>
      }
    >
      {ids.length !== 2 ? (
        <EmptyState
          icon={<ArrowLeftRight className="size-5" />}
          title="Select two scans to compare"
          description="Pick any two completed scans in scan history, then choose Compare."
          action={
            <Button variant="brand" size="sm" className="rounded-xl" asChild>
              <Link to="/history">Go to scan history</Link>
            </Button>
          }
        />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : failed ? (
        <ErrorState
          title="Couldn't load both scans"
          description={failed.error instanceof Error ? failed.error.message : undefined}
          onRetry={() => results.forEach((r) => void r.refetch())}
        />
      ) : left && right ? (
        <div className="space-y-5">
          <section className="card-surface grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <ScanHeading result={left} side="Baseline scan" />
            <ScanHeading result={right} side="Comparison scan" />
          </section>

          <section className="card-surface p-4 sm:p-6">
            <h2 className="text-sm font-semibold tracking-tight">Inventory changes</h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Metrics come straight from each scan payload — no estimates.
            </p>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 text-left font-medium">Metric</th>
                    <th className="py-2 text-right font-medium">Baseline</th>
                    <th className="py-2 text-right font-medium">Comparison</th>
                    <th className="py-2 text-right font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.label} className="border-b border-border/70 last:border-0">
                      <td className="py-3 font-medium">{m.label}</td>
                      <td className="py-3 text-right tabular-nums">{m.value(left)}</td>
                      <td className="py-3 text-right tabular-nums">{m.value(right)}</td>
                      <td className="py-3 text-right">
                        <Delta
                          from={m.raw(left)}
                          to={m.raw(right)}
                          betterWhenHigher={m.betterWhenHigher}
                          formatDelta={m.formatDelta}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            {[left, right].map((r, i) => (
              <Button key={r.scan_id} variant="subtle" className="h-11 rounded-xl" asChild>
                <Link to="/results" search={{ scan: r.scan_id }}>
                  Open {i === 0 ? "baseline" : "comparison"} results
                </Link>
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState title="No comparison data" description="Both scans returned no payload." />
      )}
    </AppShell>
  );
}
