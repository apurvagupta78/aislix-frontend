import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ClipboardList, ListChecks, Loader2, MapPin, ScanLine } from "lucide-react";
import { CollectionMethodBadge, SyncBadge } from "@/components/audit/AuditStatusBadges";
import { toast } from "sonner";
import {
  flushAiScanQueue,
  isOnline,
  listUnsyncedAssignmentIds,
  pendingCountForAssignment,
} from "@/lib/audit-offline";
import { submitScanImages } from "@/lib/scan-api";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import {
  fetchMyAssignments,
  isOverdue,
  scopeSummary,
  startAssignment,
  type Assignment,
} from "@/lib/assignments";
import { processDueAuditSchedules } from "@/lib/audit-schedules";
import { hideModelNames } from "@/lib/ai-display-text";
import {
  LIFECYCLE_STATUSES,
  fetchMyOpenActions,
  slaRemainingLabel,
  type LifecycleAction,
} from "@/lib/corrective-action-lifecycle";
import { markAssignmentNotificationsRead } from "@/lib/notifications";
import { complianceTone } from "@/lib/planogram-compliance";
import { AssignmentIdChip } from "@/components/AssignmentId";
import { assignmentStatusClassName, assignmentStatusLabel } from "@/lib/assignment-status-ui";

export const Route = createFileRoute("/my-scans")({
  validateSearch: (search: Record<string, unknown>): { tab?: "assigned" | "completed" } => {
    const raw = search["tab"];
    return raw === "completed" || raw === "assigned" ? { tab: raw } : {};
  },

  head: () => ({
    meta: [
      { title: "My work — Aislix audit assignments" },
      {
        name: "description",
        content:
          "Your audit work queue — digital and AI assignments with scope, due dates, and one-tap execution.",
      },
      { property: "og:title", content: "My Work — Aislix" },
      {
        property: "og:description",
        content: "Today, upcoming, overdue and returned audits assigned to you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyScansPage,
});

export function statusBadge(status: Assignment["status"]) {
  return (
    <Badge
      variant="secondary"
      className={`rounded-full border-0 ${assignmentStatusClassName(status)}`}
    >
      {assignmentStatusLabel(status)}
    </Badge>
  );
}

export function formatDate(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type AssignmentTabKey =
  | "today"
  | "upcoming"
  | "overdue"
  | "needs_correction"
  | "unsynced"
  | "completed";

type TabKey = AssignmentTabKey | "actions";

const TABS: { key: TabKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "actions", label: "Corrective actions" },
  { key: "needs_correction", label: "Re-audit Requested" },
  { key: "unsynced", label: "Unsynced" },
  { key: "completed", label: "Approved" },
];

function actionButtonLabel(status: LifecycleAction["status"]): string {
  if (status === "in_progress") return "Continue";
  if (status === "rejected") return "Fix & resubmit";
  return "Start action";
}

/** "Due today 4:38 PM" · "Due tomorrow 1:21 AM" · "Due 12 Oct 1:21 PM" */
function dueDateLabel(dueAt: string | null): string | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  const time = due.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isDueToday(dueAt)) return `Due today ${time}`;
  if (due.toDateString() === tomorrow.toDateString()) return `Due tomorrow ${time}`;
  const date = due.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `Due ${date} ${time}`;
}

function MyActionsList({ actions }: { actions: LifecycleAction[] }) {
  if (!actions.length) {
    return (
      <EmptyState
        icon={<ListChecks className="size-6" />}
        title="No corrective actions"
        description="Corrective actions assigned to you will appear here."
      />
    );
  }
  return (
    <div className="divide-y divide-[#D9E2E8] overflow-hidden rounded-xl border border-[#D9E2E8] bg-white">
      {actions.map((action) => {
        const sla = slaRemainingLabel(action.due_at, action.status);
        const overdue = action.status === "overdue" || sla.startsWith("Overdue");
        const statusLabel =
          action.status === "rejected"
            ? "Sent back"
            : (LIFECYCLE_STATUSES.find((s) => s.value === action.status)?.label ?? action.status);
        const title = hideModelNames(action.title);
        const task = action.suggestion ? hideModelNames(action.suggestion) : "";
        const due = dueDateLabel(action.due_at);
        return (
          <Link
            key={action.id}
            to="/corrective-actions/$actionId"
            params={{ actionId: action.id }}
            className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-[#F4F7F9] sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug text-[#04203F]">
                {action.code ? <span className="mr-1.5 text-xs font-normal text-[#667085]">{action.code}</span> : null}
                {title}
              </p>
              {task && task !== title ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-[#04203F]">
                  <span className="font-medium">To do:</span> {task}
                </p>
              ) : null}
              <p className="mt-0.5 text-xs text-[#667085]">
                {[action.store_name, `${action.priority.charAt(0).toUpperCase()}${action.priority.slice(1)} priority`, statusLabel]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1.5">
              <span className="flex items-center gap-1.5 text-xs text-[#667085]">
                {overdue ? (
                  <Badge variant="secondary" className="rounded-full border-0 bg-destructive/10 text-destructive">
                    {sla.startsWith("Overdue") ? sla : "Overdue"}
                  </Badge>
                ) : (
                  <>
                    <CalendarClock className="size-3.5" />
                    {due ? `${due} · ` : ""}
                    {sla.replace(/ remaining$/, " left")}
                  </>
                )}
              </span>
              {overdue && due ? <span className="hidden text-xs text-[#667085] sm:block">{due}</span> : null}
              <span className="inline-flex items-center rounded-lg bg-[#04203F] px-3 py-1.5 text-xs font-semibold text-white">
                {actionButtonLabel(action.status)}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function isDueToday(dueAt: string | null): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  const now = new Date();
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

function isPastDue(dueAt: string | null): boolean {
  return dueAt !== null && new Date(dueAt).getTime() < Date.now();
}

const TODAY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Today's work: due within the next 24 hours, past its deadline, or no due date at all. */
function isTodayWork(dueAt: string | null): boolean {
  return !dueAt || new Date(dueAt).getTime() - Date.now() <= TODAY_WINDOW_MS;
}

function isLaterWork(dueAt: string | null): boolean {
  return dueAt !== null && !isTodayWork(dueAt);
}

function GroupHeading({ label, count }: { label: string; count: number }) {
  return (
    <h2 className="text-sm font-semibold text-[#04203F]">
      {label} <span className="font-normal text-[#667085]">({count})</span>
    </h2>
  );
}

function startLabel(assignment: Assignment): string {
  const digital = assignment.audit_mode === "digital";
  if (assignment.status === "needs_correction") {
    return digital ? "Fix & re-audit" : "Fix & re-audit";
  }
  if (assignment.status === "in_progress") {
    return digital ? "Continue Digital Audit" : "Continue AI Audit";
  }
  return digital ? "Start Digital Audit" : "Start AI Audit";
}

/** "Test store · A-1-Z · Personal Care · Shampoo · 8 expected products" */
function assignmentLine(assignment: Assignment): string {
  const parts = [assignment.store_name];
  if (assignment.location) parts.push(assignment.location);
  if (assignment.scope_values.category) parts.push(assignment.scope_values.category);
  if (assignment.scope_values.sub_category) parts.push(assignment.scope_values.sub_category);
  parts.push(`${assignment.expected_products} expected products`);
  return parts.join(" · ");
}

function MyScansPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tab: tabParam } = Route.useSearch();
  const [tab, setTab] = useState<TabKey>(tabParam === "completed" ? "completed" : "today");
  const [unsyncedIds, setUnsyncedIds] = useState<string[]>([]);
  const [pendingByAssignment, setPendingByAssignment] = useState<Record<string, number>>({});

  useEffect(() => {
    if (tabParam === "completed") setTab("completed");
    else if (tabParam === "assigned") setTab("today");
  }, [tabParam]);

  useEffect(() => {
    void listUnsyncedAssignmentIds().then(setUnsyncedIds);
  }, []);

  useEffect(() => {
    if (!isOnline()) return;
    void flushAiScanQueue((files, payload) =>
      submitScanImages(files, payload as Parameters<typeof submitScanImages>[1]).then((r) => ({
        scanId: r.scan_id,
      })),
    ).then((count) => {
      if (count > 0) {
        toast.success(`Synced ${count} queued AI audit(s).`);
        void listUnsyncedAssignmentIds().then(setUnsyncedIds);
      }
    });
  }, []);

  // Publish any due Schedule Once / Recurring rows into My Work (idempotent RPC).
  // Needed because this project has no pg_cron schedule runner.
  useEffect(() => {
    let cancelled = false;
    void processDueAuditSchedules()
      .then((count) => {
        if (cancelled || !count) return;
        void queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
      })
      .catch(() => {
        /* Non-blocking — assignments already listed still load. */
      });
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  const query = useQuery({
    queryKey: ["my-assignments"],
    queryFn: () => fetchMyAssignments(),
    retry: false,
  });

  const actionsQuery = useQuery({
    queryKey: ["my-open-actions"],
    queryFn: () => fetchMyOpenActions(),
    retry: false,
  });

  useEffect(() => {
    const digital = (query.data ?? []).filter((a) => a.audit_mode === "digital");
    void Promise.all(
      digital.map(async (a) => [a.id, await pendingCountForAssignment(a.id)] as const),
    ).then((pairs) => {
      setPendingByAssignment(Object.fromEntries(pairs));
    });
  }, [query.data]);

  const startMutation = useMutation({
    mutationFn: (assignment: Assignment) => startAssignment(assignment.id),
    onSuccess: (_data, assignment) => {
      void queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
      void queryClient.invalidateQueries({ queryKey: ["my-assignments-pending"] });
      // Prefer capture method over template presence — AI + template must open the scan flow.
      if (assignment.audit_mode === "ai" || assignment.audit_mode === "ai_assisted") {
        void navigate({ to: "/scan", search: { assignmentId: assignment.id } });
      } else if (assignment.template_id) {
        void navigate({ to: "/audit/$assignmentId", params: { assignmentId: assignment.id } });
      } else if (assignment.audit_mode === "digital") {
        void navigate({ to: "/digital-audit", search: { assignmentId: assignment.id } });
      } else {
        void navigate({ to: "/scan", search: { assignmentId: assignment.id } });
      }
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

  const all = query.data ?? [];
  const buckets = useMemo(() => {
    const active = all.filter(
      (item) => item.status !== "completed" && item.status !== "cancelled",
    );
    return {
      today: active.filter((item) => isTodayWork(item.due_at)),
      upcoming: active.filter((item) => isLaterWork(item.due_at)),
      overdue: active.filter((item) => isOverdue(item)),
      needs_correction: all.filter((item) => item.status === "needs_correction"),
      unsynced: all.filter(
        (item) =>
          unsyncedIds.includes(item.id) ||
          (pendingByAssignment[item.id] ?? 0) > 0,
      ),
      completed: all.filter((item) => item.status === "completed" || item.status === "cancelled"),
    } satisfies Record<AssignmentTabKey, Assignment[]>;
  }, [all, unsyncedIds, pendingByAssignment]);

  const myActions = useMemo(() => actionsQuery.data ?? [], [actionsQuery.data]);
  const actionBuckets = useMemo(
    () => ({
      today: myActions.filter((a) => a.status === "overdue" || isTodayWork(a.due_at)),
      upcoming: myActions.filter((a) => a.status !== "overdue" && isLaterWork(a.due_at)),
      overdue: myActions.filter((a) => a.status === "overdue" || isPastDue(a.due_at)),
    }),
    [myActions],
  );
  const tabActionsFor = (key: TabKey): LifecycleAction[] =>
    key === "today" || key === "upcoming" || key === "overdue" ? actionBuckets[key] : [];
  const tabCount = (key: TabKey) =>
    key === "actions" ? myActions.length : buckets[key].length + tabActionsFor(key).length;
  const visible = tab === "actions" ? [] : buckets[tab];
  const tabActions = tabActionsFor(tab);
  const actionable =
    tab === "today" ||
    tab === "upcoming" ||
    tab === "overdue" ||
    tab === "needs_correction" ||
    tab === "unsynced";

  // Opening the Needs correction list acknowledges its bell notifications.
  useEffect(() => {
    if (tab !== "needs_correction" || !buckets.needs_correction.length) return;
    void Promise.all(
      buckets.needs_correction.map((item) => markAssignmentNotificationsRead(item.id)),
    ).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    });
  }, [tab, buckets.needs_correction, queryClient]);

  return (
    <AppShell
      title="My work"
      description="Audits and corrective actions assigned to you — today, upcoming, overdue and returned for correction."
    >
      {query.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState description={toUserMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : (
        <div className="space-y-5">
          <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
            <TabsList className="flex w-full flex-wrap justify-start rounded-xl">
              {TABS.map((item) => (
                <TabsTrigger key={item.key} value={item.key} className="rounded-lg">
                  {item.label}
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {tabCount(item.key)}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {tab === "actions" ? (
            actionsQuery.isLoading ? (
              <Skeleton className="h-28 w-full rounded-xl" />
            ) : actionsQuery.isError ? (
              <ErrorState
                description={toUserMessage(actionsQuery.error)}
                onRetry={() => void actionsQuery.refetch()}
              />
            ) : (
              <MyActionsList actions={myActions} />
            )
          ) : visible.length === 0 && tabActions.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-6" />}
              title="Nothing here yet"
              description="When a manager assigns you an audit, it will appear here."
            />
          ) : (
            <div className="space-y-6">
              {tabActions.length ? (
                <section className="space-y-3">
                  <GroupHeading label="Corrective actions" count={tabActions.length} />
                  <MyActionsList actions={tabActions} />
                </section>
              ) : null}
              {visible.length ? (
                <section className="space-y-3">
                  {tabActions.length ? <GroupHeading label="Audits" count={visible.length} /> : null}
                  {visible.map((assignment) => (
                    <article
                      key={assignment.id}
                      className="rounded-2xl border border-border bg-card p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">
                              {assignment.scope_values.audit_name?.trim() || assignment.store_name}
                            </p>
                            {statusBadge(assignment.status)}
                            <CollectionMethodBadge mode={assignment.audit_mode} />
                            {(pendingByAssignment[assignment.id] ?? 0) > 0 ? (
                              <SyncBadge
                                state="pending"
                                pendingCount={pendingByAssignment[assignment.id]}
                              />
                            ) : null}
                            {assignment.status === "needs_correction" && (
                              <Badge
                                variant="secondary"
                                className="rounded-full border-0 bg-destructive/10 text-destructive"
                              >
                                {assignment.open_issue_count} open issues
                              </Badge>
                            )}
                            {isOverdue(assignment) && (
                              <Badge
                                variant="secondary"
                                className="rounded-full border-0 bg-destructive/10 text-destructive"
                              >
                                Overdue
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1">
                            <AssignmentIdChip id={assignment.id} />
                          </div>
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="size-3.5" /> {assignmentLine(assignment)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {scopeSummary(assignment.scope_type, assignment.scope_values)} · assigned by{" "}
                            {assignment.assigner_name}
                          </p>
                          {assignment.status === "needs_correction" && (
                            <p className="mt-1 text-xs">
                              <span
                                className={`font-semibold ${complianceTone(
                                  assignment.last_compliance_percent,
                                )}`}
                              >
                                {assignment.last_compliance_percent === null
                                  ? "—"
                                  : `${Math.round(assignment.last_compliance_percent)}%`}{" "}
                                compliance
                              </span>
                              <span className="text-muted-foreground">
                                {" "}
                                · attempt {assignment.scan_attempts} · fix the shelf, then re-audit
                              </span>
                            </p>
                          )}
                          {assignment.instructions && (
                            <p className="mt-2 rounded-xl bg-surface px-3 py-2 text-xs text-muted-foreground">
                              {assignment.instructions}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarClock className="size-3.5" /> {formatDate(assignment.due_at)}
                          </span>
                          {actionable ? (
                            <Button
                              variant="brand"
                              className="rounded-xl"
                              disabled={startMutation.isPending}
                              onClick={() => startMutation.mutate(assignment)}
                            >
                              {startMutation.isPending ? (
                                <Loader2 className="mr-2 size-4 animate-spin" />
                              ) : (
                                <ScanLine className="mr-2 size-4" />
                              )}
                              {startLabel(assignment)}
                            </Button>
                          ) : null}
                          {assignment.scan_id && (
                            <Button
                              variant="subtle"
                              className="rounded-xl"
                              onClick={() =>
                                void navigate({
                                  to: "/results",
                                  search: { scan: assignment.scan_id! },
                                })
                              }
                            >
                              {actionable ? "View last results" : "View results"}
                            </Button>
                          )}
                          {assignment.status === "needs_correction" && (
                            <Button asChild variant="subtle" className="rounded-xl">
                              <Link to="/corrective-actions">View open actions</Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </section>
              ) : null}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
