import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CollectionMethodBadge,
  WorkflowBadge,
} from "@/components/audit/AuditStatusBadges";
import { findingSeverityMeta } from "@/lib/findings";
import { actionPriorityClass } from "@/lib/corrective-action-lifecycle";

export { CollectionMethodBadge as SourceBadge, WorkflowBadge as AuditWorkflowBadge };

export function FindingSeverityBadge({
  severity,
  className,
}: {
  severity: string;
  className?: string;
}) {
  const meta = findingSeverityMeta(severity);
  return (
    <Badge className={cn("rounded-full border-0", meta.className, className)}>
      {meta.label}
    </Badge>
  );
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: string;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("rounded-full border-0 capitalize", actionPriorityClass(priority), className)}
    >
      {priority}
    </Badge>
  );
}

export function FindingStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const tone =
    status === "closed" || status === "resolved"
      ? "bg-accent-green/12 text-accent-green"
      : status === "pending_verification"
        ? "bg-brand-soft text-brand"
        : status === "rejected"
          ? "bg-destructive/10 text-destructive"
          : status === "in_progress" || status === "assigned"
            ? "bg-warning/10 text-warning"
            : "bg-muted text-muted-foreground";
  return (
    <Badge variant="secondary" className={cn("rounded-full border-0 capitalize", tone, className)}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

export function ActionStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return <FindingStatusBadge status={status} className={className} />;
}

export function LockedRecordBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("rounded-full text-muted-foreground", className)}>
      Audit record locked
    </Badge>
  );
}

export function AiSuggestedBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("rounded-full border-amber-500/30 bg-amber-500/10 text-amber-700", className)}>
      AI suggested
    </Badge>
  );
}

export function HumanConfirmedBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("rounded-full border-accent-green/30 bg-accent-green/10 text-accent-green", className)}>
      Human confirmed
    </Badge>
  );
}
