// Reports library: every completed scan for the signed-in user's organization,
// with per-row view / PDF / CSV actions. Backed by the live scan history API.

import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/States";
import {
  fetchScanHistory,
  formatScanTime,
  type ScanHistoryItem,
  type ScanHistoryQuery,
} from "@/lib/scan-history";

import {
  downloadScanCsv,
  downloadScanPdf,
  formatScanDate,
} from "@/lib/scan-results";
import { toUserMessage } from "@/lib/api/errors";

const assignmentStatusMeta: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In progress", className: "bg-brand-soft text-brand" },
  needs_correction: { label: "Needs correction", className: "bg-amber-500/12 text-amber-600" },
  completed: { label: "Completed", className: "bg-accent-green/12 text-accent-green" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

function AssignmentStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const meta = assignmentStatusMeta[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="secondary" className={`rounded-full border-0 font-medium ${meta.className}`}>
      {meta.label}
    </Badge>
  );
}

function complianceTone(value: number | null | undefined): string {
  if (value === null || value === undefined) return "text-muted-foreground";
  if (value >= 100) return "text-accent-green";
  if (value >= 70) return "text-amber-600";
  return "text-destructive";
}

function formatCompliance(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${Math.round(value)}%`;
}

export function ReportsLibrary() {
  const [busyCsv, setBusyCsv] = useState<string | null>(null);
  const [busyPdf, setBusyPdf] = useState<string | null>(null);
  const [assignee, setAssignee] = useState("all");
  const [assignmentStatus, setAssignmentStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filters = { assignee, assignmentStatus, dateFrom, dateTo };

  const query = useQuery({
    queryKey: ["reports-library", filters],
    queryFn: ({ signal }) =>
      fetchScanHistory(
        {
          sort: "newest",
          page: 1,
          page_size: 100,
          assignee: assignee as ScanHistoryQuery["assignee"],
          assignment_status: assignmentStatus as ScanHistoryQuery["assignment_status"],
          ...(dateFrom ? { date_from: dateFrom } : {}),
          ...(dateTo ? { date_to: dateTo } : {}),
        },
        signal,
      ),
    retry: false,
  });

  const items = (query.data?.items ?? []).filter((s) => s.status === "completed");
  const assigneeOptions = query.data?.assignees ?? [];
  const filtersActive =
    assignee !== "all" || assignmentStatus !== "all" || Boolean(dateFrom) || Boolean(dateTo);

  const FilterBar = (
    <div className="mb-4 grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Assignee
        </label>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue placeholder="All assignees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            {assigneeOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Assignment status
        </label>
        <Select value={assignmentStatus} onValueChange={setAssignmentStatus}>
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="needs_correction">Needs correction</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          From
        </label>
        <Input
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          className="h-10 rounded-xl"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          To
        </label>
        <Input
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          className="h-10 rounded-xl"
        />
      </div>
      {filtersActive && (
        <div className="sm:col-span-2 lg:col-span-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg px-2 text-xs"
            onClick={() => {
              setAssignee("all");
              setAssignmentStatus("all");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );


  const downloadCsv = async (item: ScanHistoryItem) => {
    setBusyCsv(item.scan_id);
    const toastId = toast.loading("Preparing download…");
    try {
      await downloadScanCsv(item.scan_id, item.downloads?.csv_url);
      toast.dismiss(toastId);
    } catch (error) {
      toast.error(toUserMessage(error), { id: toastId });
    } finally {
      setBusyCsv(null);
    }
  };

  const downloadPdf = async (item: ScanHistoryItem) => {
    setBusyPdf(item.scan_id);
    const toastId = toast.loading("Preparing download…");
    try {
      await downloadScanPdf(item.scan_id, item.downloads?.pdf_url);
      toast.dismiss(toastId);
    } catch (error) {
      toast.error(toUserMessage(error), { id: toastId });
    } finally {
      setBusyPdf(null);
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
        disabled={busyPdf === item.scan_id}
        onClick={() => void downloadPdf(item)}
      >
        {busyPdf === item.scan_id ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}{" "}
        PDF
      </Button>
      <Button
        variant="subtle"
        size="sm"
        className="rounded-xl"
        disabled={busyCsv === item.scan_id}
        onClick={() => void downloadCsv(item)}
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
      <>
        {FilterBar}
        <EmptyState
          title={filtersActive ? "No reports match these filters" : "No reports yet — run your first scan."}
          description={
            filtersActive
              ? "Try a different assignee, status or date range."
              : "Run a scan with Store, Location and Category filled in to see reports here."
          }
          action={
            <Button asChild variant="brand" size="sm" className="rounded-xl">
              <Link to="/scan">Start a audit</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      {FilterBar}
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px] text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Audit
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
              <TableHead className="min-w-[140px] text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Assignee
              </TableHead>
              <TableHead className="min-w-[150px] text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Assignment
              </TableHead>
              <TableHead className="min-w-[120px] text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Compliance
              </TableHead>
              <TableHead className="w-[140px] text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                <TableCell className="align-middle text-sm">
                  {item.assignee_name ?? "—"}
                </TableCell>
                <TableCell className="align-middle text-sm">
                  <AssignmentStatusBadge status={item.assignment_status} />
                </TableCell>
                <TableCell
                  className={`text-right align-middle text-sm font-medium tabular-nums ${complianceTone(
                    item.planogram_compliance,
                  )}`}
                >
                  {formatCompliance(item.planogram_compliance)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-left align-middle">

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
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Assignee</dt>
                <dd className="min-w-0 truncate">{item.assignee_name ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Compliance
                </dt>
                <dd className={`font-medium ${complianceTone(item.planogram_compliance)}`}>
                  {formatCompliance(item.planogram_compliance)}
                </dd>
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
