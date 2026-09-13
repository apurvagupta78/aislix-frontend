import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/States";
import { complianceTone } from "@/lib/planogram-compliance";
import { toUserMessage } from "@/lib/api/errors";
import {
  fetchAssignmentAttempts,
  fetchAssignmentById,
  isOrgManager,
  verifyAssignmentPass,
  type Assignment,
  type AssignmentAttempt,
} from "@/lib/assignments";

export function AssignmentAttemptsList({
  attempts,
  currentScanId,
  compact = false,
}: {
  attempts: AssignmentAttempt[];
  currentScanId?: string;
  compact?: boolean;
}) {
  if (!attempts.length) return null;
  return (
    <ol className={compact ? "space-y-1.5" : "space-y-2"}>
      {attempts.map((attempt) => (
        <AttemptRow
          key={attempt.scan_id}
          attempt={attempt}
          currentScanId={currentScanId}
          compact={compact}
        />
      ))}
    </ol>
  );
}

export function FixRescanVerifyPanel({
  assignmentId,
  scanId,
}: {
  assignmentId: string;
  scanId?: string;
}) {
  const queryClient = useQueryClient();
  const assignmentQuery = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: () => fetchAssignmentById(assignmentId),
  });
  const attemptsQuery = useQuery({
    queryKey: ["assignment-attempts", assignmentId],
    queryFn: () => fetchAssignmentAttempts(assignmentId),
    enabled: Boolean(assignmentId),
  });
  const managerQuery = useQuery({
    queryKey: ["is-org-manager"],
    queryFn: () => isOrgManager(),
    staleTime: 60_000,
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyAssignmentPass(assignmentId),
    onSuccess: () => {
      toast.success("Assignment verified and signed off");
      void queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] });
      void queryClient.invalidateQueries({ queryKey: ["org-assignments"] });
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

  const loading = assignmentQuery.isPending || attemptsQuery.isPending;
  const assignment = assignmentQuery.data;
  const attempts = attemptsQuery.data ?? [];

  if (loading) {
    return (
      <div className="card-surface p-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-3 h-16 w-full" />
      </div>
    );
  }
  if (!assignment) return null;

  const passed = assignment.status === "completed";
  const needsFix = assignment.status === "needs_correction";
  const first = attempts[0];
  const latest = attempts[attempts.length - 1];
  const improved =
    first && latest && first.compliance_percent !== null && latest.compliance_percent !== null
      ? latest.compliance_percent - first.compliance_percent
      : null;
  const isManager = managerQuery.data === true;
  const awaitingSignOff = passed && !assignment.verified_at;

  return (
    <div className="card-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <ClipboardList className="size-3.5" /> Assigned audit loop
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight">
            {assignment.store_name}
            {assignment.location ? ` · ${assignment.location}` : ""}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Attempt {assignment.scan_attempts || attempts.length} ·{" "}
            {assignment.open_issue_count} open issue
            {assignment.open_issue_count === 1 ? "" : "s"}
          </p>
        </div>
        <AssignmentStatusBadge assignment={assignment} />
      </div>

      {attempts.length > 0 && (
        <div className="mt-4">
          <AssignmentAttemptsList attempts={attempts} currentScanId={scanId} />
        </div>
      )}

      {needsFix && (
        <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
          <p className="text-sm font-medium text-warning">Fix shelf → re-audit → verify</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Correct the open issues on shelf, then re-audit the same assignment. Compliance updates
            automatically on each attempt.
          </p>
          <Button asChild variant="brand" size="sm" className="mt-3 rounded-xl">
            <Link to="/audit" search={{ assignmentId: assignment.id }}>
              <RefreshCw className="size-4" /> Fix & re-audit
            </Link>
          </Button>
        </div>
      )}

      {awaitingSignOff && isManager && (
        <div className="mt-4 rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-sm font-medium">Manager sign-off</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Shelf passed compliance checks. Confirm execution to close this assignment.
          </p>
          <Button
            variant="brand"
            size="sm"
            className="mt-3 rounded-xl"
            disabled={verifyMutation.isPending}
            onClick={() => verifyMutation.mutate()}
          >
            <ShieldCheck className="size-4" /> Verify & sign off
          </Button>
        </div>
      )}

      {passed && (
        <div className="mt-4 rounded-xl border border-accent-green/30 bg-accent-green/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-accent-green">
            <CheckCircle2 className="size-4" />
            {assignment.verified_at
              ? "Manager verified — assignment closed"
              : "Assignment passed — 100% compliance"}
          </p>
          {improved !== null && improved > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Improved {Math.round(first!.compliance_percent!)}% → {Math.round(latest!.compliance_percent!)}%
              across {attempts.length} attempt{attempts.length === 1 ? "" : "s"}.
            </p>
          )}
          {attempts.length >= 2 && (
            <Button asChild variant="subtle" size="sm" className="mt-3 rounded-xl">
              <Link
                to="/compare"
                search={{ a: attempts[0]!.scan_id, b: attempts[attempts.length - 1]!.scan_id }}
              >
                Compare first vs latest attempt
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function AssignmentStatusBadge({ assignment }: { assignment: Assignment }) {
  if (assignment.status === "completed" && assignment.verified_at) {
    return (
      <Badge className="rounded-full bg-accent-green/15 text-accent-green hover:bg-accent-green/15">
        <ShieldCheck className="mr-1 size-3" /> Manager verified
      </Badge>
    );
  }
  if (assignment.status === "completed") {
    return (
      <Badge className="rounded-full bg-accent-green/15 text-accent-green hover:bg-accent-green/15">
        <ShieldCheck className="mr-1 size-3" /> Passed
      </Badge>
    );
  }
  if (assignment.status === "needs_correction") {
    return (
      <Badge variant="outline" className="rounded-full border-warning/40 text-warning">
        Needs correction
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="rounded-full capitalize">
      {assignment.status.replace(/_/g, " ")}
    </Badge>
  );
}

function AttemptRow({
  attempt,
  currentScanId,
  compact = false,
}: {
  attempt: AssignmentAttempt;
  currentScanId?: string;
  compact?: boolean;
}) {
  const isCurrent = attempt.scan_id === currentScanId;
  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-xl border border-border bg-surface text-sm ${
        compact ? "px-3 py-2" : "px-4 py-2.5"
      }`}
    >
      <div>
        <p className="font-medium">
          Attempt {attempt.attempt}
          {isCurrent && (
            <span className="ml-2 text-xs font-normal text-brand">(this audit)</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(attempt.created_at).toLocaleString()}
        </p>
      </div>
      <div className="text-right">
        {attempt.compliance_percent !== null ? (
          <span className={`font-semibold tabular-nums ${complianceTone(attempt.compliance_percent)}`}>
            {Math.round(attempt.compliance_percent)}%
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        {attempt.open_issues > 0 && (
          <p className="text-xs text-muted-foreground">{attempt.open_issues} open</p>
        )}
      </div>
    </li>
  );
}
