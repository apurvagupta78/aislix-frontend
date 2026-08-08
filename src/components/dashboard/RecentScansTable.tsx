import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search, SearchX } from "lucide-react";
import { Panel } from "@/components/dashboard/DashboardParts";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  fetchRecentScans,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatScore,
  healthTone,
  type RecentScan,
  type RecentScansQuery,
  type RecentScansResponse,
} from "@/lib/dashboard";

const PAGE_SIZE = 8;

const statusClass: Record<RecentScan["status"], string> = {
  completed: "bg-accent-green/12 text-accent-green hover:bg-accent-green/12",
  processing: "bg-brand-soft text-brand hover:bg-brand-soft",
  queued: "bg-muted text-muted-foreground hover:bg-muted",
  failed: "bg-destructive/10 text-destructive hover:bg-destructive/10",
};

const healthClass = {
  good: "text-accent-green",
  warn: "text-warning",
  bad: "text-destructive",
  unknown: "text-muted-foreground",
} as const;

export function RecentScansTable({ demoData }: { demoData?: RecentScansResponse | undefined } = {}) {
  const [q, setQ] = useState("");
  const [store, setStore] = useState<string>("all");
  const [status, setStatus] = useState<NonNullable<RecentScansQuery["status"]>>("all");
  const [sort, setSort] = useState<NonNullable<RecentScansQuery["sort"]>>("newest");
  const [page, setPage] = useState(1);

  const params: RecentScansQuery = { q, store, status, sort, page, page_size: PAGE_SIZE };

  const query = useQuery({
    queryKey: ["recent-scans", params],
    queryFn: ({ signal }) => fetchRecentScans(params, signal),
    retry: false,
    enabled: !demoData,
  });

  const demoFiltered = demoData
    ? demoData.items.filter(
        (s) =>
          (status === "all" || s.status === status) &&
          (store === "all" || s.store === store) &&
          (!q ||
            `${s.store ?? ""} ${s.scan_id}`.toLowerCase().includes(q.toLowerCase())),
      )
    : [];

  const data = demoData ? { ...demoData, items: demoFiltered, total: demoFiltered.length } : query.data;
  const isPending = demoData ? false : query.isPending;
  const error = demoData ? null : query.error;
  const refetch = query.refetch;

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));


  const reset = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  return (
    <Panel
      title="Recent scans"
      action={
        <Link to="/history" className="text-xs font-medium text-brand hover:underline">
          View all
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => reset(setQ)(e.target.value)}
            placeholder="Search scan ID or store…"
            className="h-9 rounded-xl pl-9"
            aria-label="Search recent scans"
          />
        </div>
        <Select value={store} onValueChange={reset(setStore)}>
          <SelectTrigger className="h-9 w-full rounded-xl sm:w-40" aria-label="Filter by store">
            <SelectValue placeholder="All stores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stores</SelectItem>
            {(data?.stores ?? []).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={reset(setStatus) as (v: string) => void}
        >
          <SelectTrigger className="h-9 w-full rounded-xl sm:w-36" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={reset(setSort) as (v: string) => void}>
          <SelectTrigger className="h-9 w-full rounded-xl sm:w-40" aria-label="Sort scans">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="health">Shelf health</SelectItem>
            <SelectItem value="confidence">Confidence</SelectItem>
            <SelectItem value="products">Products detected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-5">
        {isPending ? (
          <TableSkeleton rows={6} cols={7} />
        ) : error ? (
          <ErrorState
            title="Couldn't load recent scans"
            description={(error as Error).message}
            onRetry={() => void refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="No scans match these filters"
            description="Adjust your search or filters, or run a new shelf scan."
            icon={<SearchX className="size-5" />}
            action={
              <Button asChild variant="brand" size="sm" className="rounded-xl">
                <Link to="/scan">Start new scan</Link>
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scan ID</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Shelf health</TableHead>
                    <TableHead className="text-right">Confidence</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Results</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((s) => (
                    <TableRow key={s.scan_id}>
                      <TableCell className="font-mono text-xs">{s.scan_id}</TableCell>
                      <TableCell className="font-medium">{s.store ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(s.created_at)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${healthClass[healthTone(s.shelf_health_score)]}`}
                      >
                        {formatScore(s.shelf_health_score)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercent(s.average_confidence)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(s.products_detected)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`rounded-full capitalize ${statusClass[s.status]}`}
                        >
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="subtle" size="sm" className="rounded-lg">
                          <Link to="/results" search={{ scan: s.scan_id }}>
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <ul className="space-y-3 md:hidden">
              {items.map((s) => (
                <li key={s.scan_id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {s.store ?? "—"}
                      </p>
                      <p className="mt-0.5 font-mono text-[0.7rem] text-muted-foreground">
                        {s.scan_id}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`rounded-full capitalize ${statusClass[s.status]}`}
                    >
                      {s.status}
                    </Badge>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Health</dt>
                      <dd className={`mt-0.5 font-medium ${healthClass[healthTone(s.shelf_health_score)]}`}>
                        {formatScore(s.shelf_health_score)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Confidence</dt>
                      <dd className="mt-0.5 font-medium">{formatPercent(s.average_confidence)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Products</dt>
                      <dd className="mt-0.5 font-medium">{formatNumber(s.products_detected)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[0.7rem] text-muted-foreground">
                      {formatDateTime(s.created_at)}
                    </span>
                    <Button asChild variant="subtle" size="sm" className="rounded-lg">
                      <Link to="/results" search={{ scan: s.scan_id }}>
                        View results
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Page {data?.page ?? page} of {pages} · {formatNumber(total)} scans
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="subtle"
                  size="sm"
                  className="rounded-lg"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" /> Previous
                </Button>
                <Button
                  variant="subtle"
                  size="sm"
                  className="rounded-lg"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                >
                  Next <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
