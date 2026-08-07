import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/States";
import {
  fetchScanResult,
  formatConfidence,
  formatScanDate,
  inventoryToCsv,
  downloadBlob,
} from "@/lib/scan-results";
import { toUserMessage } from "@/lib/api/errors";

export const Route = createFileRoute("/report")({
  validateSearch: (search: Record<string, unknown>): { scan?: string } => {
    const scan = search["scan"];
    return typeof scan === "string" && scan.length > 0 ? { scan } : {};
  },
  head: () => ({
    meta: [
      { title: "PDF Audit Report — Aislix" },
      {
        name: "description",
        content: "Preview, download and share the PDF shelf audit report generated from your scan.",
      },
      { property: "og:title", content: "Shelf audit PDF report — Aislix" },
      { property: "og:description", content: "A shareable, print-ready retail shelf audit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportViewer,
});

function ReportViewer() {
  const { scan } = Route.useSearch();
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ["scan-result", scan],
    queryFn: ({ signal }) => fetchScanResult(scan!, signal),
    enabled: !!scan,
    retry: false,
  });

  const data = query.data;
  const summary = data?.summary;
  const inventory = data?.inventory ?? [];
  const brands = data?.charts?.top_brands ?? [];

  const share = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Report link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  return (
    <AppShell
      title="Audit report"
      description={
        data
          ? [data.store, data.aisle, formatScanDate(data.created_at)].filter(Boolean).join(" · ")
          : "Print-ready shelf audit report"
      }
      actions={
        <>
          <Button
            variant="subtle"
            size="sm"
            className="rounded-xl"
            onClick={share}
            disabled={!data}
          >
            <Share2 className="size-4" /> Share
          </Button>
          <Button
            variant="subtle"
            size="sm"
            className="rounded-xl"
            onClick={() => window.print()}
            disabled={!data}
          >
            <Printer className="size-4" /> Print
          </Button>
          <Button
            variant="brand"
            size="sm"
            className="rounded-xl"
            disabled={!data || inventory.length === 0}
            onClick={() =>
              downloadBlob(
                inventoryToCsv(inventory),
                `aislix-${data?.scan_id ?? "scan"}-report.csv`,
                "text/csv",
              )
            }
          >
            <Download className="size-4" /> Download data
          </Button>
        </>
      }
    >
      {!scan ? (
        <EmptyState
          title="No scan selected"
          description="Pick a scan from your history to generate its audit report."
          action={
            <Button asChild variant="brand" size="sm" className="rounded-xl">
              <Link to="/history">Open scan history</Link>
            </Button>
          }
        />
      ) : query.isPending ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : query.isError ? (
        <ErrorState
          title="Report unavailable"
          description={toUserMessage(query.error)}
          onRetry={() => query.refetch()}
        />
      ) : !data ? (
        <EmptyState title="Report not found" description="This scan no longer exists." />
      ) : (
        <div className="bg-surface rounded-2xl p-4 sm:p-8">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-card sm:p-12">
            <div className="flex items-start justify-between gap-4 border-b border-border pb-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-brand">
                  Aislix shelf audit
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">
                  {[data.store, data.aisle].filter(Boolean).join(" — ") || "Shelf scan"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatScanDate(data.created_at) ?? "Date unavailable"}
                </p>
              </div>
              {summary?.shelf_health_score !== undefined && (
                <Badge className="rounded-full bg-accent-green/12 text-accent-green hover:bg-accent-green/12">
                  Health {Math.round(summary.shelf_health_score)}
                </Badge>
              )}
            </div>

            <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { l: "Products", v: summary ? String(summary.total_products) : "—" },
                { l: "Brands", v: summary ? String(summary.unique_brands) : "—" },
                {
                  l: "Confidence",
                  v: summary ? formatConfidence(summary.average_confidence) : "—",
                },
                { l: "Low stock", v: summary ? String(summary.low_stock_products) : "—" },
              ].map((k) => (
                <div key={k.l} className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-lg font-semibold tracking-tight">{k.v}</p>
                  <p className="text-[0.7rem] text-muted-foreground">{k.l}</p>
                </div>
              ))}
            </div>

            {data.executive_summary && (
              <>
                <h3 className="mt-8 text-sm font-semibold tracking-tight">Executive summary</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {data.executive_summary}
                </p>
              </>
            )}

            {brands.length > 0 && (
              <>
                <h3 className="mt-7 text-sm font-semibold tracking-tight">Top brands by facings</h3>
                <div className="mt-3 space-y-2">
                  {brands.slice(0, 5).map((b) => (
                    <div key={b.brand} className="flex items-center gap-3">
                      <span className="w-24 truncate text-xs text-muted-foreground">{b.brand}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-gradient-brand"
                          style={{ width: `${Math.min(100, b.share)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs">{Math.round(b.share)}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {inventory.length > 0 && (
              <>
                <h3 className="mt-7 text-sm font-semibold tracking-tight">Priority SKUs</h3>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Product</th>
                      <th className="pb-2 text-right font-medium">Quantity</th>
                      <th className="pb-2 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.slice(0, 8).map((p, i) => (
                      <tr key={`${p.name}-${i}`} className="border-b border-border/60">
                        <td className="py-2">{p.name}</td>
                        <td className="py-2 text-right">{p.quantity ?? "—"}</td>
                        <td className="py-2 text-right text-muted-foreground">
                          {p.stock_status ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <p className="mt-8 border-t border-border pt-4 text-[0.7rem] text-muted-foreground">
              Generated automatically by Aislix Retail Shelf Intelligence · Scan {data.scan_id}
            </p>
          </div>

          <div className="mx-auto mt-4 flex max-w-2xl justify-end gap-2">
            <Button
              variant="subtle"
              size="sm"
              className="rounded-xl"
              onClick={() => navigate({ to: "/results", search: { scan: data.scan_id } })}
            >
              Back to results
            </Button>
            <Button asChild variant="brand" size="sm" className="rounded-xl">
              <Link to="/history">Scan history</Link>
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
