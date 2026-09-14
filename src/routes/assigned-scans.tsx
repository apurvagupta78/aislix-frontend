import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ClipboardList, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import { complianceTone } from "@/lib/planogram-compliance";
import {
  cancelAssignment,
  fetchAssignmentAttempts,
  fetchOrgAssignments,
  requestReScan,
  fetchTeamScans,
  isOrgManager,
  isOverdue,
  scopeSummary,
  type Assignment,
} from "@/lib/assignments";
import { AssignmentAttemptsList } from "@/components/scan-results/FixRescanVerifyPanel";
import { formatDate, statusBadge } from "@/routes/my-scans";
import { AssignmentIdChip, formatAssignmentId } from "@/components/AssignmentId";

export const Route = createFileRoute("/assigned-scans")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: "assignments" | "team-scans"; store?: string; assigner?: "me" } => {
    const raw = search["tab"];
    const store = search["store"];
    const assigner = search["assigner"];
    return {
      ...(raw === "team-scans" || raw === "assignments" ? { tab: raw } : {}),
      ...(typeof store === "string" && store ? { store } : {}),
      ...(assigner === "me" ? { assigner: "me" as const } : {}),
    };
  },

  head: () => ({
    meta: [
      { title: "Assigned Scans — Track team shelf audits | Aislix" },
      {
        name: "description",
        content:
          "Track every shelf audit you assigned: store, scope, assignee, due date, compliance and completion status.",
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

function compliance(value: number | null) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`text-sm font-semibold ${complianceTone(value)}`}>{Math.round(value)}%</span>
  );
}

/** "Test store · A-1-Z · Personal Care · Shampoo" */
function scopeLine(row: Assignment): string {
  const parts = [
    row.audit_mode === "digital" ? "Digital Audit" : "AI Audit",
    row.store_name,
  ];
  if (row.location) parts.push(row.location);
  if (row.scope_values.category) parts.push(row.scope_values.category);
  if (row.scope_values.sub_category) parts.push(row.scope_values.sub_category);
  return parts.join(" · ");
}

function AssignmentAttemptsExpand({ assignmentId }: { assignmentId: string }) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["assignment-attempts", assignmentId],
    queryFn: () => fetchAssignmentAttempts(assignmentId),
    enabled: open,
  });

  return (
    <div className="mt-2 border-t border-border pt-2">
      <button
        type="button"
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Hide attempts" : "Show scan attempts"}
      </button>
      {open && (
        <div className="mt-2">
          {query.isPending ? (
            <Skeleton className="h-16 w-full rounded-xl" />
          ) : (
            <AssignmentAttemptsList attempts={query.data ?? []} compact />
          )}
        </div>
      )}
    </div>
  );
}

function AssignmentsTab({ storeId, assignerMe }: { storeId?: string; assignerMe?: boolean }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [sortById, setSortById] = useState(false);

  const session = useQuery({
    queryKey: ["auth-session"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
    retry: false,
    staleTime: 30_000,
  });
  const currentUserId = session.data?.user?.id ?? null;

  const query = useQuery({
    queryKey: ["org-assignments"],
    queryFn: () => fetchOrgAssignments(),
    retry: false,
  });

  const notifyMutation = useMutation({
    mutationFn: (row: Assignment) => requestReScan(row),
    onSuccess: () => toast.success("Assignee notified to re-scan"),
    onError: (error) => toast.error(toUserMessage(error)),
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
  const filtered = (query.data ?? []).filter((row) => {
    if (assignerMe && currentUserId && row.assigner_id !== currentUserId) return false;
    if (storeId && row.store_id !== storeId) return false;
    if (status === "overdue" && !isOverdue(row)) return false;
    if (status !== "all" && status !== "overdue" && row.status !== status) return false;
    if (!term) return true;
    return `${formatAssignmentId(row.id)} ${row.store_name} ${row.assignee_name} ${scopeSummary(row.scope_type, row.scope_values)}`
      .toLowerCase()
      .includes(term);
  });
  const rows = [...filtered].sort((a, b) =>
    sortById ? formatAssignmentId(a.id).localeCompare(formatAssignmentId(b.id)) : 0,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs rounded-xl"
          placeholder="Search assignment ID, store, assignee or scope"
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
            <SelectItem value="needs_correction">Needs correction</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
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
              <Link to="/assign-scan" search={{ store: undefined, scope: undefined, planogramVersion: undefined }}>Assign scan</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      className="uppercase tracking-wide hover:text-foreground"
                      onClick={() => setSortById((value) => !value)}
                    >
                      Assignment ID {sortById ? "▲" : "▼"}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Assignee</th>
                  <th className="px-4 py-3 text-left font-medium">Store · Scope</th>
                  <th className="px-4 py-3 text-left font-medium">Expected</th>
                  <th className="px-4 py-3 text-left font-medium">Due</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Compliance</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <AssignmentIdChip id={row.id} label={false} />
                      {(row.scan_attempts > 0 || row.status === "needs_correction" || row.status === "completed") && (
                        <AssignmentAttemptsExpand assignmentId={row.id} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground">{row.assignee_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{scopeLine(row)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.expected_products}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(row.due_at)}</td>
                    <td className="px-4 py-3">
                      {isOverdue(row) ? (
                        <span className="text-xs font-medium text-destructive">Overdue</span>
                      ) : (
                        statusBadge(row.status)
                      )}
                    </td>
                    <td className="px-4 py-3">{compliance(row.compliance_percent)}</td>
                    <td className="px-4 py-3 text-right">
                      {row.status === "needs_correction" ? (
                        <div className="flex justify-end gap-1">
                          {row.scan_id && (
                            <Button variant="ghost" size="sm" className="rounded-xl" asChild>
                              <Link to="/results" search={{ scan: row.scan_id }}>
                                View results
                              </Link>
                            </Button>
                          )}
                          <Button
                            variant="subtle"
                            size="sm"
                            className="rounded-xl"
                            disabled={notifyMutation.isPending}
                            onClick={() => notifyMutation.mutate(row)}
                          >
                            Notify assignee
                          </Button>
                        </div>
                      ) : row.approval_status === "pending_review" && row.scan_id ? (
                        <Button variant="default" size="sm" className="rounded-xl" asChild>
                          <Link to="/audit-review/$scanId" params={{ scanId: row.scan_id }}>
                            Review audit
                          </Link>
                        </Button>
                      ) : row.scan_id ? (
                        <Button variant="ghost" size="sm" className="rounded-xl" asChild>
                          <Link to="/results" search={{ scan: row.scan_id }}>
                            View results
                          </Link>
                        </Button>
                      ) : row.status === "pending" || row.status === "in_progress" ? (
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
              <div key={row.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{row.assignee_name}</p>
                  {statusBadge(row.status)}
                </div>
                <AssignmentIdChip id={row.id} className="mt-1" />
                {(row.scan_attempts > 0 || row.status === "needs_correction" || row.status === "completed") && (
                  <AssignmentAttemptsExpand assignmentId={row.id} />
                )}
                <p className="mt-1 text-sm text-muted-foreground">{scopeLine(row)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.expected_products} expected · {formatDate(row.due_at)}
                </p>
                {row.status === "needs_correction" && (
                  <p className="mt-1 text-xs font-medium text-destructive">
                    {row.open_issue_count} open issues · re-scan required
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  {compliance(row.compliance_percent)}
                  {row.status === "needs_correction" && (
                    <Button
                      variant="subtle"
                      size="sm"
                      className="rounded-xl"
                      disabled={notifyMutation.isPending}
                      onClick={() => notifyMutation.mutate(row)}
                    >
                      Notify assignee
                    </Button>
                  )}
                  {row.approval_status === "pending_review" && row.scan_id ? (
                    <Button variant="default" size="sm" className="rounded-xl" asChild>
                      <Link to="/audit-review/$scanId" params={{ scanId: row.scan_id }}>
                        Review audit
                      </Link>
                    </Button>
                  ) : row.scan_id ? (
                    <Button variant="ghost" size="sm" className="rounded-xl" asChild>
                      <Link to="/results" search={{ scan: row.scan_id }}>
                        View results
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TeamScansTab() {
  const query = useQuery({
    queryKey: ["team-scans"],
    queryFn: () => fetchTeamScans(),
    retry: false,
  });

  const rows = query.data ?? [];

  if (query.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (query.isError)
    return (
      <ErrorState description={toUserMessage(query.error)} onRetry={() => void query.refetch()} />
    );
  if (!rows.length)
    return (
      <EmptyState
        icon={<ClipboardList className="size-6" />}
        title="No team scans yet"
        description="Once a teammate completes an assigned audit, their scan appears here with compliance detail."
      />
    );

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Assignment ID</th>
            <th className="px-4 py-3 text-left font-medium">Scan date</th>
            <th className="px-4 py-3 text-left font-medium">Assignee</th>
            <th className="px-4 py-3 text-left font-medium">Store</th>
            <th className="px-4 py-3 text-left font-medium">Location</th>
            <th className="px-4 py-3 text-left font-medium">Compliance</th>
            <th className="px-4 py-3 text-left font-medium">Missing</th>
            <th className="px-4 py-3 text-left font-medium">Wrong product</th>
            <th className="px-4 py-3 text-left font-medium">Unexpected</th>
            <th className="px-4 py-3 text-right font-medium">View</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.scan_id} className="border-t border-border">
              <td className="px-4 py-3">
                {row.assignment_id ? (
                  <AssignmentIdChip id={row.assignment_id} label={false} />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{formatDate(row.created_at)}</td>
              <td className="px-4 py-3 text-foreground">{row.assignee_name}</td>
              <td className="px-4 py-3 text-foreground">{row.store_name}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.location ?? "—"}</td>
              <td className="px-4 py-3">{compliance(row.compliance_percent)}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.missing ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.wrong_product ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.unexpected ?? "—"}</td>
              <td className="px-4 py-3 text-right">
                <Button variant="ghost" size="sm" className="rounded-xl" asChild>
                  <Link to="/results" search={{ scan: row.scan_id }}>
                    View
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssignedScansPage() {
  const { tab: tabParam, store: storeSearch, assigner: assignerSearch } = Route.useSearch();
  const [tab, setTab] = useState(tabParam ?? "assignments");
  useEffect(() => {
    if (tabParam) setTab(tabParam);
  }, [tabParam]);

  const managerQuery = useQuery({
    queryKey: ["is-org-manager"],
    queryFn: () => isOrgManager(),
    retry: false,
    staleTime: 60_000,
  });

  return (
    <AppShell
      title="Assigned Scans"
      description="Every shelf audit assigned across your stores and team."
      actions={
        <Button variant="brand" className="rounded-xl" asChild>
          <Link to="/assign-scan" search={{ store: undefined, scope: undefined, planogramVersion: undefined }}>
            <UserPlus className="mr-2 size-4" /> Assign scan
          </Link>
        </Button>
      }
    >
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
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as "assignments" | "team-scans")} className="space-y-4">
          <TabsList className="rounded-xl">
            <TabsTrigger value="assignments" className="rounded-lg">
              Assignments
            </TabsTrigger>
            <TabsTrigger value="team-scans" className="rounded-lg">
              Team Scans
            </TabsTrigger>
          </TabsList>
          {tab === "assignments" ? (
            <AssignmentsTab storeId={storeSearch} assignerMe={assignerSearch === "me"} />
          ) : (
            <TeamScansTab />
          )}
        </Tabs>
      )}
    </AppShell>
  );
}
