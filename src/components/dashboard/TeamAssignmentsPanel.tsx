/**
 * Dashboard widget: the latest delegated scans for the active organization.
 * Rendered only for owners / admins / managers.
 */

import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState } from "@/components/States";
import {
  fetchOrgAssignments,
  isOrgManager,
  isOverdue,
  scopeSummary,
  type Assignment,
} from "@/lib/assignments";

const statusLabels: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  needs_correction: "Needs correction",
  completed: "Completed",
  cancelled: "Cancelled",
  overdue: "Overdue",
};

const statusClasses: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-brand-soft text-brand",
  needs_correction: "bg-amber-500/12 text-amber-600",
  completed: "bg-accent-green/12 text-accent-green",
  cancelled: "bg-muted text-muted-foreground",
  overdue: "bg-destructive/10 text-destructive",
};

function complianceTone(value: number | null): string {
  if (value === null) return "text-muted-foreground";
  if (value >= 100) return "text-accent-green";
  if (value >= 70) return "text-amber-600";
  return "text-destructive";
}

function formatDue(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function effectiveStatus(assignment: Assignment): string {
  return isOverdue(assignment) ? "overdue" : assignment.status;
}

export function TeamAssignmentsPanel() {
  const accessQuery = useQuery({
    queryKey: ["assignment-manager"],
    queryFn: () => isOrgManager(),
    retry: false,
  });

  const assignmentsQuery = useQuery({
    queryKey: ["dashboard-team-assignments"],
    queryFn: () => fetchOrgAssignments(),
    enabled: accessQuery.data === true,
    retry: false,
  });

  if (accessQuery.data !== true) return null;

  const items = (assignmentsQuery.data ?? []).slice(0, 10);

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Team assignments
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The latest shelf audits delegated to your team, with planogram compliance.
          </p>
        </div>
        <Button asChild variant="subtle" size="sm" className="rounded-xl">
          <Link to="/assigned-scans">View all</Link>
        </Button>
      </div>

      <div className="card-surface mt-4 p-4 sm:p-5">
        {assignmentsQuery.isPending ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : assignmentsQuery.isError ? (
          <ErrorState
            title="Couldn't load team assignments"
            description={
              assignmentsQuery.error instanceof Error ? assignmentsQuery.error.message : undefined
            }
            onRetry={() => void assignmentsQuery.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title="No assignments yet"
            description="Delegate a shelf audit to a team member and track it to 100% compliance."
            action={
              <Button asChild variant="brand" size="sm" className="rounded-xl">
                <Link to="/assign-scan" search={{}}>Assign a scan</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Compliance</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((assignment) => {
                    const status = effectiveStatus(assignment);
                    const compliance = assignment.last_compliance_percent;
                    return (
                      <TableRow key={assignment.id}>
                        <TableCell className="font-medium">{assignment.assignee_name}</TableCell>
                        <TableCell className="max-w-[180px] truncate">
                          {assignment.store_name}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                          {assignment.location ??
                            scopeSummary(assignment.scope_type, assignment.scope_values)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`rounded-full border-0 font-medium ${statusClasses[status] ?? ""}`}
                          >
                            {statusLabels[status] ?? status}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-medium ${complianceTone(compliance ?? null)}`}
                        >
                          {compliance === null || compliance === undefined
                            ? "—"
                            : `${Math.round(compliance)}%`}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDue(assignment.due_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          {assignment.scan_id ? (
                            <Button asChild variant="ghost" size="sm" className="rounded-lg">
                              <Link to="/results" search={{ scan: assignment.scan_id }}>
                                View
                              </Link>
                            </Button>
                          ) : (
                            <Button asChild variant="ghost" size="sm" className="rounded-lg">
                              <Link to="/assigned-scans">Open</Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <ul className="space-y-3 md:hidden">
              {items.map((assignment) => {
                const status = effectiveStatus(assignment);
                const compliance = assignment.last_compliance_percent;
                return (
                  <li
                    key={assignment.id}
                    className="rounded-2xl border border-border bg-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{assignment.assignee_name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {assignment.store_name} ·{" "}
                          {assignment.location ??
                            scopeSummary(assignment.scope_type, assignment.scope_values)}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`shrink-0 rounded-full border-0 font-medium ${statusClasses[status] ?? ""}`}
                      >
                        {statusLabels[status] ?? status}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Due {formatDue(assignment.due_at)}</span>
                      <span className={`font-semibold ${complianceTone(compliance ?? null)}`}>
                        {compliance === null || compliance === undefined
                          ? "—"
                          : `${Math.round(compliance)}% compliant`}
                      </span>
                    </div>
                    <Button asChild variant="subtle" size="sm" className="mt-3 w-full rounded-xl">
                      {assignment.scan_id ? (
                        <Link to="/results" search={{ scan: assignment.scan_id }}>
                          View results
                        </Link>
                      ) : (
                        <Link to="/assigned-scans">Open assignment</Link>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
