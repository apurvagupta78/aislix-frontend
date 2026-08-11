import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ClipboardList, Loader2, MapPin, ScanLine } from "lucide-react";
import { toast } from "sonner";
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
import { markAssignmentNotificationsRead } from "@/lib/notifications";
import { complianceTone } from "@/lib/planogram-compliance";

export const Route = createFileRoute("/my-scans")({
  head: () => ({
    meta: [
      { title: "My Assigned Scans — Aislix shelf audit tasks" },
      {
        name: "description",
        content:
          "See the shelf scans assigned to you, their scope and due dates, and start an audit in one tap.",
      },
      { property: "og:title", content: "My Assigned Scans — Aislix" },
      {
        property: "og:description",
        content: "Your shelf audit task list: scope, store, due date and one-tap scan start.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyScansPage,
});

export function statusBadge(status: Assignment["status"]) {
  const map: Record<Assignment["status"], { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-warning/10 text-warning" },
    in_progress: { label: "In progress", className: "bg-brand-soft text-brand" },
    needs_correction: { label: "Needs correction", className: "bg-warning/15 text-warning" },
    completed: { label: "Completed", className: "bg-success/10 text-success" },
    cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
  };
  const item = map[status] ?? map.pending;
  return (
    <Badge variant="secondary" className={`rounded-full border-0 ${item.className}`}>
      {item.label}
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

type TabKey = "pending" | "in_progress" | "needs_correction" | "overdue" | "completed";

const TABS: { key: TabKey; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In progress" },
  { key: "needs_correction", label: "Needs correction" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

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
  const [tab, setTab] = useState<TabKey>("pending");
  const query = useQuery({
    queryKey: ["my-assignments"],
    queryFn: () => fetchMyAssignments(),
    retry: false,
  });

  const startMutation = useMutation({
    mutationFn: (assignment: Assignment) => startAssignment(assignment.id),
    onSuccess: (_data, assignment) => {
      void queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
      void queryClient.invalidateQueries({ queryKey: ["my-assignments-pending"] });
      void navigate({ to: "/scan", search: { assignmentId: assignment.id } });
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

  const all = query.data ?? [];
  const buckets = useMemo(() => {
    return {
      pending: all.filter((item) => item.status === "pending"),
      in_progress: all.filter((item) => item.status === "in_progress"),
      needs_correction: all.filter((item) => item.status === "needs_correction"),
      overdue: all.filter((item) => isOverdue(item)),
      completed: all.filter((item) => item.status === "completed" || item.status === "cancelled"),
    } satisfies Record<TabKey, Assignment[]>;
  }, [all]);

  const visible = buckets[tab];
  const actionable =
    tab === "pending" || tab === "in_progress" || tab === "overdue" || tab === "needs_correction";

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
    <AppShell title="My Assigned Scans" description="Shelf audits assigned to you by your manager.">
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
                    {buckets[item.key].length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {visible.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-6" />}
              title="Nothing here yet"
              description="When a manager assigns you a shelf audit, it will appear here."
            />
          ) : (
            <div className="space-y-3">
              {visible.map((assignment) => (
                <article
                  key={assignment.id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {assignment.store_name}
                        </p>
                        {statusBadge(assignment.status)}
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
                            · attempt {assignment.scan_attempts} · fix the shelf, then re-scan
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
                          {assignment.status === "needs_correction"
                            ? "Fix & re-scan"
                            : assignment.status === "in_progress"
                              ? "Continue scan"
                              : "Start scan"}
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
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
