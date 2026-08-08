// Reports library: every completed scan for the signed-in user's organization,
// with per-row view / PDF / CSV actions. Backed by the live scan history API.

import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/States";
import { fetchScanHistory, formatScanTime, type ScanHistoryItem } from "@/lib/scan-history";
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

  const Actions = ({ item }: { item: ScanHistoryItem }) => (
    <div className="inline-flex items-center gap-1">
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
  );

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
        description="Run a scan with Store, Location and Category filled in to see reports here."
        action={
          <Button asChild variant="brand" size="sm" className="rounded-xl">
            <Link to="/scan">Start a scan</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px] text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Scan
              </TableHead>
              <TableHead className="min-w-[140px] text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Store
              </TableHead>
              <TableHead className="min-w-[160px] text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Location
              </TableHead>
              <TableHead className="min-w-[140px] text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Category
              </TableHead>
              <TableHead className="w-[140px] text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.scan_id}>
                <TableCell className="align-middle text-sm">
                  <Link
                    to="/results"
                    search={{ scan: item.scan_id }}
                    className="font-medium hover:underline"
                  >
                    {formatScanDate(item.created_at) ?? "Date unavailable"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatScanTime(item.created_at)}
                  </p>
                </TableCell>
                <TableCell className="align-middle text-sm text-muted-foreground">
                  {item.store || "—"}
                </TableCell>
                <TableCell className="align-middle text-sm">
                  <span
                    className="block max-w-[200px] truncate"
                    title={item.location || undefined}
                  >
                    {item.location || "—"}
                  </span>
                </TableCell>
                <TableCell className="align-middle text-sm">
                  {item.category ? (
                    <Badge className="rounded-full bg-accent-green/12 text-accent-green hover:bg-accent-green/12">
                      {item.category}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right align-middle">
                  <Actions item={item} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <ul className="grid gap-3 lg:hidden">
        {items.map((item) => (
          <li
            key={item.scan_id}
            className="rounded-2xl border border-border bg-card p-4 shadow-card"
          >
            <Link
              to="/results"
              search={{ scan: item.scan_id }}
              className="text-sm font-semibold hover:underline"
            >
              {formatScanDate(item.created_at) ?? "Date unavailable"}
            </Link>
            <p className="text-xs text-muted-foreground">{formatScanTime(item.created_at)}</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Store</dt>
                <dd className="min-w-0 truncate">{item.store || "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Location</dt>
                <dd className="min-w-0 truncate" title={item.location || undefined}>
                  {item.location || "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Category</dt>
                <dd className="min-w-0 truncate">{item.category || "—"}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Actions item={item} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
