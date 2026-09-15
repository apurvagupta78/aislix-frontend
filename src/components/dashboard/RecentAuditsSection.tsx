import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/States";
import { DashboardCompactFilterToolbar } from "@/components/dashboard/DashboardFilterBar";
import {
  buildRecentAuditsKpiCards,
  exportRecentAuditsCsv,
  filterRecentAudits,
  formatAuditDateDisplay,
  formatAuditTimeDisplay,
  formatKpiPercent,
  sortRecentAudits,
  type RecentAuditSortKey,
  type RecentAuditStatusFilter,
  type SortDirection,
} from "@/components/dashboard/recent-audits-utils";
import type { RecentAuditRow, RecentAuditStatus, WorkspaceDashboardData } from "@/lib/dashboard-intelligence";
import {
  DEFAULT_DASHBOARD_FILTERS,
  dashboardFiltersToHistorySearch,
  isDefaultDashboardFilters,
  type DashboardFilterState,
} from "@/lib/dashboard-filters";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const STATUS_META: Record<RecentAuditStatus, { label: string; className: string }> = {
  completed: {
    label: "Completed",
    className: "bg-accent-green/10 text-accent-green ring-accent-green/15",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-brand-soft text-brand ring-brand/15",
  },
  needs_action: {
    label: "Needs Action",
    className: "bg-amber-500/10 text-amber-700 ring-amber-500/15",
  },
  draft: {
    label: "Draft",
    className: "bg-muted/80 text-muted-foreground ring-border/60",
  },
  failed: {
    label: "Failed",
    className: "bg-destructive/10 text-destructive ring-destructive/15",
  },
};

const STATUS_FILTER_OPTIONS: { value: RecentAuditStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "in_progress", label: "In Progress" },
  { value: "needs_action", label: "Needs Action" },
  { value: "draft", label: "Draft" },
  { value: "failed", label: "Failed" },
];

function AuditStatusPill({ status }: { status: RecentAuditStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}

function KpiChip({ value, muted }: { value: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[2.5rem] items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ring-1 ring-inset",
        muted
          ? "bg-muted/40 text-muted-foreground ring-border/50"
          : "bg-brand-soft/50 text-brand ring-brand/10",
      )}
    >
      {value}
    </span>
  );
}

function IssueChip({ count }: { count: number }) {
  const hasIssues = count > 0;
  return (
    <span
      className={cn(
        "inline-flex min-w-[1.5rem] items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ring-1 ring-inset",
        hasIssues
          ? "bg-amber-500/10 text-amber-700 ring-amber-500/15"
          : "bg-muted/40 text-muted-foreground ring-border/50",
      )}
    >
      {count}
    </span>
  );
}

function SectionKpiCardView({
  label,
  value,
  description,
  detail,
}: {
  label: string;
  value: string;
  description: string;
  detail?: string | null;
}) {
  const isMuted = value === "Not enough data" || value === "—";
  return (
    <div className="rounded-xl border border-border/60 bg-card px-3.5 py-3 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums tracking-tight",
          isMuted ? "text-sm font-medium text-muted-foreground" : "text-brand",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
      {detail ? <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: RecentAuditSortKey;
  activeKey: RecentAuditSortKey;
  direction: SortDirection;
  onSort: (key: RecentAuditSortKey) => void;
  align?: "left" | "right";
}) {
  const active = activeKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        "inline-flex items-center gap-0.5 transition-colors hover:text-foreground",
        align === "right" && "ml-auto",
        active ? "text-brand" : "text-muted-foreground",
      )}
    >
      {label}
      {active ? (
        direction === "asc" ? (
          <ArrowUp className="size-3" />
        ) : (
          <ArrowDown className="size-3" />
        )
      ) : (
        <ArrowUpDown className="size-3 opacity-40" />
      )}
    </button>
  );
}

function openAudit(navigate: ReturnType<typeof useNavigate>, row: RecentAuditRow) {
  void navigate({ to: "/results", search: { audit: row.scan_id } });
}

function AuditRowDesktop({
  row,
  onOpen,
}: {
  row: RecentAuditRow;
  onOpen: () => void;
}) {
  return (
    <tr
      className="group cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-brand-soft/25"
      onClick={onOpen}
    >
      <td className="py-2.5 pl-5 pr-3 align-middle">
        <div className="font-medium text-brand">{formatAuditDateDisplay(row.date)}</div>
        <div className="text-[10px] tabular-nums text-muted-foreground">{formatAuditTimeDisplay(row.date)}</div>
        <div className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground/70">{row.scan_id.slice(0, 8)}</div>
      </td>
      <td className="py-2.5 pr-3 align-middle">
        <div className="max-w-[9rem] truncate font-medium text-foreground">{row.store_name}</div>
        {row.store_city ? (
          <div className="truncate text-[10px] text-muted-foreground">{row.store_city}</div>
        ) : null}
      </td>
      <td className="py-2.5 pr-3 align-middle text-[11px] text-foreground">{row.role}</td>
      <td className="max-w-[6rem] py-2.5 pr-3 align-middle">
        <div className="truncate text-[11px] text-foreground">{row.category ?? "—"}</div>
      </td>
      <td className="max-w-[6rem] py-2.5 pr-3 align-middle">
        <div className="truncate text-[11px] text-muted-foreground">{row.sub_category ?? "—"}</div>
      </td>
      <td className="py-2.5 pr-3 align-middle">
        <KpiChip value={formatKpiPercent(row.osa)} muted={row.osa === null} />
      </td>
      <td className="py-2.5 pr-3 align-middle">
        <KpiChip value={formatKpiPercent(row.planogram)} muted={row.planogram === null} />
      </td>
      <td className="py-2.5 pr-3 align-middle">
        <IssueChip count={row.issues} />
      </td>
      <td className="max-w-[6.5rem] py-2.5 pr-3 align-middle">
        <span className="block truncate text-[11px] text-muted-foreground">
          {row.assigned_to ?? "Unassigned"}
        </span>
      </td>
      <td className="py-2.5 pr-3 align-middle">
        <AuditStatusPill status={row.status} />
      </td>
      <td className="py-2.5 pr-5 align-middle text-right">
        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-brand opacity-80 transition-opacity group-hover:opacity-100">
          View
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </td>
    </tr>
  );
}

function AuditCardMobile({ row, onOpen }: { row: RecentAuditRow; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-xl border border-border/60 bg-card p-3.5 text-left shadow-sm transition-colors hover:border-brand/20 hover:bg-brand-soft/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.store_name}</p>
          {row.store_city ? <p className="truncate text-[10px] text-muted-foreground">{row.store_city}</p> : null}
          <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
            {formatAuditDateDisplay(row.date)} · {formatAuditTimeDisplay(row.date)}
          </p>
        </div>
        <AuditStatusPill status={row.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Role</p>
          <p className="mt-0.5 text-foreground">{row.role}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Category</p>
          <p className="mt-0.5 truncate text-foreground">{row.category ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">OSA</p>
          <div className="mt-1">
            <KpiChip value={formatKpiPercent(row.osa)} muted={row.osa === null} />
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Planogram</p>
          <div className="mt-1">
            <KpiChip value={formatKpiPercent(row.planogram)} muted={row.planogram === null} />
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Issues</p>
          <div className="mt-1">
            <IssueChip count={row.issues} />
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Assigned to</p>
          <p className="mt-0.5 truncate text-muted-foreground">{row.assigned_to ?? "Unassigned"}</p>
        </div>
      </div>
      <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-brand">
        View Audit
        <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
      </p>
    </button>
  );
}

export function RecentAuditsSection({
  data,
  filters,
  onFiltersChange,
}: {
  data: WorkspaceDashboardData;
  filters: DashboardFilterState;
  onFiltersChange: (next: DashboardFilterState) => void;
}) {
  const navigate = useNavigate();
  const historySearch = dashboardFiltersToHistorySearch(filters, data.filter_options);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RecentAuditStatusFilter>("all");
  const [sortKey, setSortKey] = useState<RecentAuditSortKey>("date");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);

  const kpiCards = useMemo(() => buildRecentAuditsKpiCards(data, filters), [data, filters]);

  const processedRows = useMemo(() => {
    const filtered = filterRecentAudits(data.recent_audits, search, statusFilter);
    return sortRecentAudits(filtered, sortKey, sortDir);
  }, [data.recent_audits, search, statusFilter, sortKey, sortDir]);

  const totalRows = processedRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = processedRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSort = (key: RecentAuditSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
    setPage(1);
  };

  const filtersActive =
    !isDefaultDashboardFilters(filters) || search.trim().length > 0 || statusFilter !== "all";

  const clearAll = () => {
    onFiltersChange({ ...DEFAULT_DASHBOARD_FILTERS });
    setSearch("");
    setStatusFilter("all");
    setPage(1);
  };

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Recent audits
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Open any audit to review the shelf, results, issues and actions from that visit.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg border-border/60 text-xs"
          onClick={() => exportRecentAuditsCsv(processedRows)}
          disabled={!processedRows.length}
        >
          <Download className="size-3.5" />
          Export Audits
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {kpiCards.map((card) => (
          <SectionKpiCardView key={card.key} {...card} />
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="space-y-2 border-b border-border/40 p-3 sm:p-4">
          <DashboardCompactFilterToolbar
            filters={filters}
            onChange={(next) => {
              onFiltersChange(next);
              setPage(1);
            }}
            options={data.filter_options}
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search audits"
                aria-label="Search audits"
                className="h-8 rounded-lg border-border/60 pl-8 text-xs"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as RecentAuditStatusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[140px] rounded-lg text-xs" aria-label="Status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtersActive ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg text-xs text-muted-foreground"
                onClick={clearAll}
              >
                <X className="size-3.5" />
                Clear filters
              </Button>
            ) : null}
          </div>
        </div>

        {!processedRows.length ? (
          <div className="p-6 sm:p-8">
            <EmptyState
              title="No audits found"
              description="Try changing your filters or complete a new shelf audit."
              action={
                <Button asChild variant="brand" size="sm" className="rounded-xl">
                  <Link to="/new-audit">
                    Start New Audit <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-4 py-2.5 text-[11px] text-muted-foreground">
              <span>
                Showing {pageRows.length} of {totalRows} audit{totalRows === 1 ? "" : "s"}
              </span>
              {pageCount > 1 ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-lg"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="tabular-nums">
                    Page {safePage} of {pageCount}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-lg"
                    disabled={safePage >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    aria-label="Next page"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1040px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-[10px] font-medium uppercase tracking-wide">
                    <th className="px-5 pb-2.5 pt-3 pr-3">
                      <SortHeader label="Date" sortKey="date" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
                    </th>
                    <th className="pb-2.5 pr-3 pt-3">
                      <SortHeader label="Store" sortKey="store" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
                    </th>
                    <th className="pb-2.5 pr-3 pt-3">
                      <SortHeader label="Role" sortKey="role" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
                    </th>
                    <th className="pb-2.5 pr-3 pt-3">
                      <SortHeader
                        label="Category"
                        sortKey="category"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="pb-2.5 pr-3 pt-3">
                      <SortHeader
                        label="Sub-category"
                        sortKey="sub_category"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="pb-2.5 pr-3 pt-3">
                      <SortHeader label="OSA" sortKey="osa" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
                    </th>
                    <th className="pb-2.5 pr-3 pt-3">
                      <SortHeader
                        label="Planogram"
                        sortKey="planogram"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="pb-2.5 pr-3 pt-3">
                      <SortHeader
                        label="Issues"
                        sortKey="issues"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="pb-2.5 pr-3 pt-3">
                      <SortHeader
                        label="Assigned To"
                        sortKey="assigned_to"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="pb-2.5 pr-3 pt-3">
                      <SortHeader
                        label="Status"
                        sortKey="status"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-5 pb-2.5 pt-3 text-right text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <AuditRowDesktop
                      key={row.scan_id}
                      row={row}
                      onOpen={() => openAudit(navigate, row)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2.5 p-4 lg:hidden">
              {pageRows.map((row) => (
                <AuditCardMobile key={row.scan_id} row={row} onOpen={() => openAudit(navigate, row)} />
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end border-t border-border/40 px-5 py-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg text-xs text-muted-foreground hover:text-brand"
          >
            <Link to="/history" search={historySearch}>
              View Full Audit History
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
