import { useMemo, useState } from "react";
import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MpBadge } from "@/components/design-system/MpBadge";
import { MpFilterCard } from "@/components/design-system/MpFilterCard";
import { PageHeader } from "@/components/design-system/PageHeader";
import { KpiCard } from "@/components/audit-governance/KpiCard";
import { SLAIndicator } from "@/components/audit-governance/SLAIndicator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import {
  LIFECYCLE_STATUSES,
  fetchLifecycleActions,
  lifecycleActionsKpis,
  type LifecycleActionStatus,
} from "@/lib/corrective-action-lifecycle";
import { formatDate } from "@/routes/my-scans";
import { useGlobalFilters } from "@/lib/global-filters";

export const Route = createFileRoute("/corrective-actions")({
  head: () => ({
    meta: [
      { title: "Corrective Actions — Close shelf gaps | Aislix" },
      {
        name: "description",
        content:
          "Track and resolve every corrective action raised by planogram comparisons across your stores and team.",
      },
      { property: "og:title", content: "Corrective Actions — Aislix" },
      {
        property: "og:description",
        content: "Assign, track and resolve shelf corrective actions raised by AI shelf audits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CorrectiveActionsLayout,
});

/** Nested /corrective-actions/$actionId needs an Outlet or the list page stays stuck. */
function CorrectiveActionsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isIndex =
    pathname === "/corrective-actions" || pathname === "/corrective-actions/";
  if (!isIndex) return <Outlet />;
  return (
    <AppShell title="" hidePageHeader>
      <CorrectiveActionsMain />
    </AppShell>
  );
}

function statusTone(status: string): string {
  if (status === "closed" || status === "resolved") return "bg-success/10 text-success";
  if (status === "overdue" || status === "rejected") {
    return "bg-[var(--aislix-critical-bg,#FFEAF1)] text-[var(--aislix-navy,#102A43)]";
  }
  if (status === "in_progress" || status === "pending_verification") {
    return "bg-brand-soft text-brand";
  }
  return "bg-warning/10 text-warning";
}

function CorrectiveActionsMain() {
  const { filters: globalFilters } = useGlobalFilters();
  const [status, setStatus] = useState("all");
  const [assignee, setAssignee] = useState("all");

  const lifecycleQuery = useQuery({
    queryKey: ["lifecycle-actions", globalFilters.storeId, status],
    queryFn: () =>
      fetchLifecycleActions({
        storeId: globalFilters.storeId !== "all" ? globalFilters.storeId : undefined,
        status: status !== "all" ? status : undefined,
      }),
    retry: false,
  });
  const lifecycleKpis = useMemo(
    () => lifecycleActionsKpis(lifecycleQuery.data ?? []),
    [lifecycleQuery.data],
  );

  const all = lifecycleQuery.data ?? [];
  const assignees = useMemo(
    () => [...new Set(all.map((row) => row.assigned_name).filter(Boolean))].sort(),
    [all],
  );

  const rows = all.filter((row) => {
    if (assignee !== "all" && row.assigned_name !== assignee) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Exceptions"
        title="Corrective Actions"
        description="Every fix from Digital, AI and planogram findings — tracked to verification."
        meta={
          <>
            {lifecycleKpis.overdue > 0 ? (
              <MpBadge tone="attention" dot>
                {lifecycleKpis.overdue} overdue
              </MpBadge>
            ) : null}
            {lifecycleKpis.open > 0 ? (
              <MpBadge tone="active" dot>
                {lifecycleKpis.open} open
              </MpBadge>
            ) : null}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open" value={String(lifecycleKpis.open)} />
        <KpiCard label="Critical" value={String(lifecycleKpis.critical)} />
        <KpiCard label="Due today" value={String(lifecycleKpis.dueToday)} />
        <KpiCard label="Overdue" value={String(lifecycleKpis.overdue)} />
        <KpiCard label="Pending verification" value={String(lifecycleKpis.pending_verification)} />
        <KpiCard label="Resolved" value={String(lifecycleKpis.resolved)} />
        <KpiCard label="Closed" value={String(lifecycleKpis.closed)} />
        <KpiCard
          label="Re-audit improvement %"
          value={
            lifecycleKpis.reaudit_improvement_pct == null
              ? "N/A"
              : `${lifecycleKpis.reaudit_improvement_pct}%`
          }
        />
      </div>

      <MpFilterCard title="Filter actions">
        <div className="flex flex-wrap gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48 rounded-lg border-line bg-canvas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {LIFECYCLE_STATUSES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="w-44 rounded-lg border-line bg-canvas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              {assignees.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </MpFilterCard>

      {lifecycleQuery.isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : lifecycleQuery.isError ? (
        <ErrorState
          description={toUserMessage(lifecycleQuery.error)}
          onRetry={() => void lifecycleQuery.refetch()}
        />
      ) : !rows.length ? (
        <EmptyState
          icon={<Wrench className="size-6" />}
          title="No corrective actions"
          description="Corrective actions appear here once findings are assigned for resolution."
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Action</th>
                  <th className="px-4 py-3 text-left font-medium">Priority</th>
                  <th className="px-4 py-3 text-left font-medium">Assignee</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3 text-left font-medium">SLA</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <Link
                        to="/corrective-actions/$actionId"
                        params={{ actionId: row.id }}
                        className="font-medium text-foreground hover:underline"
                      >
                        {row.title || row.suggestion || "Corrective action"}
                      </Link>
                      {row.sku ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{row.sku}</p>
                      ) : null}
                      {row.scan_id ? (
                        <Link
                          to="/results"
                          search={{ scan: row.scan_id }}
                          className="mt-0.5 block text-xs text-brand hover:underline"
                        >
                          View audit
                        </Link>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 capitalize text-foreground">{row.priority}</td>
                    <td className="px-4 py-3 text-foreground">{row.assigned_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3">
                      {row.due_at ? (
                        <SLAIndicator dueAt={row.due_at} status={row.status} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className={`rounded-full border-0 ${statusTone(row.status)}`}
                      >
                        {row.status.replace(/_/g, " ")}
                      </Badge>
                      <Link
                        to="/corrective-actions/$actionId"
                        params={{ actionId: row.id }}
                        className="mt-1 block text-xs text-brand hover:underline"
                      >
                        Open detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {rows.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    to="/corrective-actions/$actionId"
                    params={{ actionId: row.id }}
                    className="text-sm font-semibold text-foreground hover:underline"
                  >
                    {row.title || row.suggestion || "Corrective action"}
                  </Link>
                  <Badge
                    variant="secondary"
                    className={`rounded-full border-0 ${statusTone(row.status as LifecycleActionStatus)}`}
                  >
                    {row.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground capitalize">
                  {row.priority} · {row.assigned_name} · {formatDate(row.created_at)}
                </p>
                {row.due_at ? (
                  <SLAIndicator dueAt={row.due_at} status={row.status} className="mt-2" />
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
