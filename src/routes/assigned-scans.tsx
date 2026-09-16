import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ClipboardList, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  AssignmentWorkCard,
  DownloadCsvButton,
  EmptyState,
  FilterBar,
  FilterRow,
  FilterSearch,
  PageHeader,
} from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import { complianceTone } from "@/lib/planogram-compliance";
import {
  cancelAssignment,
  fetchAssignableMembers,
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
import {
  bulkCancelAssignments,
  bulkReassignAssignments,
  exportAssignmentsCsv,
} from "@/lib/assignment-engine";
import { Checkbox } from "@/components/ui/checkbox";

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
      { title: "Review & Approvals — Aislix audit queue" },
      {
        name: "description",
        content:
          "Review submitted audits, track pending approvals, and manage assignments across your stores and team.",
      },
      { property: "og:title", content: "Review & Approvals — Aislix" },
      {
        property: "og:description",
        content: "Manager approval queue and assignment tracking for digital and AI audits.",
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
        {open ? "Hide attempts" : "Show audit attempts"}
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reassignTo, setReassignTo] = useState("");

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

  const membersQuery = useQuery({
    queryKey: ["assignable-members", "bulk"],
    queryFn: fetchAssignableMembers,
  });

  const notifyMutation = useMutation({
    mutationFn: (row: Assignment) => requestReScan(row),
    onSuccess: () => toast.success("Assignee notified to re-audit"),
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

  const bulkCancelMutation = useMutation({
    mutationFn: () => bulkCancelAssignments(selectedIds),
    onSuccess: () => {
      toast.success(`${selectedIds.length} assignment(s) cancelled`);
      setSelectedIds([]);
      void queryClient.invalidateQueries({ queryKey: ["org-assignments"] });
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

  const bulkReassignMutation = useMutation({
    mutationFn: async () => {
      const member = (await fetchAssignableMembers()).find((m) => m.user_id === reassignTo);
      if (!member) throw new Error("Select a team member to reassign to.");
      return bulkReassignAssignments({
        assignmentIds: selectedIds,
        newAssigneeId: member.user_id,
        newAssigneeName: member.name,
      });
    },
    onSuccess: () => {
      toast.success(`${selectedIds.length} assignment(s) reassigned`);
      setSelectedIds([]);
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
      <FilterBar>
        <FilterRow>
          <FilterSearch
            value={search}
            onChange={setSearch}
            placeholder="Search store, assignee, or scope…"
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44 rounded-xl">
              <SelectValue placeholder="Status" />
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
          <DownloadCsvButton
            label="Export CSV"
            onClick={() => exportAssignmentsCsv(filtered)}
            disabled={!filtered.length}
          />
        </FilterRow>
      </FilterBar>

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 p-3">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <Select value={reassignTo} onValueChange={setReassignTo}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Reassign to…" />
            </SelectTrigger>
            <SelectContent>
              {(membersQuery.data ?? []).map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={!reassignTo || bulkReassignMutation.isPending}
            onClick={() => bulkReassignMutation.mutate()}
          >
            Bulk Reassign
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={bulkCancelMutation.isPending}
            onClick={() => bulkCancelMutation.mutate()}
          >
            Bulk Cancel
          </Button>
        </div>
      ) : null}

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
              <Link to="/assign-scan" search={(prev) => ({ ...prev, store: undefined, scope: undefined, planogramVersion: undefined })}>Assign audit</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <AssignmentWorkCard
              key={row.id}
              assignment={row}
              scopeLine={scopeLine(row)}
              showCheckbox
              selected={selectedIds.includes(row.id)}
              onSelect={(checked) =>
                setSelectedIds((current) =>
                  checked ? [...current, row.id] : current.filter((id) => id !== row.id),
                )
              }
              footer={
                <>
                  <AssignmentIdChip id={row.id} label={false} />
                  {compliance(row.compliance_percent)}
                  {row.approval_status === "pending_review" && row.scan_id ? (
                    <Button variant="brand" size="sm" className="rounded-xl" asChild>
                      <Link to="/audit-review/$scanId" params={{ scanId: row.scan_id }}>
                        Review
                      </Link>
                    </Button>
                  ) : row.scan_id ? (
                    <Button variant="outline" size="sm" className="rounded-xl" asChild>
                      <Link to="/results" search={{ scan: row.scan_id }}>
                        View
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
                  ) : null}
                </>
              }
            />
          ))}
        </div>
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
        title="No team audits yet"
        description="Once a teammate completes an assigned audit, their audit appears here with compliance detail."
      />
    );

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Assignment ID</th>
            <th className="px-4 py-3 text-left font-medium">Audit date</th>
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
    <AppShell title="Assignments">
      <div className="play-canvas space-y-5">
        <PageHeader
          title="Assignments"
          description="Who is auditing what, where, and when — across your stores."
          actions={
            <>
              <Button variant="outline" size="sm" className="rounded-xl" asChild>
                <Link to="/assignment-grid">Assignment Grid</Link>
              </Button>
              <Button variant="brand" className="rounded-xl" asChild>
                <Link
                  to="/assign-scan"
                  search={(prev) => ({
                    ...prev,
                    store: undefined,
                    scope: undefined,
                    planogramVersion: undefined,
                  })}
                >
                  <UserPlus className="mr-2 size-4" /> Assign
                </Link>
              </Button>
            </>
          }
        />
      {managerQuery.data === false ? (
        <EmptyState
          icon={<ClipboardList className="size-6" />}
          title="Manager access required"
          description="Only workspace owners, admins and managers can review assignments. Your own tasks live on My Work."
          action={
            <Button variant="brand" className="rounded-xl" asChild>
              <Link to="/my-scans">Go to My Work</Link>
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
              Team Audits
            </TabsTrigger>
          </TabsList>
          {tab === "assignments" ? (
            <AssignmentsTab storeId={storeSearch} assignerMe={assignerSearch === "me"} />
          ) : (
            <TeamScansTab />
          )}
        </Tabs>
      )}
      </div>
    </AppShell>
  );
}
