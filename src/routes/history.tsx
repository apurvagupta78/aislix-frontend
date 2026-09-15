import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  ImageDown,
  MoreHorizontal,
  Search,
  SearchX,
  Sheet as SheetIcon,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteScan,
  fetchScanHistory,
  formatCount,
  formatScanDate,
  formatScanTime,
  type ScanHistoryItem,
  type AuditModeFilter,
  type ScanHistoryQuery,
  type ScanStatus,
} from "@/lib/scan-history";
import {
  downloadScanAnnotatedImage,
  downloadScanCsv,
  downloadScanPdf,
} from "@/lib/scan-results";

import { toast } from "sonner";

const PAGE_SIZE = 10;

type HistorySearch = {
  q?: string;
  store?: string;
  date?: string;
  date_from?: string;
  date_to?: string;
};

export const Route = createFileRoute("/history")({
  validateSearch: (search: Record<string, unknown>): HistorySearch => {
    const out: HistorySearch = {};
    const q = search["q"];
    if (typeof q === "string" && q) out.q = q;
    const store = search["store"];
    if (typeof store === "string" && store) out.store = store;
    const date = search["date"];
    if (typeof date === "string" && date) out.date = date;
    const dateFrom = search["date_from"];
    if (typeof dateFrom === "string" && dateFrom) out.date_from = dateFrom;
    const dateTo = search["date_to"];
    if (typeof dateTo === "string" && dateTo) out.date_to = dateTo;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Audit History — Aislix Shelf Audits" },
      {
        name: "description",
        content:
          "Search and filter audits by store, location and category, then compare any two shelf audits.",
      },
      { property: "og:title", content: "Audit history — Aislix" },
      {
        property: "og:description",
        content: "A searchable archive of every shelf audit, with exports and audit comparison.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

/* --------------------------------- helpers -------------------------------- */

function StatusBadge({ status }: { status: ScanStatus }) {
  const map: Record<ScanStatus, { label: string; className: string }> = {
    completed: { label: "Completed", className: "bg-accent-green/12 text-accent-green" },
    processing: { label: "Processing", className: "bg-brand-soft text-brand" },
    failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
  };
  const s = map[status];
  return (
    <Badge variant="secondary" className={`rounded-full border-0 font-medium ${s.className}`}>
      {s.label}
    </Badge>
  );
}

const assignmentStatusMeta: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In progress", className: "bg-brand-soft text-brand" },
  needs_correction: { label: "Needs correction", className: "bg-amber-500/12 text-amber-600" },
  completed: { label: "Completed", className: "bg-accent-green/12 text-accent-green" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

function AssignmentStatusBadge({ status }: { status: string | null }) {
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

function complianceTone(value: number | null): string {
  if (value === null) return "text-muted-foreground";
  if (value >= 100) return "text-accent-green";
  if (value >= 70) return "text-amber-600";
  return "text-destructive";
}

function formatCompliance(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function RowActions({
  scan,

  onDelete,
}: {
  scan: ScanHistoryItem;
  onDelete: (scan: ScanHistoryItem) => void;
}) {
  const d = scan.downloads;
  const [busy, setBusy] = useState<"pdf" | "csv" | "image" | null>(null);

  const run = async (kind: "pdf" | "csv" | "image", task: () => Promise<void>) => {
    setBusy(kind);
    // Reports for older audits are rebuilt on demand and can take a minute.
    const toastId = toast.loading("Preparing download…");
    try {
      await task();
      toast.dismiss(toastId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download this file.", { id: toastId });
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-xl" aria-label={`Actions for ${scan.scan_id}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-xl">
        <DropdownMenuItem asChild>
          <Link to="/results" search={{ scan: scan.scan_id }}>
            <FileText className="size-4" /> View results
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/report" search={{ scan: scan.scan_id }}>
            <FileText className="size-4" /> View report
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy === "pdf" || scan.status !== "completed"}
          onSelect={(e) => {
            e.preventDefault();
            void run("pdf", () => downloadScanPdf(scan.scan_id, d?.pdf_url));
          }}
        >
          <Download className="size-4" /> {busy === "pdf" ? "Preparing PDF…" : "Download PDF"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy === "csv" || scan.status !== "completed"}
          onSelect={(e) => {
            e.preventDefault();
            void run("csv", () => downloadScanCsv(scan.scan_id, d?.csv_url));
          }}
        >
          <SheetIcon className="size-4" /> {busy === "csv" ? "Preparing CSV…" : "Download CSV"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy === "image" || scan.status !== "completed"}
          onSelect={(e) => {
            e.preventDefault();
            void run("image", () =>
              downloadScanAnnotatedImage(scan.scan_id, d?.annotated_image_url),
            );
          }}
        >
          <ImageDown className="size-4" /> {busy === "image" ? "Preparing image…" : "Annotated image"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => onDelete(scan)}
        >
          <Trash2 className="size-4" /> Delete audit
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------------------------- page ---------------------------------- */

function HistoryPage() {
  const navigate = useNavigate();
  const {
    q: initialQuery,
    store: initialStore,
    date: initialDate,
    date_from: initialDateFrom,
    date_to: initialDateTo,
  } = Route.useSearch();
  const queryClient = useQueryClient();

  const [q, setQ] = useState(initialQuery ?? "");
  const [store, setStore] = useState(initialStore ?? "all");
  const [date, setDate] = useState(initialDate ?? "");
  const [sort, setSort] = useState<NonNullable<ScanHistoryQuery["sort"]>>("newest");
  const [type, setType] = useState<NonNullable<ScanHistoryQuery["type"]>>("all");
  const [auditMode, setAuditMode] = useState<AuditModeFilter>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<ScanHistoryItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const params: ScanHistoryQuery = {
    q,
    store,
    date,
    date_from: initialDateFrom,
    date_to: initialDateTo,
    sort,
    type,
    audit_mode: auditMode,
    page,
    page_size: PAGE_SIZE,
  };


  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["scan-history", params],
    queryFn: ({ signal }) => fetchScanHistory(params, signal),
    retry: false,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const stores = useMemo(
    () => data?.stores ?? Array.from(new Set(items.map((i) => i.store))).sort(),
    [data?.stores, items],
  );

  const resetPage = () => setPage(1);

  const toggleSelected = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : prev.length >= 2 ? [prev[1]!, id] : [...prev, id],
    );

  const compare = () => {
    if (selected.length !== 2) return;
    navigate({ to: "/compare", search: { a: selected[0]!, b: selected[1]! } });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteScan(pendingDelete.scan_id);
      setSelected((prev) => prev.filter((id) => id !== pendingDelete.scan_id));
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["scan-history"] });
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete this audit.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell
      title="Audit history"
      description="Every shelf audit run on your workspace, with exports and audit comparison."
    >
      <div className="space-y-5">
        {/* filters */}
        <section className="card-surface p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  resetPage();
                }}
                placeholder="Search by audit ID or store name"
                className="h-11 rounded-xl pl-9"
                aria-label="Search audits"
              />
            </div>

            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  resetPage();
                }}
                className="h-11 rounded-xl pl-9 sm:w-[190px]"
                aria-label="Filter by date"
              />
            </div>

            <Select
              value={store}
              onValueChange={(v) => {
                setStore(v);
                resetPage();
              }}
            >
              <SelectTrigger className="h-11 rounded-xl sm:w-[200px]" aria-label="Filter by store">
                <SelectValue placeholder="All stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stores</SelectItem>
                {stores.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sort}
              onValueChange={(v) => {
                setSort(v as typeof sort);
                resetPage();
              }}
            >
              <SelectTrigger className="h-11 rounded-xl sm:w-[190px]" aria-label="Sort audits">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="processing_time">Longest processing</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as typeof type);
                resetPage();
              }}
            >
              <SelectTrigger className="h-11 rounded-xl sm:w-[170px]" aria-label="Filter by audit type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All audits</SelectItem>
                <SelectItem value="assigned">Assigned only</SelectItem>
                <SelectItem value="adhoc">Ad hoc only</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={auditMode}
              onValueChange={(v) => {
                setAuditMode(v as AuditModeFilter);
                resetPage();
              }}
            >
              <SelectTrigger className="h-11 rounded-xl sm:w-[170px]" aria-label="Filter by audit mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modes</SelectItem>
                <SelectItem value="digital">Digital Audit</SelectItem>
                <SelectItem value="ai">AI Audit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(q || date || store !== "all" || type !== "all" || auditMode !== "all") && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Filters active</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 rounded-lg px-2 text-xs"
                onClick={() => {
                  setQ("");
                  setDate("");
                  setStore("all");
                  setType("all");
                  setAuditMode("all");
                  resetPage();
                }}
              >
                Clear all
              </Button>
            </div>
          )}

        </section>

        {/* compare bar */}
        <section className="card-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">Compare audits</p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Select two audits to compare inventory changes between them.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs text-muted-foreground">{selected.length}/2 selected</span>
            <Button
              variant="brand"
              size="sm"
              className="rounded-xl"
              disabled={selected.length !== 2}
              onClick={compare}
            >
              <ArrowLeftRight className="size-4" /> Compare
            </Button>
          </div>
        </section>

        {/* results */}
        <section className="card-surface p-4 sm:p-5">
          {isPending ? (
            <TableSkeleton rows={6} cols={6} />
          ) : isError ? (
            <ErrorState
              title="Couldn't load audit history"
              description={error instanceof Error ? error.message : undefined}
              onRetry={() => void refetch()}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={q || date || store !== "all" ? <SearchX className="size-5" /> : undefined}
              title={q || date || store !== "all" ? "No audits match your filters" : "No audits yet"}
              description={
                q || date || store !== "all"
                  ? "Try a different audit ID, store or date."
                  : "Run your first shelf audit and it will appear here."
              }
              action={
                <Button variant="brand" size="sm" className="rounded-xl" asChild>
                  <Link to="/new-audit">New audit</Link>
                </Button>
              }
            />
          ) : (
            <>
              {/* desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Audit</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Date &amp; time</TableHead>
                      <TableHead className="text-right">Products</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Assignment</TableHead>
                      <TableHead className="text-right">Compliance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10" />

                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((scan) => (
                      <TableRow key={scan.scan_id} className="transition-colors hover:bg-surface">
                        <TableCell>
                          <Checkbox
                            checked={selected.includes(scan.scan_id)}
                            onCheckedChange={() => toggleSelected(scan.scan_id)}
                            aria-label={`Select ${scan.scan_id} for comparison`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <Link
                            to="/results"
                            search={{ scan: scan.scan_id }}
                            className="font-medium text-foreground hover:text-brand"
                          >
                            {scan.scan_id}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-medium">{scan.store}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatScanDate(scan.created_at)}
                          <span className="ml-2 tabular-nums">{formatScanTime(scan.created_at)}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(scan.products_detected)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {scan.location ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm">
                          {scan.category ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant="secondary"
                              className={`w-fit rounded-full border-0 font-medium ${
                                scan.assignment_id
                                  ? "bg-brand-soft text-brand"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {scan.assignment_id ? "Assigned" : "Ad hoc"}
                            </Badge>
                            <Badge variant="outline" className="w-fit text-[0.65rem]">
                              {scan.audit_mode === "digital" ? "Digital" : "AI"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <AssignmentStatusBadge status={scan.assignment_status ?? null} />
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-medium ${complianceTone(
                            scan.planogram_compliance ?? null,
                          )}`}
                        >
                          {formatCompliance(scan.planogram_compliance ?? null)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={scan.status} />
                        </TableCell>

                        <TableCell className="text-right">
                          <RowActions scan={scan} onDelete={setPendingDelete} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* mobile cards */}
              <ul className="space-y-3 md:hidden">
                {items.map((scan) => (
                  <li key={scan.scan_id} className="rounded-2xl border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <Checkbox
                          className="mt-0.5"
                          checked={selected.includes(scan.scan_id)}
                          onCheckedChange={() => toggleSelected(scan.scan_id)}
                          aria-label={`Select ${scan.scan_id} for comparison`}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{scan.store}</p>
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{scan.scan_id}</p>
                        </div>
                      </div>
                      <RowActions scan={scan} onDelete={setPendingDelete} />
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      {[
                        { l: "Date", v: formatScanDate(scan.created_at) },
                        { l: "Time", v: formatScanTime(scan.created_at) },
                        { l: "Products", v: formatCount(scan.products_detected) },
                        { l: "Location", v: scan.location ?? "—" },
                        { l: "Category", v: scan.category ?? "—" },
                        { l: "Type", v: scan.assignment_id ? "Assigned" : "Ad hoc" },
                        {
                          l: "Compliance",
                          v: formatCompliance(scan.planogram_compliance ?? null),
                        },

                      ].map((row) => (
                        <div key={row.l} className="min-w-0">
                          <dt className="text-muted-foreground">{row.l}</dt>
                          <dd className="mt-0.5 truncate font-medium tabular-nums">{row.v}</dd>
                        </div>
                      ))}
                    </dl>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <StatusBadge status={scan.status} />
                      <Button variant="subtle" size="sm" className="rounded-xl" asChild>
                        <Link to="/results" search={{ scan: scan.scan_id }}>
                          View results
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* pagination */}
              <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {pageCount} · {total.toLocaleString()} audits
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="subtle"
                    size="sm"
                    className="rounded-xl"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="size-4" /> Previous
                  </Button>
                  <Button
                    variant="subtle"
                    size="sm"
                    className="rounded-xl"
                    disabled={page >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    Next <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this audit?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.scan_id} for {pendingDelete?.store} will be permanently removed, along
              with its report and exports. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete audit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
