import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { MpBadge } from "@/components/design-system/MpBadge";
import { MpFilterCard } from "@/components/design-system/MpFilterCard";
import { PageHeader } from "@/components/design-system/PageHeader";
import { KpiCard } from "@/components/audit-governance/KpiCard";
import { SLAIndicator } from "@/components/audit-governance/SLAIndicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { complianceTone, issueLabel } from "@/lib/planogram-compliance";
import {
  ACTION_STATUSES,
  actionStatusClass,
  fetchCorrectiveActions,
  updateCorrectiveActionStatus,
  type ActionStatus,
} from "@/lib/corrective-actions";
import {
  fetchLifecycleActions,
  lifecycleActionsKpis,
} from "@/lib/corrective-action-lifecycle";
import { formatDate } from "@/routes/my-scans";
import { isOrgManager, requestReScan } from "@/lib/assignments";
import { useGlobalFilters } from "@/lib/global-filters";
import { formatAssignmentId } from "@/components/AssignmentId";

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
  component: CorrectiveActionsPage,
});

function CorrectiveActionsPage() {
  return (
    <AppShell title="" hidePageHeader>
      <CorrectiveActionsMain />
    </AppShell>
  );
}

function CorrectiveActionsMain() {
  const queryClient = useQueryClient();
  const { filters: globalFilters } = useGlobalFilters();
  const [status, setStatus] = useState("all");
  const [store, setStore] = useState(globalFilters.storeId !== "all" ? globalFilters.storeId : "all");
  const [assignee, setAssignee] = useState("all");

  const managerQuery = useQuery({
    queryKey: ["is-org-manager"],
    queryFn: () => isOrgManager(),
    retry: false,
    staleTime: 60_000,
  });
  const isManager = managerQuery.data === true;

  const query = useQuery({
    queryKey: ["corrective-actions"],
    queryFn: () => fetchCorrectiveActions(),
    retry: false,
  });

  const lifecycleQuery = useQuery({
    queryKey: ["lifecycle-actions", globalFilters.storeId],
    queryFn: () =>
      fetchLifecycleActions({
        storeId: globalFilters.storeId !== "all" ? globalFilters.storeId : undefined,
      }),
    retry: false,
  });
  const lifecycleKpis = useMemo(
    () => lifecycleActionsKpis(lifecycleQuery.data ?? []),
    [lifecycleQuery.data],
  );
  const lifecycleById = useMemo(
    () => new Map((lifecycleQuery.data ?? []).map((a) => [a.id, a])),
    [lifecycleQuery.data],
  );

  const mutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ActionStatus }) =>
      updateCorrectiveActionStatus(id, next),
    onSuccess: () => {
      toast.success("Action updated");
      void queryClient.invalidateQueries({ queryKey: ["corrective-actions"] });
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

  const reScanMutation = useMutation({
    mutationFn: async (assignmentIds: string[]) => {
      for (const id of assignmentIds) await requestReScan(id);
    },
    onSuccess: (_data, ids) => toast.success(`Re-audit requested for ${ids.length} assignment(s)`),
    onError: (error) => toast.error(toUserMessage(error)),
  });

  const all = query.data ?? [];
  const stores = useMemo(() => [...new Set(all.map((row) => row.store_name))].sort(), [all]);
  const assignees = useMemo(() => [...new Set(all.map((row) => row.assignee_name))].sort(), [all]);

  const rows = all.filter((row) => {
    if (status !== "all" && row.status !== status) return false;
    if (store !== "all" && row.store_name !== store) return false;
    if (assignee !== "all" && row.assignee_name !== assignee) return false;
    return true;
  });

  return (
    <div className="space-y-4">
        <PageHeader
          eyebrow="Exceptions"
          title="Corrective Actions"
          description="Every fix raised by planogram comparisons, tracked to resolution."
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
            <SelectTrigger className="w-40 rounded-lg border-line bg-canvas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ACTION_STATUSES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={store} onValueChange={setStore}>
            <SelectTrigger className="w-44 rounded-lg border-line bg-canvas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stores</SelectItem>
              {stores.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
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
          {isManager && (
            <Button
              variant="subtle"
              className="rounded-xl"
              disabled={reScanMutation.isPending}
              onClick={() => {
                const ids = [
                  ...new Set(
                    rows
                      .filter((row) => row.status !== "resolved" && row.assignment_id)
                      .map((row) => row.assignment_id as string),
                  ),
                ];
                if (!ids.length) {
                  toast.error("No open assignments to re-audit.");
                  return;
                }
                reScanMutation.mutate(ids);
              }}
            >
              Request re-audit
            </Button>
          )}
        </div>
        </MpFilterCard>

        {query.isLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : query.isError ? (
          <ErrorState
            description={toUserMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : !rows.length ? (
          <EmptyState
            icon={<Wrench className="size-6" />}
            title="No corrective actions"
            description="Corrective actions appear here once an assigned audit is compared against its planogram."
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
              <table className="w-full text-sm">
                <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Store</th>
                    <th className="px-4 py-3 text-left font-medium">Product / issue</th>
                    <th className="px-4 py-3 text-left font-medium">Suggestion</th>
                    <th className="px-4 py-3 text-left font-medium">Assignee</th>
                    <th className="px-4 py-3 text-left font-medium">Compliance</th>
                    <th className="px-4 py-3 text-left font-medium">Audit date</th>
                    <th className="px-4 py-3 text-left font-medium">SLA</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const lifecycle = lifecycleById.get(row.id);
                    return (
                    <tr key={row.id} className="border-t border-border align-top">
                      <td className="px-4 py-3 text-foreground">{row.store_name}</td>
                      <td className="px-4 py-3">
                        <Link
                          to="/corrective-actions/$actionId"
                          params={{ actionId: row.id }}
                          className="font-medium text-foreground hover:underline"
                        >
                          {row.product ?? "—"}
                        </Link>
                        <Badge
                          variant="secondary"
                          className="ml-2 rounded-full border-0 text-xs"
                        >
                          {issueLabel(row.issue_type)}
                        </Badge>
                      </td>
                      <td className="max-w-sm px-4 py-3 text-muted-foreground">
                        {row.suggestion}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {row.assignee_name}
                        {row.scan_id && (
                          <Link
                            to="/results"
                            search={{ scan: row.scan_id }}
                            className="block text-xs text-brand hover:underline"
                          >
                            View results
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.compliance_percent === null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={`text-sm font-semibold ${complianceTone(row.compliance_percent)}`}
                          >
                            {Math.round(row.compliance_percent)}%
                          </span>
                        )}
                        {row.assignment_id && (
                          <Link
                            to="/assigned-scans"
                            search={{ tab: "assignments" as const }}
                            className="block font-mono text-xs text-brand hover:underline"
                          >
                            {formatAssignmentId(row.assignment_id)}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(row.scan_date)}
                      </td>
                      <td className="px-4 py-3">
                        {lifecycle?.due_at ? (
                          <SLAIndicator dueAt={lifecycle.due_at} status={lifecycle.status} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isManager ? (
                          <Select
                            value={row.status}
                            onValueChange={(next) =>
                              mutation.mutate({ id: row.id, next: next as ActionStatus })
                            }
                          >
                            <SelectTrigger className="w-36 rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ACTION_STATUSES.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div>
                            <Badge
                              variant="secondary"
                              className={`rounded-full border-0 ${actionStatusClass(row.status)}`}
                            >
                              {row.status.replace(/_/g, " ")}
                            </Badge>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Closes automatically when a re-audit shows it fixed.
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {rows.map((row) => {
                const lifecycle = lifecycleById.get(row.id);
                return (
                <div
                  key={row.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{row.store_name}</p>
                    <Badge
                      variant="secondary"
                      className={`rounded-full border-0 ${actionStatusClass(row.status)}`}
                    >
                      {row.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-foreground">
                    {row.product ?? "—"} · {issueLabel(row.issue_type)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{row.suggestion}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.assignee_name} · {formatDate(row.scan_date)}
                  </p>
                  {lifecycle?.due_at ? (
                    <SLAIndicator dueAt={lifecycle.due_at} status={lifecycle.status} className="mt-2" />
                  ) : null}
                  <Link
                    to="/corrective-actions/$actionId"
                    params={{ actionId: row.id }}
                    className="mt-2 inline-block text-xs text-brand hover:underline"
                  >
                    Open detail
                  </Link>
                  <div className="mt-3">
                    {!isManager ? (
                      <p className="text-xs text-muted-foreground">
                        Closes automatically when a re-audit shows it fixed.
                      </p>
                    ) : (
                    <Select
                      value={row.status}
                      onValueChange={(next) =>
                        mutation.mutate({ id: row.id, next: next as ActionStatus })
                      }
                    >
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_STATUSES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    )}
                  </div>
                </div>
              );})}
            </div>
          </>
        )}
    </div>
  );
}
