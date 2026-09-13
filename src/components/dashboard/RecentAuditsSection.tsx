import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/States";
import type { RecentAuditRow, RecentAuditStatus, WorkspaceDashboardData } from "@/lib/dashboard-intelligence";
import { dashboardFiltersToHistorySearch, type DashboardFilterState } from "@/lib/dashboard-filters";
import { cn } from "@/lib/utils";

function formatAuditDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatAuditTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatKpiPercent(value: number | null): string {
  return value !== null ? `${Math.round(value)}%` : "—";
}

const STATUS_META: Record<
  RecentAuditStatus,
  { label: string; className: string }
> = {
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

function AuditStatusPill({ status }: { status: RecentAuditStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.completed;
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

function storeCityForRow(
  row: RecentAuditRow,
  options: WorkspaceDashboardData["filter_options"],
): string | null {
  if (!row.store_id) return null;
  return options.stores.find((s) => s.id === row.store_id)?.city ?? null;
}

function openAudit(navigate: ReturnType<typeof useNavigate>, row: RecentAuditRow) {
  void navigate({
    to: "/results",
    search: { audit: row.scan_id },
  });
}

function AuditRowDesktop({
  row,
  options,
  onOpen,
}: {
  row: RecentAuditRow;
  options: WorkspaceDashboardData["filter_options"];
  onOpen: () => void;
}) {
  const city = storeCityForRow(row, options);

  return (
    <tr
      className="group cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-brand-soft/25"
      onClick={onOpen}
    >
      <td className="py-2.5 pl-5 pr-3 align-middle">
        <div className="font-medium text-brand">{formatAuditDate(row.date)}</div>
        <div className="text-[10px] tabular-nums text-muted-foreground">{formatAuditTime(row.date)}</div>
      </td>
      <td className="py-2.5 pr-3 align-middle">
        <div className="max-w-[9rem] truncate font-medium text-foreground">{row.store_name}</div>
        {city ? <div className="truncate text-[10px] text-muted-foreground">{city}</div> : null}
      </td>
      <td className="py-2.5 pr-3 align-middle text-[11px] text-foreground">{row.role}</td>
      <td className="max-w-[7rem] py-2.5 pr-3 align-middle">
        <div className="truncate text-[11px] text-foreground">{row.category ?? "—"}</div>
        {row.sub_category ? (
          <div className="truncate text-[10px] text-muted-foreground">{row.sub_category}</div>
        ) : null}
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

function AuditCardMobile({
  row,
  options,
  onOpen,
}: {
  row: RecentAuditRow;
  options: WorkspaceDashboardData["filter_options"];
  onOpen: () => void;
}) {
  const city = storeCityForRow(row, options);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-xl border border-border/60 bg-card p-3.5 text-left shadow-sm transition-colors hover:border-brand/20 hover:bg-brand-soft/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.store_name}</p>
          {city ? <p className="truncate text-[10px] text-muted-foreground">{city}</p> : null}
          <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
            {formatAuditDate(row.date)} · {formatAuditTime(row.date)}
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
          {row.sub_category ? (
            <p className="truncate text-[10px] text-muted-foreground">{row.sub_category}</p>
          ) : null}
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
}: {
  data: WorkspaceDashboardData;
  filters: DashboardFilterState;
}) {
  const navigate = useNavigate();
  const historySearch = dashboardFiltersToHistorySearch(filters, data.filter_options);

  return (
    <section className="mt-8">
      <div className="mb-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Recent audits
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Open any audit to review the shelf, results, issues and actions from that visit.
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
        {!data.recent_audits.length ? (
          <div className="p-6 sm:p-8">
            <EmptyState
              title="No audits found"
              description="Try changing your filters or complete a new shelf audit."
              action={
                <Button asChild variant="brand" size="sm" className="rounded-xl">
                  <Link to="/scan">
                    Start New Audit <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[960px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 pb-2.5 pt-4 pr-3">Date</th>
                    <th className="pb-2.5 pr-3 pt-4">Store</th>
                    <th className="pb-2.5 pr-3 pt-4">Role</th>
                    <th className="pb-2.5 pr-3 pt-4">Category</th>
                    <th className="pb-2.5 pr-3 pt-4">OSA</th>
                    <th className="pb-2.5 pr-3 pt-4">Planogram</th>
                    <th className="pb-2.5 pr-3 pt-4">Issues</th>
                    <th className="pb-2.5 pr-3 pt-4">Assigned To</th>
                    <th className="pb-2.5 pr-3 pt-4">Status</th>
                    <th className="px-5 pb-2.5 pt-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="px-5">
                  {data.recent_audits.map((row) => (
                    <AuditRowDesktop
                      key={row.scan_id}
                      row={row}
                      options={data.filter_options}
                      onOpen={() => openAudit(navigate, row)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2.5 p-4 md:hidden">
              {data.recent_audits.map((row) => (
                <AuditCardMobile
                  key={row.scan_id}
                  row={row}
                  options={data.filter_options}
                  onOpen={() => openAudit(navigate, row)}
                />
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end border-t border-border/40 px-5 py-3">
          <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg text-xs text-muted-foreground hover:text-brand">
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
