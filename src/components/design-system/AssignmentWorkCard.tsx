import type { ReactNode } from "react";
import { Calendar, MapPin, User } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Assignment } from "@/lib/assignments";
import { isOverdue } from "@/lib/assignments";
import { formatAssignmentDueDate } from "@/lib/assignment-display";
import { SLAIndicator, slaToneFromDueDate } from "./SLAIndicator";
import { StatusBadge } from "./StatusBadge";
import { resolveAssignmentDisplayStatus } from "@/lib/assignment-status-ui";

type Props = {
  assignment: Assignment;
  scopeLine: string;
  selected?: boolean;
  onSelect?: (checked: boolean) => void;
  showCheckbox?: boolean;
  footer?: ReactNode;
  className?: string;
};

/** Visual work card — who, where, when, status at a glance. */
export function AssignmentWorkCard({
  assignment,
  scopeLine,
  selected,
  onSelect,
  showCheckbox,
  footer,
  className,
}: Props) {
  const overdue = isOverdue(assignment);
  const displayStatus = resolveAssignmentDisplayStatus({
    status: assignment.status,
    approval_status: assignment.approval_status,
    overdue,
  });
  const badgeStatus =
    displayStatus === "overdue" ||
    displayStatus === "pending_review" ||
    displayStatus === "submitted" ||
    displayStatus === "approved"
      ? displayStatus
      : displayStatus === "needs_correction"
        ? "needs_correction"
        : (assignment.status as typeof assignment.status);
  const slaTone = slaToneFromDueDate(assignment.due_at, assignment.status);
  const progress =
    assignment.status === "completed"
      ? 100
      : assignment.status === "in_progress"
        ? 50
        : assignment.scan_attempts > 0
          ? 35
          : 0;

  return (
    <article
      className={cn(
        "play-card flex flex-col gap-3 rounded-2xl p-4 transition-shadow hover:shadow-md",
        selected && "ring-2 ring-brand/30",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {showCheckbox ? (
          <Checkbox
            className="mt-1"
            checked={selected}
            onCheckedChange={(c) => onSelect?.(Boolean(c))}
            aria-label="Select assignment"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="assignment" status={badgeStatus} />
            {slaTone && slaTone !== "completed" ? (
              <SLAIndicator tone={slaTone} compact />
            ) : null}
          </div>
          <p className="mt-2 text-sm font-semibold leading-snug">{scopeLine}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <User className="size-3.5 shrink-0" aria-hidden />
          <div>
            <dt className="sr-only">Assigned to</dt>
            <dd className="font-medium text-foreground">{assignment.assignee_name}</dd>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <div>
            <dt className="sr-only">Location</dt>
            <dd className="truncate font-medium text-foreground">{assignment.store_name}</dd>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="size-3.5 shrink-0" aria-hidden />
          <div>
            <dt className="sr-only">Due</dt>
            <dd className="font-medium text-foreground">
              {formatAssignmentDueDate(assignment.due_at)}
            </dd>
          </div>
        </div>
      </dl>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              assignment.status === "completed"
                ? "bg-status-good"
                : overdue
                  ? "bg-status-danger"
                  : "bg-brand",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {footer ? <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">{footer}</div> : null}
    </article>
  );
}
