/**
 * Inline "assign audit" dialog used on the Planogram page.
 *
 * The store and the audit scope come from the store's active planogram, so the
 * manager only picks a team member (plus optional due date / instructions).
 */

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { formatAssignmentId } from "@/components/AssignmentId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toUserMessage } from "@/lib/api/errors";
import {
  createScanAssignment,
  fetchAssignableMembers,
  type ScopeType,
} from "@/lib/assignments";

export type PlanogramScopeRow = {
  location: string;
  category: string;
  sub_category: string;
};

function mode(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** Dominant category / sub-category / location of the active planogram. */
export function dominantScope(rows: PlanogramScopeRow[]): {
  category: string;
  subCategory: string;
  location: string;
} {
  return {
    category: mode(rows.map((row) => row.category)),
    subCategory: mode(rows.map((row) => row.sub_category)),
    location: mode(rows.map((row) => row.location)),
  };
}

export function AssignScanDialog({
  open,
  onOpenChange,
  storeId,
  storeName,
  rows,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  rows: PlanogramScopeRow[];
}) {
  const [assigneeId, setAssigneeId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [instructions, setInstructions] = useState("");

  const scope = useMemo(() => dominantScope(rows), [rows]);

  const membersQuery = useQuery({
    queryKey: ["assignable-members"],
    queryFn: () => fetchAssignableMembers(),
    retry: false,
    enabled: open,
  });
  const members = membersQuery.data ?? [];
  const assignee = members.find((member) => member.user_id === assigneeId);

  const scopeType: ScopeType = scope.location
    ? "location"
    : scope.subCategory
      ? "sub_category"
      : "category";

  const expected = rows.filter((row) => {
    if (scopeType === "location") return row.location?.trim() === scope.location;
    if (scopeType === "sub_category")
      return row.category === scope.category && row.sub_category === scope.subCategory;
    return row.category === scope.category;
  }).length;

  const assignMutation = useMutation({
    mutationFn: () =>
      createScanAssignment({
        storeId,
        scopeType,
        scopeValues: {
          ...(scope.category ? { category: scope.category } : {}),
          ...(scope.subCategory ? { sub_category: scope.subCategory } : {}),
          ...(scope.location ? { location: scope.location } : {}),
        },
        assigneeId,
        assigneeName: assignee?.name ?? "team member",
        dueAt: dueAt || null,
        instructions,
      }),
    onSuccess: (assignmentId) => {
      toast.success(
        `Audit assigned to ${assignee?.name ?? "team member"} — ID: ${formatAssignmentId(assignmentId)}`,
      );
      setAssigneeId("");
      setDueAt("");
      setInstructions("");
      onOpenChange(false);
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign audit</DialogTitle>
          <DialogDescription>
            Scope comes from this store&apos;s active planogram — just pick who audits it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-sm font-medium text-foreground">Store · {storeName}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {scope.category && <Badge variant="secondary">{scope.category}</Badge>}
              {scope.subCategory && <Badge variant="secondary">{scope.subCategory}</Badge>}
              {scope.location && <Badge variant="secondary">{scope.location}</Badge>}
              <Badge variant="outline">{expected} expected products</Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Read-only — set by the active planogram.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Assign to team member</Label>
            {membersQuery.isLoading ? (
              <Skeleton className="h-10 w-full rounded-xl" />
            ) : members.length ? (
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select a team member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.name}
                      {member.email ? ` · ${member.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                Invite a team member first —{" "}
                <Link to="/team" className="font-medium text-brand underline">
                  go to Team
                </Link>
                .
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="assign-due">Due date (optional)</Label>
              <Input
                id="assign-due"
                type="date"
                className="rounded-xl"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="assign-instructions">Instructions (optional)</Label>
              <Textarea
                id="assign-instructions"
                className="rounded-xl"
                rows={3}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="brand"
            className="rounded-xl"
            disabled={assignMutation.isPending || !assigneeId}
            onClick={() => assignMutation.mutate()}
          >
            {assignMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 size-4" />
            )}
            Assign audit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}'