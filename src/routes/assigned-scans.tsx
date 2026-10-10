import { useMemo, useState, type ReactNode } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  BellRing,
  ChevronDown,
  ClipboardList,
  Eye,
  MoreHorizontal,
  SearchX,
  SlidersHorizontal,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  DownloadCsvButton,
  EmptyState,
  FilterSearch,
  PageHeader,
  PreviewDrawer,
} from "@/components/design-system";
import { TablePager, usePager } from "@/components/design-system/TablePager";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import {
  cancelAssignment,
  fetchAssignableMembers,
  fetchAssignmentAttempts,
  fetchAssignmentsOverview,
  requestReScan,
  isOverdue,
  scopeSummary,
  type Assignment,
} from "@/lib/assignments";
import { resolveAssignmentDisplayStatus } from "@/lib/assignment-status-ui";
import { AssignmentAttemptsList } from "@/components/scan-results/FixRescanVerifyPanel";
import { formatAssignmentId } from "@/components/AssignmentId";
import { formatScanDate } from "@/lib/scan-history";
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

/* --------------------------------- status --------------------------------- */

type OverviewStatus =
  | "not_started"
  | "in_progress"
  | "pending_review"
  | "needs_correction"
  | "overdue"
  | "approved"
  | "cancelled";

const STATUS_TABS: { id: OverviewStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "not_started", label: "Not started" },
  { id: "in_progress", label: "In progress" },
  { id: "pending_review", label: "Pending review" },
  { id: "needs_correction", label: "Re-audit requested" },
  { id: "overdue", label: "Overdue" },
  { id: "approved", label: "Approved" },
  { id: "cancelled", label: "Cancelled" },
];

const STATUS_LABEL: Record<OverviewStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  pending_review: "Pending review",
  needs_correction: "Re-audit requested",
  overdue: "Overdue",
  approved: "Approved",
  cancelled: "Cancelled",
};

const STATUS_DOT: Record<OverviewStatus, string> = {
  not_started: "bg-[#D9E2E8]",
  in_progress: "bg-[#7DB7D6]",
  pending_review: "bg-[#9B86D9]",
  needs_correction: "bg-[#ECBDCC]",
  overdue: "bg-[#ECBDCC]",
  approved: "bg-[#79E2A8]",
  cancelled: "bg-[#D9E2E8]",
};

function overviewStatus(row: Assignment): OverviewStatus {
  if (row.status === "cancelled") return "cancelled";
  const display = resolveAssignmentDisplayStatus({
    status: row.status,
    approval_status: row.approval_status,
    overdue: isOverdue(row),
  });
  switch (display) {
    case "overdue":
      return "overdue";
    case "pending":
      return "not_started";
    case "pending_review":
    case "submitted":
      return "pending_review";
    case "needs_correction":
      return "needs_correction";
    case "approved":
    case "completed":
      return "approved";
    default:
      return "in_progress";
  }
}

const OPEN_STATUSES: OverviewStatus[] = ["not_started", "in_progress", "needs_correction", "overdue"];

function StatusPill({ status }: { status: OverviewStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#D9E2E8] bg-white px-2 py-0.5 text-xs font-medium text-[#04203F]">
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

/* --------------------------------- helpers -------------------------------- */

function auditTitle(row: Assignment): string {
  return row.scope_values.audit_name?.trim() || scopeSummary(row.scope_type, row.scope_values);
}

function auditSubtitle(row: Assignment): string {
  return `${row.audit_mode === "digital" ? "Digital audit" : "AI audit"} · ${formatAssignmentId(row.id)}`;
}

function formatCompliance(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function DueCell({ row, status }: { row: Assignment; status: OverviewStatus }) {
  if (!row.due_at) return <span className="text-[#667085]">No due date</span>;
  return (
    <span className={cn("whitespace-nowrap", status === "overdue" ? "font-medium text-[#04203F]" : "text-[#667085]")}>
      {status === "overdue" ? (
        <span className="mr-1.5 inline-block size-1.5 rounded-full bg-[#ECBDCC] align-middle" aria-hidden />
      ) : null}
      {formatScanDate(row.due_at)}
    </span>
  );
}

function localDayStart(day: string): number {
  return new Date(`${day}T00:00:00`).getTime();
}

type Filters = {
  q: string;
  store: string;
  assignee: string;
  assigner: string;
  mode: "all" | "ai" | "digital";
  dueFrom: string;
  dueTo: string;
};

const EMPTY_FILTERS: Filters = {
  q: "",
  store: "all",
  assignee: "all",
  assigner: "all",
  mode: "all",
  dueFrom: "",
  dueTo: "",
};

function activeFilterCount(filters: Filters): number {
  return [
    filters.store !== "all",
    filters.assignee !== "all",
    filters.assigner !== "all",
    filters.mode !== "all",
    Boolean(filters.dueFrom),
    Boolean(filters.dueTo),
  ].filter(Boolean).length;
}

function matchesFilters(row: Assignment, filters: Filters): boolean {
  if (filters.store !== "all" && row.store_id !== filters.store) return false;
  if (filters.assignee !== "all" && row.assignee_id !== filters.assignee) return false;
  if (filters.assigner !== "all" && row.assigner_id !== filters.assigner) return false;
  if (filters.mode !== "all" && (row.audit_mode === "digital" ? "digital" : "ai") !== filters.mode) return false;
  if (filters.dueFrom || filters.dueTo) {
    if (!row.due_at) return false;
    const due = new Date(row.due_at).getTime();
    if (filters.dueFrom && due < localDayStart(filters.dueFrom)) return false;
    if (filters.dueTo && due >= localDayStart(filters.dueTo) + 24 * 60 * 60 * 1000) return false;
  }
  const q = filters.q.trim().toLowerCase();
  if (q) {
    const haystack = [
      formatAssignmentId(row.id),
      auditTitle(row),
      row.store_name,
      row.location,
      row.assignee_name,
      row.assigner_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function uniqueOptions(entries: [string, string][]): { id: string; name: string }[] {
  const byId = new Map<string, string>();
  for (const [id, name] of entries) if (id && !byId.has(id)) byId.set(id, name);
  return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs text-[#667085]">
      {label}
      {children}
    </label>
  );
}

function OptionSelect({
  value,
  onChange,
  allLabel,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { id: string; name: string }[];
  ariaLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 rounded-lg" aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ------------------------------ row actions ------------------------------- */

function RowCta({
  row,
  status,
  userId,
  isManager,
  onView,
  className,
}: {
  row: Assignment;
  status: OverviewStatus;
  userId: string;
  isManager: boolean;
  onView: () => void;
  className?: string;
}) {
  const base = cn("rounded-lg", className);
  if (status === "pending_review" && row.scan_id && isManager) {
    return (
      <Button variant="brand" size="sm" className={base} asChild>
        <Link to="/audit-review/$scanId" params={{ scanId: row.scan_id }}>
          Review
        </Link>
      </Button>
    );
  }
  if (row.scan_id) {
    return (
      <Button variant="brand" size="sm" className={base} asChild>
        <Link to="/results" search={{ scan: row.scan_id }}>
          View report
        </Link>
      </Button>
    );
  }
  if (row.assignee_id === userId && OPEN_STATUSES.includes(status)) {
    return (
      <Button variant="brand" size="sm" className={base} asChild>
        <Link to="/my-scans">Start in My work</Link>
      </Button>
    );
  }
  return (
    <Button variant="subtle" size="sm" className={base} onClick={onView}>
      View
    </Button>
  );
}

function RowMenu({
  row,
  status,
  canManage,
  onView,
  onRemind,
  onCancel,
}: {
  row: Assignment;
  status: OverviewStatus;
  canManage: boolean;
  onView: () => void;
  onRemind: () => void;
  onCancel: () => void;
}) {
  const cancellable = canManage && (row.status === "pending" || row.status === "in_progress");
  const remindable = canManage && status === "needs_correction";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-lg" aria-label={`More actions for ${formatAssignmentId(row.id)}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl">
        <DropdownMenuItem onSelect={onView}>
          <Eye className="size-4" /> Details and attempts
        </DropdownMenuItem>
        {remindable ? (
          <DropdownMenuItem onSelect={onRemind}>
            <BellRing className="size-4" /> Remind to re-audit
          </DropdownMenuItem>
        ) : null}
        {cancellable ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onCancel}>
              <Ban className="size-4" /> Cancel assignment
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DetailsDrawer({ row, onClose }: { row: Assignment | null; onClose: () => void }) {
  const attempts = useQuery({
    queryKey: ["assignment-attempts", row?.id],
    queryFn: () => fetchAssignmentAttempts(row!.id),
    enabled: Boolean(row),
  });
  const status = row ? overviewStatus(row) : null;
  const details: [string, ReactNode][] = row
    ? [
        ["Status", status ? <StatusPill status={status} /> : "—"],
        ["Store", [row.store_name, row.location].filter(Boolean).join(" · ")],
        ["Scope", scopeSummary(row.scope_type, row.scope_values)],
        ["Assigned to", row.assignee_name],
        ["Assigned by", row.assigner_name],
        ["Assigned on", formatScanDate(row.created_at)],
        ["Due", row.due_at ? formatScanDate(row.due_at) : "No due date"],
        ["Compliance", formatCompliance(row.compliance_percent)],
        ["Attempts", String(row.scan_attempts)],
        ["Open issues", String(row.open_issue_count)],
      ]
    : [];

  return (
    <PreviewDrawer
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row ? auditTitle(row) : ""}
      description={row ? auditSubtitle(row) : undefined}
    >
      {row ? (
        <div className="space-y-5">
          <dl className="divide-y divide-[#D9E2E8] rounded-xl border border-[#D9E2E8]">
            {details.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 px-3 py-2 text-sm">
                <dt className="text-[#667085]">{label}</dt>
                <dd className="text-right font-medium text-[#04203F]">{value}</dd>
              </div>
            ))}
          </dl>
          {row.instructions ? (
            <div>
              <p className="text-xs text-[#667085]">Instructions</p>
              <p className="mt-1 rounded-lg border border-[#D9E2E8] px-3 py-2 text-sm text-[#04203F]">{row.instructions}</p>
            </div>
          ) : null}
          <div>
            <p className="text-xs text-[#667085]">Audit attempts</p>
            <div className="mt-2">
              {attempts.isPending ? (
                <Skeleton className="h-16 w-full rounded-xl" />
              ) : (attempts.data ?? []).length ? (
                <AssignmentAttemptsList attempts={attempts.data ?? []} compact />
              ) : (
                <p className="text-sm text-[#667085]">No attempts yet.</p>
              )}
            </div>
          </div>
          {row.scan_id ? (
            <Button variant="brand" className="w-full rounded-lg" asChild>
              <Link to="/results" search={{ scan: row.scan_id }}>
                View report
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </PreviewDrawer>
  );
}

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
  const [filters, setFiltersState] = useState<Filters>(() => ({
    ...EMPTY_FILTERS,
    store: search.store ?? "all",
  }));
  const [filtersOpen, setFiltersOpen] = useState(Boolean(search.store || search.assigner));
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

  const remindMutation = useMutation({
    mutationFn: (row: Assignment) => requestReScan(row),
    onSuccess: () => toast.success("Assignee reminded to re-audit"),
    onError: (error) => toast.error(toUserMessage(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelAssignment(id),
    onSuccess: () => {
      toast.success("Assignment cancelled");
      invalidate();
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

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

  const rows = query.data?.rows ?? [];
  const effectiveFilters = useMemo<Filters>(
    () => (assignerMeFromUrl && userId ? { ...filters, assigner: userId } : filters),
    [filters, assignerMeFromUrl, userId],
  );

  const withStatus = useMemo(() => rows.map((row) => ({ row, status: overviewStatus(row) })), [rows]);
  const filtered = useMemo(
    () => withStatus.filter(({ row }) => matchesFilters(row, effectiveFilters)),
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
    const base = withStatus.filter(({ row }) => matchesFilters(row, { ...effectiveFilters, assignee: "all" }));
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

  const options = useMemo(
    () => ({
      stores: uniqueOptions(rows.map((row): [string, string] => [row.store_id, row.store_name])),
      assignees: uniqueOptions(rows.map((row): [string, string] => [row.assignee_id, row.assignee_name])),
      assigners: uniqueOptions(rows.map((row): [string, string] => [row.assigner_id, row.assigner_name])),
    }),
    [rows],
  );

  const pager = usePager(visible.length);
  const pageRows = visible.slice(pager.start, pager.end);
  const activeCount = activeFilterCount(effectiveFilters);
  const narrowed = activeCount > 0 || Boolean(filters.q.trim()) || statusTab !== "all";

  const setFilters = (patch: Partial<Filters>) => {
    if ("assigner" in patch) setAssignerMeFromUrl(false);
    setFiltersState((prev) => ({ ...prev, ...patch }));
    pager.setPage(0);
  };
  const clearFilters = () => {
    setAssignerMeFromUrl(false);
    setFiltersState(EMPTY_FILTERS);
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

  const canManage = (row: Assignment) => isManager || row.assigner_id === userId;

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

            <section className="space-y-3 rounded-xl border border-[#D9E2E8] bg-white p-4">
              <div className="flex flex-wrap items-center gap-3">
                <FilterSearch
                  value={filters.q}
                  onChange={(value) => setFilters({ q: value })}
                  placeholder="Search audit, assignment ID, store or person…"
                />
                <button
                  type="button"
                  onClick={() => setFiltersOpen((open) => !open)}
                  aria-expanded={filtersOpen}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-3 text-sm font-medium text-[#04203F] transition-colors hover:bg-[#F4F7F9]",
                    activeCount > 0 ? "border-[#04203F]/40" : "border-[#D9E2E8]",
                  )}
                >
                  <SlidersHorizontal className="size-4 text-[#667085]" aria-hidden />
                  Filters{activeCount > 0 ? ` (${activeCount})` : ""}
                  <ChevronDown className={cn("size-4 text-[#667085] transition-transform", filtersOpen && "rotate-180")} aria-hidden />
                </button>
                <DownloadCsvButton
                  label="Export CSV"
                  onClick={() => exportAssignmentsCsv(visible.map(({ row }) => row))}
                  disabled={!visible.length}
                />
              </div>

              {filtersOpen ? (
                <div className="grid gap-3 border-t border-[#D9E2E8] pt-3 sm:grid-cols-2 lg:grid-cols-3">
                  <FilterField label="Store">
                    <OptionSelect
                      value={filters.store}
                      onChange={(v) => setFilters({ store: v })}
                      allLabel="All stores"
                      options={options.stores}
                      ariaLabel="Filter by store"
                    />
                  </FilterField>
                  <FilterField label="Assigned to">
                    <OptionSelect
                      value={filters.assignee}
                      onChange={(v) => setFilters({ assignee: v })}
                      allLabel="Anyone"
                      options={options.assignees}
                      ariaLabel="Filter by assignee"
                    />
                  </FilterField>
                  <FilterField label="Assigned by">
                    <OptionSelect
                      value={effectiveFilters.assigner}
                      onChange={(v) => setFilters({ assigner: v })}
                      allLabel="Anyone"
                      options={options.assigners}
                      ariaLabel="Filter by who assigned the audit"
                    />
                  </FilterField>
                  <FilterField label="Mode">
                    <OptionSelect
                      value={filters.mode}
                      onChange={(v) => setFilters({ mode: v as Filters["mode"] })}
                      allLabel="AI and Digital"
                      options={[
                        { id: "ai", name: "AI audit" },
                        { id: "digital", name: "Digital audit" },
                      ]}
                      ariaLabel="Filter by audit mode"
                    />
                  </FilterField>
                  <FilterField label="Due from">
                    <Input
                      type="date"
                      value={filters.dueFrom}
                      max={filters.dueTo || undefined}
                      onChange={(e) => setFilters({ dueFrom: e.target.value })}
                      className="h-10 rounded-lg"
                      aria-label="Due from"
                    />
                  </FilterField>
                  <FilterField label="Due to">
                    <Input
                      type="date"
                      value={filters.dueTo}
                      min={filters.dueFrom || undefined}
                      onChange={(e) => setFilters({ dueTo: e.target.value })}
                      className="h-10 rounded-lg"
                      aria-label="Due to"
                    />
                  </FilterField>
                </div>
              ) : null}

              {narrowed ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
                  <span>
                    {visible.length.toLocaleString()} of {rows.length.toLocaleString()} assignments match
                  </span>
                  <Button variant="ghost" size="sm" className="h-7 rounded-lg px-2 text-xs" onClick={clearFilters}>
                    Clear all
                  </Button>
                </div>
              ) : null}
            </section>

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
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {isManager ? (
                            <TableHead className="w-10">
                              <Checkbox
                                checked={allPageSelected}
                                onCheckedChange={(c) => togglePage(Boolean(c))}
                                aria-label="Select all on this page"
                              />
                            </TableHead>
                          ) : null}
                          <TableHead>Audit</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Store</TableHead>
                          <TableHead>Assigned to</TableHead>
                          <TableHead>Assigned by</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead className="text-right">Compliance</TableHead>
                          <TableHead className="sticky right-0 bg-white text-right">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageRows.map(({ row, status }) => (
                          <TableRow key={row.id} className="group transition-colors hover:bg-[#F4F7F9]">
                            {isManager ? (
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.includes(row.id)}
                                  onCheckedChange={(c) => toggleRow(row.id, Boolean(c))}
                                  aria-label={`Select ${formatAssignmentId(row.id)}`}
                                />
                              </TableCell>
                            ) : null}
                            <TableCell className="max-w-[260px]">
                              <p className="truncate font-medium text-[#04203F]" title={auditTitle(row)}>
                                {auditTitle(row)}
                              </p>
                              <p className="truncate text-xs text-[#667085]">{auditSubtitle(row)}</p>
                            </TableCell>
                            <TableCell>
                              <StatusPill status={status} />
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <p className="truncate text-sm text-[#04203F]">{row.store_name}</p>
                              {row.location ? <p className="truncate text-xs text-[#667085]">{row.location}</p> : null}
                            </TableCell>
                            <TableCell className="max-w-[160px] truncate text-sm">{row.assignee_name}</TableCell>
                            <TableCell className="max-w-[160px] truncate text-sm text-[#667085]">{row.assigner_name}</TableCell>
                            <TableCell className="text-sm">
                              <DueCell row={row} status={status} />
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium text-[#04203F]">
                              {formatCompliance(row.compliance_percent)}
                            </TableCell>
                            <TableCell className="sticky right-0 border-l border-[#D9E2E8] bg-white text-right transition-colors group-hover:bg-[#F4F7F9]">
                              <div className="flex items-center justify-end gap-1">
                                <RowCta
                                  row={row}
                                  status={status}
                                  userId={userId}
                                  isManager={isManager}
                                  onView={() => setViewing(row)}
                                />
                                <RowMenu
                                  row={row}
                                  status={status}
                                  canManage={canManage(row)}
                                  onView={() => setViewing(row)}
                                  onRemind={() => remindMutation.mutate(row)}
                                  onCancel={() => cancelMutation.mutate(row.id)}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <ul className="divide-y divide-[#D9E2E8] md:hidden">
                    {pageRows.map(({ row, status }) => (
                      <li key={row.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            {isManager ? (
                              <Checkbox
                                className="mt-0.5"
                                checked={selectedIds.includes(row.id)}
                                onCheckedChange={(c) => toggleRow(row.id, Boolean(c))}
                                aria-label={`Select ${formatAssignmentId(row.id)}`}
                              />
                            ) : null}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#04203F]">{auditTitle(row)}</p>
                              <p className="mt-0.5 truncate text-xs text-[#667085]">{auditSubtitle(row)}</p>
                            </div>
                          </div>
                          <StatusPill status={status} />
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                          {[
                            { l: "Store", v: [row.store_name, row.location].filter(Boolean).join(" · ") },
                            { l: "Due", v: row.due_at ? formatScanDate(row.due_at) : "No due date" },
                            { l: "Assigned to", v: row.assignee_name },
                            { l: "Assigned by", v: row.assigner_name },
                          ].map((item) => (
                            <div key={item.l} className="min-w-0">
                              <dt className="text-[#667085]">{item.l}</dt>
                              <dd className="mt-0.5 truncate font-medium text-[#04203F]">{item.v}</dd>
                            </div>
                          ))}
                        </dl>
                        <div className="mt-3 flex items-center gap-2">
                          <RowCta
                            row={row}
                            status={status}
                            userId={userId}
                            isManager={isManager}
                            onView={() => setViewing(row)}
                            className="flex-1"
                          />
                          <RowMenu
                            row={row}
                            status={status}
                            canManage={canManage(row)}
                            onView={() => setViewing(row)}
                            onRemind={() => remindMutation.mutate(row)}
                            onCancel={() => cancelMutation.mutate(row.id)}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>

                  <TablePager pager={pager} noun="assignments" className="border-t border-[#D9E2E8]" />
                </>
              )}
            </section>
          </>
        )}
      </div>

      <DetailsDrawer row={viewing} onClose={() => setViewing(null)} />
    </AppShell>
  );
}
