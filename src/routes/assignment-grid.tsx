import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Grid3X3, Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import { fetchAssignableMembers, isOrgManager } from "@/lib/assignments";
import {
  bulkCancelAssignments,
  bulkUpdateAssignmentGrid,
  exportAssignmentGridCsv,
  fetchAssignmentGridRows,
  updateAssignmentGridRow,
  type AssignmentState,
} from "@/lib/assignment-engine";

export const Route = createFileRoute("/assignment-grid")({
  head: () => ({ meta: [{ title: "Assignment Grid — Aislix" }] }),
  component: AssignmentGridPage,
});

const STATE_OPTIONS: AssignmentState[] = [
  "assigned",
  "accepted",
  "in_progress",
  "submitted",
  "under_review",
  "approved",
  "overdue",
  "cancelled",
];

function AssignmentGridPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [bulkDue, setBulkDue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const accessQuery = useQuery({
    queryKey: ["assignment-manager"],
    queryFn: () => isOrgManager(),
  });

  const gridQuery = useQuery({
    queryKey: ["assignment-grid", statusFilter],
    queryFn: () =>
      fetchAssignmentGridRows(statusFilter === "all" ? undefined : { status: statusFilter }),
    enabled: accessQuery.data === true,
  });

  const membersQuery = useQuery({
    queryKey: ["assignable-members"],
    queryFn: fetchAssignableMembers,
    enabled: accessQuery.data === true,
  });

  const updateMutation = useMutation({
    mutationFn: updateAssignmentGridRow,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assignment-grid"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const bulkMutation = useMutation({
    mutationFn: bulkUpdateAssignmentGrid,
    onSuccess: () => {
      toast.success("Bulk update applied.");
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ["assignment-grid"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const bulkCancelMutation = useMutation({
    mutationFn: bulkCancelAssignments,
    onSuccess: () => {
      toast.success("Selected assignments cancelled.");
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ["assignment-grid"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const rows = gridQuery.data ?? [];
  const allSelected = rows.length > 0 && selected.size === rows.length;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const memberMap = useMemo(
    () => new Map((membersQuery.data ?? []).map((m) => [m.user_id, m.name])),
    [membersQuery.data],
  );

  if (accessQuery.isLoading) {
    return (
      <AppShell title="Assignment Grid">
        <Skeleton className="h-40 w-full" />
      </AppShell>
    );
  }

  if (!accessQuery.data) {
    return (
      <AppShell title="Assignment Grid">
        <ErrorState title="Manager access required" description="Only managers can edit the assignment grid." />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Assignment Grid"
      description="Override location → employee → due date → status for every generated assignment. Supports bulk reassignment."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/assigned-scans">Review & Approvals</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/audit-schedules">Recurring Schedules</Link>
        </Button>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportAssignmentGridCsv(rows, "aislix-assignment-grid.csv", statusFilter)}
          disabled={!rows.length}
        >
          <Download className="mr-1 size-4" />
          Download CSV
        </Button>
      </div>

      {selected.size > 0 ? (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-muted/30 p-4">
          <p className="text-sm font-medium">{selected.size} selected</p>
          <Select value={bulkAssignee} onValueChange={setBulkAssignee}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Reassign to..." />
            </SelectTrigger>
            <SelectContent>
              {(membersQuery.data ?? []).map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="datetime-local"
            className="w-52"
            value={bulkDue}
            onChange={(e) => setBulkDue(e.target.value)}
          />
          <Button
            size="sm"
            disabled={bulkMutation.isPending || (!bulkAssignee && !bulkDue)}
            onClick={() =>
              bulkMutation.mutate({
                assignmentIds: [...selected],
                assigneeId: bulkAssignee || undefined,
                dueAt: bulkDue ? new Date(bulkDue).toISOString() : undefined,
              })
            }
          >
            {bulkMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="mr-1 size-4" />
                Bulk apply
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={bulkCancelMutation.isPending}
            onClick={() => bulkCancelMutation.mutate([...selected])}
          >
            {bulkCancelMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="mr-1 size-4" />
                Bulk cancel
              </>
            )}
          </Button>
        </div>
      ) : null}

      {gridQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !rows.length ? (
        <EmptyState
          icon={Grid3X3}
          title="No assignments yet"
          description="Assignments from campaigns and recurring schedules appear here for manager overrides."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggleOne(row.id)} />
                  </TableCell>
                  <TableCell className="font-medium">{row.store_name}</TableCell>
                  <TableCell>
                    <Select
                      value={row.assignee_id}
                      onValueChange={(v) =>
                        updateMutation.mutate({ assignmentId: row.id, assigneeId: v })
                      }
                    >
                      <SelectTrigger className="h-8 min-w-[140px]">
                        <SelectValue>{memberMap.get(row.assignee_id) ?? row.assignee_name}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(membersQuery.data ?? []).map((m) => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="datetime-local"
                      className="h-8 w-44"
                      defaultValue={row.due_at?.slice(0, 16) ?? ""}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        const iso = new Date(val).toISOString();
                        if (iso !== row.due_at) {
                          updateMutation.mutate({ assignmentId: row.id, dueAt: iso });
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.status}
                      onValueChange={(v) =>
                        updateMutation.mutate({ assignmentId: row.id, status: v })
                      }
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.assignment_state}
                      onValueChange={(v) =>
                        updateMutation.mutate({
                          assignmentId: row.id,
                          assignmentState: v as AssignmentState,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATE_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
