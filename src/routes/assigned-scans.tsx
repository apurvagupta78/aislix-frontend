import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, SearchX, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { DownloadCsvButton, EmptyState, PageHeader } from "@/components/design-system";
import { TablePager, usePager } from "@/components/design-system/TablePager";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/States";
import {
  AssignmentDetailsDrawer,
  AssignmentFilterBar,
  AssignmentRowsTable,
  EMPTY_ASSIGNMENT_FILTERS,
  OPEN_STATUSES,
  STATUS_LABEL,
  STATUS_ORDER,
  assignmentFilterOptions,
  matchesAssignmentFilters,
  toAssignmentItems,
  type AssignmentFilters,
  type OverviewStatus,
} from "@/components/assignments/assignment-overview";
import { toUserMessage } from "@/lib/api/errors";
import { fetchAssignableMembers, fetchAssignmentsOverview, type Assignment } from "@/lib/assignments";
import {
  bulkCancelAssignments,
  bulkReassignAssignments,
  exportAssignmentsCsv,
} from "@/lib/assignment-engine";
import { cn } from "@/lib/utils";

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
      { title: "Assignments — Aislix audit overview" },
      {
        name: "description",
        content:
          "Every audit assigned to you and your team, with its current status — not started, in progress, pending review, overdue or approved.",
      },
      { property: "og:title", content: "Assignments — Aislix" },
      {
        property: "og:description",
        content: "Team overview of assigned digital and AI audits and where each one stands.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssignedScansPage,
});

const STATUS_TABS: { id: OverviewStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  ...STATUS_ORDER.map((id) => ({ id, label: STATUS_LABEL[id] })),
];

/* ------------------------------ team summary ------------------------------ */

type PersonSummary = {
  id: string;
  name: string;
  open: number;
  overdue: number;
  review: number;
  approved: number;
  total: number;
};

const PEOPLE_PREVIEW = 5;

function TeamSummary({
  people,
  selected,
  onSelect,
}: {
  people: PersonSummary[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? people : people.slice(0, PEOPLE_PREVIEW);
  return (
    <section className="rounded-xl border border-[#D9E2E8] bg-white">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div>
          <p className="text-sm font-semibold text-[#04203F]">By team member</p>
          <p className="mt-0.5 text-xs text-[#667085]">Click a person to see only their assignments.</p>
        </div>
        {selected !== "all" ? (
          <Button variant="ghost" size="sm" className="h-7 rounded-lg px-2 text-xs" onClick={() => onSelect("all")}>
            Show everyone
          </Button>
        ) : null}
      </div>
      <div className="mt-2 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team member</TableHead>
              <TableHead className="text-right">Open</TableHead>
              <TableHead className="text-right">Overdue</TableHead>
              <TableHead className="text-right">Pending review</TableHead>
              <TableHead className="text-right">Approved</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((person) => (
              <TableRow
                key={person.id}
                onClick={() => onSelect(selected === person.id ? "all" : person.id)}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-[#F4F7F9]",
                  selected === person.id && "bg-[#F4F7F9]",
                )}
                aria-selected={selected === person.id}
              >
                <TableCell className="font-medium text-[#04203F]">{person.name}</TableCell>
                <TableCell className="text-right tabular-nums">{person.open}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {person.overdue > 0 ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#04203F]">
                      <span className="size-1.5 rounded-full bg-[#ECBDCC]" aria-hidden />
                      {person.overdue}
                    </span>
                  ) : (
                    0
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{person.review}</TableCell>
                <TableCell className="text-right tabular-nums">{person.approved}</TableCell>
                <TableCell className="text-right tabular-nums text-[#667085]">{person.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {people.length > PEOPLE_PREVIEW ? (
        <div className="border-t border-[#D9E2E8] px-4 py-2">
          <Button variant="ghost" size="sm" className="h-7 rounded-lg px-2 text-xs" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show fewer" : `Show all ${people.length} team members`}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/* ---------------------------------- page ---------------------------------- */

function AssignedScansPage() {
  const queryClient = useQueryClient();
  const search = Route.useSearch();

  const [statusTab, setStatusTab] = useState<OverviewStatus | "all">("all");
  const [filters, setFiltersState] = useState<AssignmentFilters>(() => ({
    ...EMPTY_ASSIGNMENT_FILTERS,
    store: search.store ?? "all",
  }));
  const [assignerMeFromUrl, setAssignerMeFromUrl] = useState(search.assigner === "me");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reassignTo, setReassignTo] = useState("");
  const [viewing, setViewing] = useState<Assignment | null>(null);

  const query = useQuery({
    queryKey: ["assignments-overview"],
    queryFn: fetchAssignmentsOverview,
    retry: false,
  });
  const isManager = query.data?.isManager ?? false;
  const userId = query.data?.userId ?? "";

  const membersQuery = useQuery({
    queryKey: ["assignable-members", "bulk"],
    queryFn: fetchAssignableMembers,
    enabled: isManager,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["assignments-overview"] });

  const bulkCancelMutation = useMutation({
    mutationFn: () => bulkCancelAssignments(selectedIds),
    onSuccess: () => {
      toast.success(`${selectedIds.length} assignment(s) cancelled`);
      setSelectedIds([]);
      invalidate();
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

  const bulkReassignMutation = useMutation({
    mutationFn: async () => {
      const member = (membersQuery.data ?? []).find((m) => m.user_id === reassignTo);
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
      invalidate();
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);
  const effectiveFilters = useMemo<AssignmentFilters>(
    () => (assignerMeFromUrl && userId ? { ...filters, assigner: userId } : filters),
    [filters, assignerMeFromUrl, userId],
  );

  const withStatus = useMemo(() => toAssignmentItems(rows), [rows]);
  const filtered = useMemo(
    () => withStatus.filter((item) => matchesAssignmentFilters(item, effectiveFilters)),
    [withStatus, effectiveFilters],
  );
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: filtered.length };
    for (const { status } of filtered) counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, [filtered]);
  const visible = useMemo(
    () => (statusTab === "all" ? filtered : filtered.filter(({ status }) => status === statusTab)),
    [filtered, statusTab],
  );

  const people = useMemo<PersonSummary[]>(() => {
    const byPerson = new Map<string, PersonSummary>();
    const base = withStatus.filter((item) => matchesAssignmentFilters(item, { ...effectiveFilters, assignee: "all" }));
    for (const { row, status } of base) {
      const person =
        byPerson.get(row.assignee_id) ??
        { id: row.assignee_id, name: row.assignee_name, open: 0, overdue: 0, review: 0, approved: 0, total: 0 };
      person.total += 1;
      if (OPEN_STATUSES.includes(status)) person.open += 1;
      if (status === "overdue") person.overdue += 1;
      if (status === "pending_review") person.review += 1;
      if (status === "approved") person.approved += 1;
      byPerson.set(row.assignee_id, person);
    }
    return [...byPerson.values()].sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.name.localeCompare(b.name));
  }, [withStatus, effectiveFilters]);

  const options = useMemo(() => assignmentFilterOptions(rows), [rows]);

  const pager = usePager(visible.length);
  const pageRows = visible.slice(pager.start, pager.end);

  const setFilters = (patch: Partial<AssignmentFilters>) => {
    if ("assigner" in patch) setAssignerMeFromUrl(false);
    setFiltersState((prev) => ({ ...prev, ...patch }));
    pager.setPage(0);
  };
  const clearFilters = () => {
    setAssignerMeFromUrl(false);
    setFiltersState(EMPTY_ASSIGNMENT_FILTERS);
    setStatusTab("all");
    pager.setPage(0);
  };

  const pageIds = pageRows.map(({ row }) => row.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const toggleRow = (id: string, checked: boolean) =>
    setSelectedIds((current) => (checked ? [...new Set([...current, id])] : current.filter((x) => x !== id)));
  const togglePage = (checked: boolean) =>
    setSelectedIds((current) =>
      checked ? [...new Set([...current, ...pageIds])] : current.filter((id) => !pageIds.includes(id)),
    );

  return (
    <AppShell title="" hidePageHeader>
      <div className="play-canvas space-y-5">
        <PageHeader
          title="Assignments"
          description={
            !query.data || isManager
              ? "Every audit assigned to you and your team, and where each one stands."
              : "Audits assigned to you or by you, and where each one stands."
          }
          actions={
            isManager ? (
              <>
                <Button variant="outline" size="sm" className="rounded-lg" asChild>
                  <Link to="/assignment-grid">Assignment grid</Link>
                </Button>
                <Button variant="brand" size="sm" className="rounded-lg" asChild>
                  <Link
                    to="/assign-scan"
                    search={(prev) => ({ ...prev, store: undefined, scope: undefined, planogramVersion: undefined })}
                  >
                    <UserPlus className="mr-2 size-4" /> Assign
                  </Link>
                </Button>
              </>
            ) : null
          }
        />

        {query.isPending ? (
          <Skeleton className="h-64 w-full rounded-xl" aria-label="Loading assignments" />
        ) : query.isError ? (
          <ErrorState description={toUserMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-6" />}
            title="No assignments yet"
            description="Assign an audit to a team member and it will be tracked here."
            action={
              isManager ? (
                <Button variant="brand" className="rounded-lg" asChild>
                  <Link
                    to="/assign-scan"
                    search={(prev) => ({ ...prev, store: undefined, scope: undefined, planogramVersion: undefined })}
                  >
                    Assign audit
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {isManager && people.length > 1 ? (
              <TeamSummary
                people={people}
                selected={filters.assignee}
                onSelect={(id) => setFilters({ assignee: id })}
              />
            ) : null}

            <AssignmentFilterBar
              filters={effectiveFilters}
              onChange={setFilters}
              onClear={clearFilters}
              options={options}
              defaultOpen={Boolean(search.store || search.assigner)}
              matchCount={visible.length}
              totalCount={rows.length}
              extraNarrowed={statusTab !== "all"}
              actions={
                <DownloadCsvButton
                  label="Export CSV"
                  onClick={() => exportAssignmentsCsv(visible.map(({ row }) => row))}
                  disabled={!visible.length}
                />
              }
            />

            <div className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-[#D9E2E8]" role="tablist" aria-label="Status">
              {STATUS_TABS.map((tab) => {
                const active = statusTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setStatusTab(tab.id);
                      pager.setPage(0);
                    }}
                    className={cn(
                      "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "border-[#04203F] text-[#04203F]"
                        : "border-transparent text-[#667085] hover:text-[#04203F]",
                    )}
                  >
                    {tab.label} <span className="tabular-nums text-[#667085]">({tabCounts[tab.id] ?? 0})</span>
                  </button>
                );
              })}
            </div>

            {isManager && selectedIds.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#D9E2E8] bg-white p-3">
                <span className="text-sm font-medium text-[#04203F]">{selectedIds.length} selected</span>
                <Select value={reassignTo} onValueChange={setReassignTo}>
                  <SelectTrigger className="h-9 w-48 rounded-lg" aria-label="Reassign to">
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
                  className="rounded-lg"
                  disabled={!reassignTo || bulkReassignMutation.isPending}
                  onClick={() => bulkReassignMutation.mutate()}
                >
                  Reassign
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg text-destructive"
                  disabled={bulkCancelMutation.isPending}
                  onClick={() => bulkCancelMutation.mutate()}
                >
                  Cancel selected
                </Button>
                <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => setSelectedIds([])}>
                  Clear selection
                </Button>
              </div>
            ) : null}

            <section className="rounded-xl border border-[#D9E2E8] bg-white">
              {visible.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={<SearchX className="size-5" />}
                    title="No assignments match"
                    description="Try another status, store, person or due date."
                    action={
                      <Button variant="subtle" size="sm" className="rounded-lg" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    }
                  />
                </div>
              ) : (
                <>
                  <AssignmentRowsTable
                    items={pageRows}
                    userId={userId}
                    isManager={isManager}
                    onView={setViewing}
                    selection={isManager ? { selectedIds, toggleRow, togglePage, allPageSelected } : undefined}
                  />
                  <TablePager pager={pager} noun="assignments" className="border-t border-[#D9E2E8]" />
                </>
              )}
            </section>
          </>
        )}
      </div>

      <AssignmentDetailsDrawer row={viewing} onClose={() => setViewing(null)} />
    </AppShell>
  );
}
