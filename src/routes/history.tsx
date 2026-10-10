import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  CalendarClock,
  ChevronDown,
  Download,
  FileText,
  ImageDown,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Printer,
  Repeat,
  RotateCcw,
  SearchX,
  Sheet as SheetIcon,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState, FilterSearch, PageHeader } from "@/components/design-system";
import { TablePager, usePager } from "@/components/design-system/TablePager";
import { ErrorState, TableSkeleton } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteScan, formatCount, formatScanDate, formatScanTime } from "@/lib/scan-history";
import {
  AUDIT_HISTORY_STATUS_LABELS,
  EMPTY_AUDIT_HISTORY_FILTERS,
  activeAuditHistoryFilterCount,
  auditHistoryOptions,
  fetchAuditHistory,
  filterAuditHistory,
  isRecurringRow,
  isScheduledRow,
  type AuditHistoryFilters,
  type AuditHistoryRow,
  type AuditHistorySeries,
  type AuditHistoryScope,
  type AuditHistoryStatus,
} from "@/lib/audit-history";
import { downloadScanAnnotatedImage, downloadScanCsv, downloadScanPdf } from "@/lib/scan-results";
import { isOrgManager } from "@/lib/assignments";
import {
  fetchRecurringSeries,
  pauseAuditSchedule,
  resumeAuditSchedule,
  type RecurringSeries,
} from "@/lib/audit-schedules";
import { cn } from "@/lib/utils";

import { toast } from "sonner";

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
      { title: "Audit history — Aislix shelf audits" },
      {
        name: "description",
        content:
          "Every audit you ran or assigned, with its report. Filter by store, date, status and people, then compare any two audits.",
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

const STATUS_DOT: Record<AuditHistoryStatus, string> = {
  not_started: "bg-[#D9E2E8]",
  in_progress: "bg-[#7DB7D6]",
  submitted: "bg-[#9B86D9]",
  approved: "bg-[#79E2A8]",
  needs_correction: "bg-[#ECBDCC]",
  completed: "bg-[#79E2A8]",
  failed: "bg-[#ECBDCC]",
  cancelled: "bg-[#D9E2E8]",
};

const STATUS_ORDER: AuditHistoryStatus[] = [
  "not_started",
  "in_progress",
  "submitted",
  "approved",
  "needs_correction",
  "completed",
  "failed",
  "cancelled",
];

function StatusPill({ status }: { status: AuditHistoryStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#D9E2E8] bg-white px-2 py-0.5 text-xs font-medium text-[#04203F]">
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} aria-hidden />
      {AUDIT_HISTORY_STATUS_LABELS[status]}
    </span>
  );
}

function formatCompliance(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function isOverdue(row: AuditHistoryRow): boolean {
  if (!row.due_at || (row.status !== "not_started" && row.status !== "in_progress")) return false;
  return new Date(row.due_at).getTime() < Date.now();
}

function auditSubtitle(row: AuditHistoryRow): string {
  const place = [row.location, row.category].filter(Boolean).join(" · ");
  const id = (row.scan_id ?? row.assignment_id ?? "").slice(0, 8);
  return place ? `${place} · ${id}` : id;
}

function DateCell({ row }: { row: AuditHistoryRow }) {
  if (row.series) return <>{seriesSchedule(row.series)}</>;
  if (row.scan_id) {
    return (
      <>
        {formatScanDate(row.date)}
        <span className="ml-2 tabular-nums">{formatScanTime(row.date)}</span>
      </>
    );
  }
  return (
    <div className="space-y-0.5">
      <p>Assigned {formatScanDate(row.date)}</p>
      {row.due_at ? (
        <p className={cn("text-xs", isOverdue(row) ? "font-medium text-[#04203F]" : "text-[#667085]")}>
          {isOverdue(row) ? (
            <span className="mr-1 inline-block size-1.5 rounded-full bg-[#ECBDCC] align-middle" aria-hidden />
          ) : null}
          {isOverdue(row) ? "Overdue · due " : "Due "}
          {formatScanDate(row.due_at)}
        </p>
      ) : null}
    </div>
  );
}

function RowCta({
  row,
  userId,
  canManageSeries,
  className,
}: {
  row: AuditHistoryRow;
  userId: string;
  canManageSeries: boolean;
  className?: string;
}) {
  if (row.series) {
    if (!canManageSeries) return null;
    return (
      <Button variant="subtle" size="sm" className={cn("rounded-lg", className)} asChild>
        <Link to="/new-audit" search={{ ...NEW_AUDIT_SEARCH, editSeries: row.series.id }}>
          <Pencil className="size-4" /> Edit
        </Link>
      </Button>
    );
  }
  if (row.scan_id) {
    const done = row.scan_status === "completed";
    const label = done ? "View report" : row.scan_status === "failed" ? "View details" : "View progress";
    return (
      <Button variant={done ? "brand" : "subtle"} size="sm" className={cn("rounded-lg", className)} asChild>
        <Link to="/results" search={{ scan: row.scan_id }}>
          {label}
        </Link>
      </Button>
    );
  }
  if (row.status === "cancelled") return null;
  if (row.assignee_id === userId) {
    return (
      <Button variant="subtle" size="sm" className={cn("rounded-lg", className)} asChild>
        <Link to="/my-scans">Open in My work</Link>
      </Button>
    );
  }
  return (
    <Button variant="subtle" size="sm" className={cn("rounded-lg", className)} asChild>
      <Link to="/assigned-scans">Track audit</Link>
    </Button>
  );
}

const NEW_AUDIT_SEARCH = {
  templateId: undefined,
  systemKey: undefined,
  assign: false,
  dueDate: undefined,
  dueTime: undefined,
} as const;

const OPEN_STATUSES: AuditHistoryStatus[] = ["not_started", "in_progress", "needs_correction"];

type RowAccess = {
  userId: string;
  isManager: boolean;
  seriesById: Map<string, RecurringSeries>;
  onToggleSeries: (series: RecurringSeries) => void;
};

/** Creator of the audit (or whoever ran an ad hoc one), or a manager. */
function canChangeRow(row: AuditHistoryRow, access: RowAccess): boolean {
  if (access.isManager) return true;
  const owner = row.assignment_id ? row.assigner_id : row.conducted_by_id;
  return Boolean(owner) && owner === access.userId;
}

function RowActions({
  row,
  access,
  onDelete,
}: {
  row: AuditHistoryRow;
  access: RowAccess;
  onDelete: (row: AuditHistoryRow) => void;
}) {
  const [busy, setBusy] = useState<"pdf" | "csv" | "image" | null>(null);
  const scanId = row.scan_id;
  const canChange = canChangeRow(row, access);
  const editable = canChange && Boolean(row.assignment_id ?? scanId);
  const rerunnable = canChange && !OPEN_STATUSES.includes(row.status) && Boolean(row.assignment_id ?? scanId);
  const seriesId = row.series?.id ?? row.schedule_id;
  const series = seriesId ? access.seriesById.get(seriesId) : undefined;
  const seriesControl =
    series && (access.isManager || series.createdBy === access.userId) ? series : undefined;
  if (row.series) {
    if (!seriesControl) return <span className="inline-block size-9" aria-hidden />;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg"
            aria-label={`More actions for recurring audit ${row.series.name}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-xl">
          <DropdownMenuItem asChild>
            <Link to="/new-audit" search={{ ...NEW_AUDIT_SEARCH, editSeries: seriesControl.id }}>
              <Pencil className="size-4" /> Edit recurring audit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => access.onToggleSeries(seriesControl)}>
            {seriesControl.paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            {seriesControl.paused ? "Resume recurring audit" : "Pause recurring audit"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  if (!scanId && !editable && !rerunnable && !seriesControl) {
    return <span className="inline-block size-9" aria-hidden />;
  }
  const done = row.scan_status === "completed";

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
        <Button
          variant="ghost"
          size="icon"
          className="rounded-lg"
          aria-label={`More actions for audit ${(scanId ?? row.assignment_id ?? "").slice(0, 8)}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl">
        {editable ? (
          <DropdownMenuItem asChild>
            <Link
              to="/new-audit"
              search={
                row.assignment_id
                  ? { ...NEW_AUDIT_SEARCH, edit: row.assignment_id }
                  : { ...NEW_AUDIT_SEARCH, editScan: scanId! }
              }
            >
              <Pencil className="size-4" /> Edit audit
            </Link>
          </DropdownMenuItem>
        ) : null}
        {rerunnable ? (
          <DropdownMenuItem asChild>
            <Link
              to="/new-audit"
              search={
                row.assignment_id
                  ? { ...NEW_AUDIT_SEARCH, rerun: row.assignment_id }
                  : { ...NEW_AUDIT_SEARCH, rerunScan: scanId! }
              }
            >
              <RotateCcw className="size-4" /> Run again with changes
            </Link>
          </DropdownMenuItem>
        ) : null}
        {seriesControl ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/new-audit" search={{ ...NEW_AUDIT_SEARCH, editSeries: seriesControl.id }}>
                <Repeat className="size-4" /> Edit recurring audit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => access.onToggleSeries(seriesControl)}>
              {seriesControl.paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              {seriesControl.paused ? "Resume recurring audit" : "Pause recurring audit"}
            </DropdownMenuItem>
          </>
        ) : null}
        {scanId ? (
          <>
        {editable || rerunnable || seriesControl ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem asChild>
          <Link to="/results" search={{ scan: scanId }}>
            <FileText className="size-4" /> Open full report
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild disabled={!done}>
          <Link to="/report" search={{ scan: scanId }}>
            <Printer className="size-4" /> Printable report
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy === "pdf" || !done}
          onSelect={(e) => {
            e.preventDefault();
            void run("pdf", () => downloadScanPdf(scanId));
          }}
        >
          <Download className="size-4" /> {busy === "pdf" ? "Preparing PDF…" : "Download PDF"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy === "csv" || !done}
          onSelect={(e) => {
            e.preventDefault();
            void run("csv", () => downloadScanCsv(scanId));
          }}
        >
          <SheetIcon className="size-4" /> {busy === "csv" ? "Preparing CSV…" : "Download CSV"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy === "image" || !done}
          onSelect={(e) => {
            e.preventDefault();
            void run("image", () => downloadScanAnnotatedImage(scanId));
          }}
        >
          <ImageDown className="size-4" /> {busy === "image" ? "Preparing image…" : "Annotated image"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onDelete(row)}>
          <Trash2 className="size-4" /> Delete audit
        </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ScheduleLabel({ row }: { row: AuditHistoryRow }) {
  const recurring = isRecurringRow(row);
  if (!recurring && !isScheduledRow(row)) return null;
  const Icon = recurring ? Repeat : CalendarClock;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[11px] font-medium leading-none text-[#04203F]",
        recurring ? "border-[#7DB7D6]/50 bg-[#7DB7D6]/15" : "border-[#9B86D9]/50 bg-[#9B86D9]/15",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {recurring ? "Recurring" : "Scheduled"}
    </span>
  );
}

function SeriesStatusPill({ paused }: { paused: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#D9E2E8] bg-white px-2 py-0.5 text-xs font-medium text-[#04203F]">
      <span className={cn("size-1.5 rounded-full", paused ? "bg-[#D9E2E8]" : "bg-[#79E2A8]")} aria-hidden />
      {paused ? "Paused" : "Active"}
    </span>
  );
}

function RowStatus({ row }: { row: AuditHistoryRow }) {
  return row.series ? <SeriesStatusPill paused={row.series.paused} /> : <StatusPill status={row.status} />;
}

function listLabel(names: string[], noun: string): string {
  return names.length > 2 ? `${names.length} ${noun}` : names.join(", ");
}

function seriesSchedule(series: AuditHistorySeries): string {
  if (series.paused) return "Paused · no new rounds";
  return series.nextRunAt
    ? `Next round ${formatScanDate(series.nextRunAt)} ${formatScanTime(series.nextRunAt)}`
    : "Next round not scheduled";
}

/** A recurring series shown as its own row, alongside the audits it created. */
function seriesToRow(series: RecurringSeries): AuditHistoryRow {
  return {
    key: `series:${series.id}`,
    scan_id: null,
    assignment_id: null,
    store_id: null,
    store: listLabel(series.storeNames, "stores") || "—",
    date: series.nextRunAt ?? series.createdAt,
    due_at: null,
    location: null,
    category: null,
    products_detected: null,
    audit_mode: series.auditMode === "ai" ? "ai" : "digital",
    scan_status: null,
    status: "not_started",
    compliance: null,
    assignee_id: null,
    assignee_name: listLabel(series.assigneeNames, "people") || null,
    assigner_id: series.createdBy,
    conducted_by_id: null,
    conducted_by_name: null,
    schedule_id: series.id,
    schedule_kind: "recurring",
    series: {
      id: series.id,
      name: series.name,
      paused: series.paused,
      nextRunAt: series.nextRunAt,
      repeatLabel: series.repeatLabel,
      createdBy: series.createdBy,
      storeIds: series.storeIds,
      assigneeIds: series.assigneeIds,
    },
  };
}

function rowTitle(row: AuditHistoryRow): string {
  return row.series ? row.series.name : row.store;
}

function rowSubtitle(row: AuditHistoryRow): string {
  return row.series ? [row.series.repeatLabel, row.store].filter((v) => v && v !== "—").join(" · ") : auditSubtitle(row);
}

function rowType(row: AuditHistoryRow): string {
  const kind = isRecurringRow(row)
    ? "Recurring"
    : isScheduledRow(row)
      ? "Scheduled"
      : row.assignment_id
        ? "Assigned"
        : "Ad hoc";
  return `${kind} · ${row.audit_mode === "digital" ? "Digital" : "AI"}`;
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs text-[#667085]">
      {label}
      {children}
    </label>
  );
}

function OptionSelect({
  value,
  onChange,
  allLabel,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { id: string; name: string }[];
  ariaLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 rounded-lg" aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ---------------------------------- page ---------------------------------- */

function HistoryPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const queryClient = useQueryClient();

  const [scope, setScope] = useState<AuditHistoryScope>("mine");
  const [filters, setFiltersState] = useState<AuditHistoryFilters>(() => ({
    ...EMPTY_AUDIT_HISTORY_FILTERS,
    q: search.q ?? "",
    store: search.store ?? "all",
    dateFrom: search.date_from ?? search.date ?? "",
    dateTo: search.date_to ?? search.date ?? "",
  }));
  const [filtersOpen, setFiltersOpen] = useState(() => Boolean(search.store || search.date || search.date_from || search.date_to));
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<AuditHistoryRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["audit-history", scope],
    queryFn: () => fetchAuditHistory(scope),
    placeholderData: (previous) => previous,
    retry: false,
  });

  const managerQuery = useQuery({ queryKey: ["is-org-manager"], queryFn: isOrgManager, staleTime: 60_000 });
  const seriesQuery = useQuery({ queryKey: ["recurring-series"], queryFn: fetchRecurringSeries, retry: false });
  const isManager = managerQuery.data ?? false;
  const userId = data?.userId ?? "";
  const allSeries = seriesQuery.data ?? [];
  const seriesById = useMemo(() => new Map(allSeries.map((s) => [s.id, s])), [allSeries]);
  const seriesRows = useMemo(
    () =>
      (scope === "team"
        ? allSeries
        : allSeries.filter((s) => s.createdBy === userId || s.assigneeIds.includes(userId))
      ).map(seriesToRow),
    [allSeries, scope, userId],
  );
  const canManageSeries = (series: { createdBy: string | null }) => isManager || series.createdBy === userId;

  const seriesToggle = useMutation({
    mutationFn: (series: RecurringSeries) =>
      series.paused ? resumeAuditSchedule(series.id) : pauseAuditSchedule(series.id),
    onSuccess: (_, series) => {
      toast.success(
        series.paused
          ? `"${series.name}" resumed. New rounds start from the next scheduled date.`
          : `"${series.name}" paused. Rounds already assigned stay open.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["recurring-series"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update this recurring audit."),
  });
  const rowAccess: RowAccess = {
    userId,
    isManager,
    seriesById,
    onToggleSeries: (series) => seriesToggle.mutate(series),
  };

  const auditRows = data?.rows;
  const rows = useMemo(
    () =>
      [...seriesRows, ...(auditRows ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [seriesRows, auditRows],
  );
  const options = useMemo(() => auditHistoryOptions(rows), [rows]);
  const filtered = useMemo(() => filterAuditHistory(rows, filters), [rows, filters]);
  const pager = usePager(filtered.length);
  const pageRows = filtered.slice(pager.start, pager.end);
  const activeCount = activeAuditHistoryFilterCount(filters);
  const narrowed = activeCount > 0 || Boolean(filters.q.trim());

  const setFilters = (patch: Partial<AuditHistoryFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
    pager.setPage(0);
  };
  const clearFilters = () => {
    setFiltersState({ ...EMPTY_AUDIT_HISTORY_FILTERS, sort: filters.sort });
    pager.setPage(0);
  };

  const toggleSelected = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : prev.length >= 2 ? [prev[1]!, id] : [...prev, id],
    );

  const compare = () => {
    if (selected.length !== 2) return;
    navigate({ to: "/compare", search: { a: selected[0]!, b: selected[1]! } });
  };

  const confirmDelete = async () => {
    const scanId = pendingDelete?.scan_id;
    if (!scanId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteScan(scanId);
      setSelected((prev) => prev.filter((id) => id !== scanId));
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["audit-history"] });
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete this audit.");
    } finally {
      setDeleting(false);
    }
  };

  const canCompare = (row: AuditHistoryRow) => Boolean(row.scan_id) && row.scan_status === "completed";

  const scopeToggle = data?.canSeeTeam ? (
    <div className="inline-flex rounded-lg border border-[#D9E2E8] bg-white p-0.5" role="group" aria-label="Whose audits">
      {(
        [
          ["mine", "My audits"],
          ["team", "Everyone in my stores"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={scope === value}
          onClick={() => {
            setScope(value);
            setSelected([]);
            pager.setPage(0);
          }}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            scope === value ? "bg-[#04203F] text-white" : "text-[#667085] hover:bg-[#F4F7F9] hover:text-[#04203F]",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <AppShell title="" hidePageHeader>
      <div className="play-canvas space-y-5">
        <PageHeader
          title="Audit history"
          description={
            scope === "team"
              ? "Every audit in your stores — open any report, or filter by store, date, status and people."
              : "Every audit you ran or assigned — open any report, or filter by store, date, status and people."
          }
          actions={scopeToggle}
        />

        <section className="space-y-3 rounded-xl border border-[#D9E2E8] bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            <FilterSearch
              value={filters.q}
              onChange={(value) => setFilters({ q: value })}
              placeholder="Search store, audit ID, location, category or person…"
            />
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-3 text-sm font-medium text-[#04203F] transition-colors hover:bg-[#F4F7F9]",
                activeCount > 0 ? "border-[#04203F]/40" : "border-[#D9E2E8]",
              )}
            >
              <SlidersHorizontal className="size-4 text-[#667085]" aria-hidden />
              Filters{activeCount > 0 ? ` (${activeCount})` : ""}
              <ChevronDown className={cn("size-4 text-[#667085] transition-transform", filtersOpen && "rotate-180")} aria-hidden />
            </button>
            <Select value={filters.sort} onValueChange={(v) => setFilters({ sort: v as AuditHistoryFilters["sort"] })}>
              <SelectTrigger className="h-10 w-[150px] rounded-lg" aria-label="Sort audits">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtersOpen ? (
            <div className="grid gap-3 border-t border-[#D9E2E8] pt-3 sm:grid-cols-2 lg:grid-cols-4">
              <FilterField label="Store">
                <OptionSelect
                  value={filters.store}
                  onChange={(v) => setFilters({ store: v })}
                  allLabel="All stores"
                  options={options.stores}
                  ariaLabel="Filter by store"
                />
              </FilterField>
              <FilterField label="From">
                <Input
                  type="date"
                  value={filters.dateFrom}
                  max={filters.dateTo || undefined}
                  onChange={(e) => setFilters({ dateFrom: e.target.value })}
                  className="h-10 rounded-lg"
                  aria-label="From date"
                />
              </FilterField>
              <FilterField label="To">
                <Input
                  type="date"
                  value={filters.dateTo}
                  min={filters.dateFrom || undefined}
                  onChange={(e) => setFilters({ dateTo: e.target.value })}
                  className="h-10 rounded-lg"
                  aria-label="To date"
                />
              </FilterField>
              <FilterField label="Status">
                <OptionSelect
                  value={filters.status}
                  onChange={(v) => setFilters({ status: v as AuditHistoryFilters["status"] })}
                  allLabel="All statuses"
                  options={STATUS_ORDER.map((id) => ({ id, name: AUDIT_HISTORY_STATUS_LABELS[id] }))}
                  ariaLabel="Filter by status"
                />
              </FilterField>
              <FilterField label="Assigned to">
                <OptionSelect
                  value={filters.assignee}
                  onChange={(v) => setFilters({ assignee: v })}
                  allLabel="Anyone"
                  options={options.assignees}
                  ariaLabel="Filter by assignee"
                />
              </FilterField>
              <FilterField label="Conducted by">
                <OptionSelect
                  value={filters.conductedBy}
                  onChange={(v) => setFilters({ conductedBy: v })}
                  allLabel="Anyone"
                  options={options.conductors}
                  ariaLabel="Filter by who conducted the audit"
                />
              </FilterField>
              <FilterField label="Type">
                <OptionSelect
                  value={filters.type}
                  onChange={(v) => setFilters({ type: v as AuditHistoryFilters["type"] })}
                  allLabel="All types"
                  options={[
                    { id: "assigned", name: "Assigned" },
                    { id: "adhoc", name: "Ad hoc" },
                    { id: "recurring", name: "Recurring" },
                    { id: "scheduled", name: "Scheduled" },
                  ]}
                  ariaLabel="Filter by audit type"
                />
              </FilterField>
              <FilterField label="Mode">
                <OptionSelect
                  value={filters.mode}
                  onChange={(v) => setFilters({ mode: v as AuditHistoryFilters["mode"] })}
                  allLabel="AI and Digital"
                  options={[
                    { id: "ai", name: "AI audit" },
                    { id: "digital", name: "Digital audit" },
                  ]}
                  ariaLabel="Filter by audit mode"
                />
              </FilterField>
            </div>
          ) : null}

          {narrowed ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
              <span>
                {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} audits match
              </span>
              <Button variant="ghost" size="sm" className="h-7 rounded-lg px-2 text-xs" onClick={clearFilters}>
                Clear all
              </Button>
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-[#D9E2E8] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#04203F]">Compare audits</p>
            <p className="mt-1 text-xs text-[#667085] sm:text-sm">
              Tick two finished audits to compare inventory changes between them.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs text-[#667085]">{selected.length}/2 selected</span>
            <Button variant="brand" size="sm" className="rounded-lg" disabled={selected.length !== 2} onClick={compare}>
              <ArrowLeftRight className="size-4" /> Compare
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-[#D9E2E8] bg-white">
          {isPending ? (
            <div className="p-4">
              <TableSkeleton rows={6} cols={6} />
            </div>
          ) : isError ? (
            <div className="p-4">
              <ErrorState
                title="Couldn't load audit history"
                description={error instanceof Error ? error.message : undefined}
                onRetry={() => void refetch()}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={narrowed ? <SearchX className="size-5" /> : undefined}
                title={narrowed ? "No audits match your filters" : "No audits yet"}
                description={
                  narrowed
                    ? "Try another store, date range, status or person."
                    : "Audits you run or assign will appear here."
                }
                action={
                  narrowed ? (
                    <Button variant="subtle" size="sm" className="rounded-lg" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button variant="brand" size="sm" className="rounded-lg" asChild>
                      <Link to="/new-audit" search={NEW_AUDIT_SEARCH}>
                        New audit
                      </Link>
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Audit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Assigned to</TableHead>
                      <TableHead>Conducted by</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Products</TableHead>
                      <TableHead className="text-right">Compliance</TableHead>
                      <TableHead className="sticky right-0 bg-white text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((row) => (
                      <TableRow key={row.key} className="group transition-colors hover:bg-[#F4F7F9]">
                        <TableCell>
                          {canCompare(row) ? (
                            <Checkbox
                              checked={selected.includes(row.scan_id!)}
                              onCheckedChange={() => toggleSelected(row.scan_id!)}
                              aria-label={`Select audit ${row.scan_id!.slice(0, 8)} for comparison`}
                            />
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="truncate font-medium text-[#04203F]" title={rowTitle(row)}>
                              {rowTitle(row)}
                            </p>
                            <ScheduleLabel row={row} />
                          </div>
                          <p className="truncate text-xs text-[#667085]" title={row.scan_id ?? row.assignment_id ?? ""}>
                            {rowSubtitle(row)}
                          </p>
                        </TableCell>
                        <TableCell>
                          <RowStatus row={row} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-[#667085]">
                          <DateCell row={row} />
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-sm">{row.assignee_name ?? "—"}</TableCell>
                        <TableCell className="max-w-[160px] truncate text-sm">{row.conducted_by_name ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-[#667085]">{rowType(row)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(row.products_detected ?? undefined)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-[#04203F]">
                          {formatCompliance(row.compliance)}
                        </TableCell>
                        <TableCell className="sticky right-0 border-l border-[#D9E2E8] bg-white text-right transition-colors group-hover:bg-[#F4F7F9]">
                          <div className="flex items-center justify-end gap-1">
                            <RowCta
                              row={row}
                              userId={userId}
                              canManageSeries={Boolean(row.series && canManageSeries(row.series))}
                            />
                            <RowActions row={row} access={rowAccess} onDelete={setPendingDelete} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="divide-y divide-[#D9E2E8] md:hidden">
                {pageRows.map((row) => (
                  <li key={row.key} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        {canCompare(row) ? (
                          <Checkbox
                            className="mt-0.5"
                            checked={selected.includes(row.scan_id!)}
                            onCheckedChange={() => toggleSelected(row.scan_id!)}
                            aria-label={`Select audit ${row.scan_id!.slice(0, 8)} for comparison`}
                          />
                        ) : null}
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="truncate text-sm font-semibold text-[#04203F]">{rowTitle(row)}</p>
                            <ScheduleLabel row={row} />
                          </div>
                          <p className="mt-0.5 truncate text-xs text-[#667085]">{rowSubtitle(row)}</p>
                        </div>
                      </div>
                      <RowStatus row={row} />
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      {(row.series
                        ? [
                            { l: "Schedule", v: seriesSchedule(row.series) },
                            { l: "Assigned to", v: row.assignee_name ?? "—" },
                            { l: "Type", v: rowType(row) },
                          ]
                        : [
                            {
                              l: row.scan_id ? "Date" : "Assigned",
                              v: `${formatScanDate(row.date)}${row.scan_id ? ` ${formatScanTime(row.date)}` : ""}`,
                            },
                            ...(row.scan_id
                              ? []
                              : [{ l: isOverdue(row) ? "Overdue · due" : "Due", v: formatScanDate(row.due_at ?? undefined) }]),
                            { l: "Assigned to", v: row.assignee_name ?? "—" },
                            { l: "Conducted by", v: row.conducted_by_name ?? "—" },
                            { l: "Type", v: rowType(row) },
                            { l: "Compliance", v: formatCompliance(row.compliance) },
                          ]
                      ).map((item) => (
                        <div key={item.l} className="min-w-0">
                          <dt className="text-[#667085]">{item.l}</dt>
                          <dd className="mt-0.5 truncate font-medium tabular-nums text-[#04203F]">{item.v}</dd>
                        </div>
                      ))}
                    </dl>

                    <div className="mt-3 flex items-center gap-2">
                      <RowCta
                        row={row}
                        userId={userId}
                        canManageSeries={Boolean(row.series && canManageSeries(row.series))}
                        className="flex-1"
                      />
                      <RowActions row={row} access={rowAccess} onDelete={setPendingDelete} />
                    </div>
                  </li>
                ))}
              </ul>

              <TablePager pager={pager} noun="audits" className="border-t border-[#D9E2E8]" />
              {data?.truncated ? (
                <p className="border-t border-[#D9E2E8] px-3 py-2 text-xs text-[#667085]">
                  Showing the latest 5,000 audits.
                </p>
              ) : null}
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
              Audit {pendingDelete?.scan_id?.slice(0, 8)} for {pendingDelete?.store} will be permanently removed, along
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
