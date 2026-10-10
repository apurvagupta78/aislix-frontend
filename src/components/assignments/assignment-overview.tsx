import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, BellRing, ChevronDown, Eye, MoreHorizontal, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { FilterSearch, PreviewDrawer } from "@/components/design-system";
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
import { toUserMessage } from "@/lib/api/errors";
import {
  cancelAssignment,
  fetchAssignmentAttempts,
  isOverdue,
  requestReScan,
  scopeSummary,
  type Assignment,
} from "@/lib/assignments";
import { resolveAssignmentDisplayStatus } from "@/lib/assignment-status-ui";
import { AssignmentAttemptsList } from "@/components/scan-results/FixRescanVerifyPanel";
import { formatAssignmentId } from "@/components/AssignmentId";
import { formatScanDate, formatScanTime } from "@/lib/scan-history";
import { cn } from "@/lib/utils";

/* --------------------------------- status --------------------------------- */

export type OverviewStatus =
  | "not_started"
  | "in_progress"
  | "pending_review"
  | "needs_correction"
  | "overdue"
  | "approved"
  | "cancelled";

export const STATUS_ORDER: OverviewStatus[] = [
  "not_started",
  "in_progress",
  "pending_review",
  "needs_correction",
  "overdue",
  "approved",
  "cancelled",
];

export const STATUS_LABEL: Record<OverviewStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  pending_review: "Pending review",
  needs_correction: "Re-audit requested",
  overdue: "Overdue",
  approved: "Approved",
  cancelled: "Cancelled",
};

export const STATUS_DOT: Record<OverviewStatus, string> = {
  not_started: "bg-[#D9E2E8]",
  in_progress: "bg-[#7DB7D6]",
  pending_review: "bg-[#9B86D9]",
  needs_correction: "bg-[#ECBDCC]",
  overdue: "bg-[#ECBDCC]",
  approved: "bg-[#79E2A8]",
  cancelled: "bg-[#D9E2E8]",
};

export const OPEN_STATUSES: OverviewStatus[] = ["not_started", "in_progress", "needs_correction", "overdue"];

export function overviewStatus(row: Assignment): OverviewStatus {
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

export type AssignmentItem = { row: Assignment; status: OverviewStatus };

export function toAssignmentItems(rows: Assignment[]): AssignmentItem[] {
  return rows.map((row) => ({ row, status: overviewStatus(row) }));
}

export function StatusPill({ status }: { status: OverviewStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#D9E2E8] bg-white px-2 py-0.5 text-xs font-medium text-[#04203F]">
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

/* --------------------------------- display -------------------------------- */

export function auditTitle(row: Assignment): string {
  return row.scope_values.audit_name?.trim() || scopeSummary(row.scope_type, row.scope_values);
}

export function auditSubtitle(row: Assignment): string {
  return `${row.audit_mode === "digital" ? "Digital audit" : "AI audit"} · ${formatAssignmentId(row.id)}`;
}

export function formatCompliance(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function DueCell({ row, status, showTime }: { row: Assignment; status: OverviewStatus; showTime?: boolean }) {
  if (!row.due_at) return <span className="text-[#667085]">No due date</span>;
  return (
    <span className={cn("whitespace-nowrap", status === "overdue" ? "font-medium text-[#04203F]" : "text-[#667085]")}>
      {status === "overdue" ? (
        <span className="mr-1.5 inline-block size-1.5 rounded-full bg-[#ECBDCC] align-middle" aria-hidden />
      ) : null}
      {showTime ? formatScanTime(row.due_at) : formatScanDate(row.due_at)}
    </span>
  );
}

/* --------------------------------- filters -------------------------------- */

export type AssignmentFilters = {
  q: string;
  store: string;
  assignee: string;
  assigner: string;
  mode: "all" | "ai" | "digital";
  status: OverviewStatus | "all";
  dueFrom: string;
  dueTo: string;
};

export const EMPTY_ASSIGNMENT_FILTERS: AssignmentFilters = {
  q: "",
  store: "all",
  assignee: "all",
  assigner: "all",
  mode: "all",
  status: "all",
  dueFrom: "",
  dueTo: "",
};

export function activeAssignmentFilterCount(filters: AssignmentFilters): number {
  return [
    filters.store !== "all",
    filters.assignee !== "all",
    filters.assigner !== "all",
    filters.mode !== "all",
    filters.status !== "all",
    Boolean(filters.dueFrom),
    Boolean(filters.dueTo),
  ].filter(Boolean).length;
}

function localDayStart(day: string): number {
  return new Date(`${day}T00:00:00`).getTime();
}

export function matchesAssignmentFilters(item: AssignmentItem, filters: AssignmentFilters): boolean {
  const { row, status } = item;
  if (filters.store !== "all" && row.store_id !== filters.store) return false;
  if (filters.assignee !== "all" && row.assignee_id !== filters.assignee) return false;
  if (filters.assigner !== "all" && row.assigner_id !== filters.assigner) return false;
  if (filters.mode !== "all" && (row.audit_mode === "digital" ? "digital" : "ai") !== filters.mode) return false;
  if (filters.status !== "all" && status !== filters.status) return false;
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

type Option = { id: string; name: string };

function uniqueOptions(entries: [string, string][]): Option[] {
  const byId = new Map<string, string>();
  for (const [id, name] of entries) if (id && !byId.has(id)) byId.set(id, name);
  return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export function assignmentFilterOptions(rows: Assignment[]) {
  return {
    stores: uniqueOptions(rows.map((row): [string, string] => [row.store_id, row.store_name])),
    assignees: uniqueOptions(rows.map((row): [string, string] => [row.assignee_id, row.assignee_name])),
    assigners: uniqueOptions(rows.map((row): [string, string] => [row.assigner_id, row.assigner_name])),
  };
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
  options: Option[];
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

/** Search + collapsed "Filters" panel shared by Assignments and the audit calendar. */
export function AssignmentFilterBar({
  filters,
  onChange,
  onClear,
  options,
  defaultOpen = false,
  showStatus = false,
  showDueRange = true,
  matchCount,
  totalCount,
  extraNarrowed = false,
  actions,
}: {
  filters: AssignmentFilters;
  onChange: (patch: Partial<AssignmentFilters>) => void;
  onClear: () => void;
  options: ReturnType<typeof assignmentFilterOptions>;
  defaultOpen?: boolean;
  showStatus?: boolean;
  showDueRange?: boolean;
  /** When set, shows "x of y match" while any filter is active. */
  matchCount?: number;
  totalCount?: number;
  /** Narrowing applied outside the bar, e.g. a status tab. */
  extraNarrowed?: boolean;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const activeCount = activeAssignmentFilterCount(filters);
  const narrowed = activeCount > 0 || Boolean(filters.q.trim()) || extraNarrowed;

  return (
    <section className="space-y-3 rounded-xl border border-[#D9E2E8] bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSearch
          value={filters.q}
          onChange={(value) => onChange({ q: value })}
          placeholder="Search audit, assignment ID, store or person…"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-3 text-sm font-medium text-[#04203F] transition-colors hover:bg-[#F4F7F9]",
            activeCount > 0 ? "border-[#04203F]/40" : "border-[#D9E2E8]",
          )}
        >
          <SlidersHorizontal className="size-4 text-[#667085]" aria-hidden />
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
          <ChevronDown className={cn("size-4 text-[#667085] transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {actions}
      </div>

      {open ? (
        <div className="grid gap-3 border-t border-[#D9E2E8] pt-3 sm:grid-cols-2 lg:grid-cols-3">
          <FilterField label="Store">
            <OptionSelect
              value={filters.store}
              onChange={(v) => onChange({ store: v })}
              allLabel="All stores"
              options={options.stores}
              ariaLabel="Filter by store"
            />
          </FilterField>
          <FilterField label="Assigned to">
            <OptionSelect
              value={filters.assignee}
              onChange={(v) => onChange({ assignee: v })}
              allLabel="Anyone"
              options={options.assignees}
              ariaLabel="Filter by assignee"
            />
          </FilterField>
          <FilterField label="Assigned by">
            <OptionSelect
              value={filters.assigner}
              onChange={(v) => onChange({ assigner: v })}
              allLabel="Anyone"
              options={options.assigners}
              ariaLabel="Filter by who assigned the audit"
            />
          </FilterField>
          <FilterField label="Mode">
            <OptionSelect
              value={filters.mode}
              onChange={(v) => onChange({ mode: v as AssignmentFilters["mode"] })}
              allLabel="AI and Digital"
              options={[
                { id: "ai", name: "AI audit" },
                { id: "digital", name: "Digital audit" },
              ]}
              ariaLabel="Filter by audit mode"
            />
          </FilterField>
          {showStatus ? (
            <FilterField label="Status">
              <OptionSelect
                value={filters.status}
                onChange={(v) => onChange({ status: v as AssignmentFilters["status"] })}
                allLabel="All statuses"
                options={STATUS_ORDER.map((id) => ({ id, name: STATUS_LABEL[id] }))}
                ariaLabel="Filter by status"
              />
            </FilterField>
          ) : null}
          {showDueRange ? (
            <>
              <FilterField label="Due from">
                <Input
                  type="date"
                  value={filters.dueFrom}
                  max={filters.dueTo || undefined}
                  onChange={(e) => onChange({ dueFrom: e.target.value })}
                  className="h-10 rounded-lg"
                  aria-label="Due from"
                />
              </FilterField>
              <FilterField label="Due to">
                <Input
                  type="date"
                  value={filters.dueTo}
                  min={filters.dueFrom || undefined}
                  onChange={(e) => onChange({ dueTo: e.target.value })}
                  className="h-10 rounded-lg"
                  aria-label="Due to"
                />
              </FilterField>
            </>
          ) : null}
        </div>
      ) : null}

      {narrowed ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
          {matchCount !== undefined && totalCount !== undefined ? (
            <span>
              {matchCount.toLocaleString()} of {totalCount.toLocaleString()} assignments match
            </span>
          ) : (
            <span>Filters active</span>
          )}
          <Button variant="ghost" size="sm" className="h-7 rounded-lg px-2 text-xs" onClick={onClear}>
            Clear all
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------ row actions ------------------------------- */

export function useAssignmentRowActions() {
  const queryClient = useQueryClient();
  const remind = useMutation({
    mutationFn: (row: Assignment) => requestReScan(row),
    onSuccess: () => toast.success("Assignee reminded to re-audit"),
    onError: (error) => toast.error(toUserMessage(error)),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelAssignment(id),
    onSuccess: () => {
      toast.success("Assignment cancelled");
      void queryClient.invalidateQueries({ queryKey: ["assignments-overview"] });
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });
  return { remind, cancel };
}

export function RowCta({
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

export function RowMenu({
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

export function AssignmentDetailsDrawer({
  row,
  onClose,
  footer,
}: {
  row: Assignment | null;
  onClose: () => void;
  footer?: ReactNode;
}) {
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
        ["Due", row.due_at ? `${formatScanDate(row.due_at)} ${formatScanTime(row.due_at)}` : "No due date"],
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
          {footer}
        </div>
      ) : null}
    </PreviewDrawer>
  );
}

/* ---------------------------------- table --------------------------------- */

export type AssignmentSelection = {
  selectedIds: string[];
  toggleRow: (id: string, checked: boolean) => void;
  togglePage: (checked: boolean) => void;
  allPageSelected: boolean;
};

/** Assignment rows as a table (desktop) and cards (phone), with the row CTA pinned right. */
export function AssignmentRowsTable({
  items,
  userId,
  isManager,
  onView,
  selection,
  showTime = false,
}: {
  items: AssignmentItem[];
  userId: string;
  isManager: boolean;
  onView: (row: Assignment) => void;
  selection?: AssignmentSelection;
  /** Show the due time instead of the due date (single-day lists). */
  showTime?: boolean;
}) {
  const { remind, cancel } = useAssignmentRowActions();
  const canManage = (row: Assignment) => isManager || row.assigner_id === userId;
  const menu = (row: Assignment, status: OverviewStatus) => (
    <RowMenu
      row={row}
      status={status}
      canManage={canManage(row)}
      onView={() => onView(row)}
      onRemind={() => remind.mutate(row)}
      onCancel={() => cancel.mutate(row.id)}
    />
  );

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {selection ? (
                <TableHead className="w-10">
                  <Checkbox
                    checked={selection.allPageSelected}
                    onCheckedChange={(c) => selection.togglePage(Boolean(c))}
                    aria-label="Select all on this page"
                  />
                </TableHead>
              ) : null}
              <TableHead>Audit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Assigned to</TableHead>
              <TableHead>Assigned by</TableHead>
              <TableHead>{showTime ? "Due time" : "Due"}</TableHead>
              <TableHead className="text-right">Compliance</TableHead>
              <TableHead className="sticky right-0 bg-white text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(({ row, status }) => (
              <TableRow key={row.id} className="group transition-colors hover:bg-[#F4F7F9]">
                {selection ? (
                  <TableCell>
                    <Checkbox
                      checked={selection.selectedIds.includes(row.id)}
                      onCheckedChange={(c) => selection.toggleRow(row.id, Boolean(c))}
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
                  <DueCell row={row} status={status} showTime={showTime} />
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium text-[#04203F]">
                  {formatCompliance(row.compliance_percent)}
                </TableCell>
                <TableCell className="sticky right-0 border-l border-[#D9E2E8] bg-white text-right transition-colors group-hover:bg-[#F4F7F9]">
                  <div className="flex items-center justify-end gap-1">
                    <RowCta row={row} status={status} userId={userId} isManager={isManager} onView={() => onView(row)} />
                    {menu(row, status)}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y divide-[#D9E2E8] md:hidden">
        {items.map(({ row, status }) => (
          <li key={row.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                {selection ? (
                  <Checkbox
                    className="mt-0.5"
                    checked={selection.selectedIds.includes(row.id)}
                    onCheckedChange={(c) => selection.toggleRow(row.id, Boolean(c))}
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
                {
                  l: showTime ? "Due time" : "Due",
                  v: row.due_at ? (showTime ? formatScanTime(row.due_at) : formatScanDate(row.due_at)) : "No due date",
                },
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
                onView={() => onView(row)}
                className="flex-1"
              />
              {menu(row, status)}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
