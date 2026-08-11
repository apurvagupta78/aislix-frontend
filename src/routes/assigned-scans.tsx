import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  cancelAssignment,
  fetchOrgAssignments,
  isOrgManager,
  scopeSummary,
} from "@/lib/assignments";
import { formatDate, statusBadge } from "@/routes/my-scans";

export const Route = createFileRoute("/assigned-scans")({
  head: () => ({
    meta: [
      { title: "Assigned Scans — Track team shelf audits | Aislix" },
      {
        name: "description",
        content:
          "Track every shelf audit you assigned: store, scope, assignee, due date and completion status.",
      },
      { property: "og:title", content: "Assigned Scans — Aislix" },
      {
        property: "og:description",
        content: "Manager view of all assigned shelf audits across your stores and team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssignedScansPage,
});

function AssignedScansPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const managerQuery = useQuery({
    queryKey: ["is-org-manager"],
    queryFn: () => isOrgManager(),
    retry: false,
    staleTime: 60_000,
  });
  const isManager = managerQuery.data !== false;

  const query = useQuery({
    queryKey: ["org-assignments"],
    queryFn: () => fetchOrgAssignments(),
    retry: false,
    enabled: isManager,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelAssignment(id),
    onSuccess: () => {
      toast.success("Assignment cancelled");
      void queryClient.invalidateQueries({ queryKey: ["org-assignments"] });
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

  const term = search.trim().toLowerCase();
  const rows = (query.data ?? []).filter((row) => {
    if (status !== "all" && row.status !== status) return false;
    if (!term) return true;
    return `${row.store_name} ${row.assignee_name} ${scopeSummary(row.scope_type, row.scope_values)}`
      .toLowerCase()
      .includes(term);
  });

  return (
    <AppShell
      title="Assigned Scans"
      description="Every shelf audit assigned across your stores and team."
      actions={
        <Button variant="brand" className="rounded-xl" asChild>
          <Link to="/assign-scan">
            <UserPlus className="mr-2 size-4" /> Assign scan
          </Link>
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs rounded-xl"
            placeholder="Search store, assignee or scope"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {managerQuery.data === false ? (
          <EmptyState
            icon={<ClipboardList className="size-6" />}
            title="Manager access required"
            description="Only workspace owners, admins and managers can review assigned scans. Your own tasks live on My Scans."
            action={
              <Button variant="brand" className="rounded-xl" asChild>
                <Link to="/my-scans">Go to My Scans</Link>
              </Button>
            }
          />
        ) : query.isLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : query.isError ? (
          <ErrorState description={toUserMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : !rows.length ? (
          <EmptyState
            icon={<ClipboardList className="size-6" />}
            title="No assignments yet"
            description="Assign a scoped shelf audit to a team member to see it tracked here."
            action={
              <Button variant="brand" className="rounded-xl" asChild>
                <Link to="/assign-scan">Assign scan</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
              <table className="w-full text-sm">
                <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Store</th>
                    <th className="px-4 py-3 text-left font-medium">Scope</th>
                    <th className="px-4 py-3 text-left font-medium">Assignee</th>
                    <th className="px-4 py-3 text-left font-medium">Due</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-4 py-3 text-foreground">{row.store_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {scopeSummary(row.scope_type, row.scope_values)}
                      </td>
                      <td className="px-4 py-3 text-foreground">{row.assignee_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(row.due_at)}</td>
                      <td className="px-4 py-3">{statusBadge(row.status)}</td>
                      <td className="px-4 py-3 text-right">
                        {row.status === "pending" || row.status === "in_progress" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl"
                            disabled={cancelMutation.isPending}
                            onClick={() => cancelMutation.mutate(row.id)}
                          >
                            Cancel
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
                    <p className="text-sm font-semibold text-foreground">{row.store_name}</p>
                    {statusBadge(row.status)}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {scopeSummary(row.scope_type, row.scope_values)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.assignee_name} · {formatDate(row.due_at)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
