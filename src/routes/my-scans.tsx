import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ClipboardList, Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import {
  fetchMyAssignments,
  scopeSummary,
  startAssignment,
  type Assignment,
} from "@/lib/assignments";

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

function MyScansPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("aislix.activeAssignment", assignment.id);
      }
      void navigate({ to: "/scan" });
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

  const open = (query.data ?? []).filter(
    (item) => item.status === "pending" || item.status === "in_progress",
  );
  const done = (query.data ?? []).filter(
    (item) => item.status === "completed" || item.status === "cancelled",
  );

  return (
    <AppShell
      title="My Assigned Scans"
      description="Shelf audits assigned to you by your manager."
    >
      {query.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState description={toUserMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : !open.length && !done.length ? (
        <EmptyState
          icon={<ClipboardList className="size-6" />}
          title="No scans assigned yet"
          description="When a manager assigns you a shelf audit, it will appear here."
        />
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            {open.map((assignment) => (
              <article
                key={assignment.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {assignment.store_name}
                      </p>
                      {statusBadge(assignment.status)}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {scopeSummary(assignment.scope_type, assignment.scope_values)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Assigned by {assignment.assigner_name} · {assignment.expected_products}{" "}
                      expected products
                    </p>
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
                      Start scan
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {done.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-foreground">History</h2>
              <div className="mt-3 space-y-2">
                {done.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm"
                  >
                    <span className="text-foreground">
                      {assignment.store_name} ·{" "}
                      <span className="text-muted-foreground">
                        {scopeSummary(assignment.scope_type, assignment.scope_values)}
                      </span>
                    </span>
                    {statusBadge(assignment.status)}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}
