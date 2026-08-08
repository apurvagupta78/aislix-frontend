// Reports library: every completed scan for the signed-in user's organization,
// with per-row view / PDF / CSV actions. Backed by the live scan history API.

import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/States";
import { fetchScanHistory, formatScanTime } from "@/lib/scan-history";
import {
  downloadBlob,
  fetchScanResult,
  formatScanDate,
  inventoryToCsv,
} from "@/lib/scan-results";
import { toUserMessage } from "@/lib/api/errors";

export function ReportsLibrary() {
  const [busyCsv, setBusyCsv] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["reports-library"],
    queryFn: ({ signal }) =>
      fetchScanHistory({ sort: "newest", page: 1, page_size: 100 }, signal),
    retry: false,
  });

  const items = (query.data?.items ?? []).filter((s) => s.status === "completed");

  const downloadCsv = async (scanId: string) => {
    setBusyCsv(scanId);
    try {
      const result = await fetchScanResult(scanId);
      if (!result.inventory?.length) {
        toast.error("This report has no inventory rows to export.");
        return;
      }
      downloadBlob(
        inventoryToCsv(result.inventory),
        `aislix-${scanId}-report.csv`,
        "text/csv",
      );
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setBusyCsv(null);
    }
  };

  if (query.isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Reports unavailable"
        description={toUserMessage(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="No reports yet — run your first scan."
        description="Every completed shelf scan generates a print-ready audit report here."
        action={
          <Button asChild variant="brand" size="sm" className="rounded-xl">
            <Link to="/scan">Start a scan</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="hidden grid-cols-[1.4fr_1fr_0.7fr_0.7fr_auto] gap-4 border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid">
        <span>Scan</span>
        <span>Store</span>
        <span>Products</span>
        <span>Low stock</span>
        <span className="text-right">Actions</span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li
            key={item.scan_id}
            className="grid gap-3 px-5 py-4 lg:grid-cols-[1.4fr_1fr_0.7fr_0.7fr_auto] lg:items-center lg:gap-4"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {formatScanDate(item.created_at) ?? "Date unavailable"}
              </p>
              <p className="text-xs text-muted-foreground">{formatScanTime(item.created_at)}</p>
            </div>
            <p className="truncate text-sm text-muted-foreground">{item.store || "—"}</p>
            <p className="text-sm">{item.products_detected ?? "—"}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm">{item.low_stock_products ?? "—"}</span>
              <Badge className="rounded-full bg-accent-green/12 text-accent-green hover:bg-accent-green/12 lg:hidden">
                Completed
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Button asChild variant="subtle" size="sm" className="rounded-xl">
                <Link to="/report" search={{ scan: item.scan_id }}>
                  <FileText className="size-4" /> View
                </Link>
              </Button>
              <Button
                variant="subtle"
                size="sm"
                className="rounded-xl"
                disabled={!item.downloads?.pdf_url}
                onClick={() => {
                  const url = item.downloads?.pdf_url;
                  if (url) window.open(url, "_blank", "noopener,noreferrer");
                }}
              >
                <Download className="size-4" /> PDF
              </Button>
              <Button
                variant="subtle"
                size="sm"
                className="rounded-xl"
                disabled={busyCsv === item.scan_id}
                onClick={() => void downloadCsv(item.scan_id)}
              >
                {busyCsv === item.scan_id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}{" "}
                CSV
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
