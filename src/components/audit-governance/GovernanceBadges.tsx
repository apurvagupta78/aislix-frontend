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
      ? "bg-[var(--aislix-supermarket-bg)] text-[var(--aislix-primary)]"
      : status === "pending_verification"
        ? "bg-[var(--aislix-warehouse-bg)] text-[var(--aislix-primary)]"
        : status === "rejected"
          ? "bg-[var(--aislix-darkstore-bg)] text-[var(--aislix-primary)]"
          : status === "in_progress" || status === "assigned"
            ? "bg-[var(--aislix-local-bg)] text-[var(--aislix-primary)]"
            : "bg-[var(--aislix-custom-bg)] text-[var(--aislix-secondary)]";
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
    <Badge variant="outline" className={cn("rounded-full border-status-info bg-status-info-soft text-status-info-strong", className)}>
      AI suggested
    </Badge>
  );
}

export function HumanConfirmedBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("rounded-full border-[var(--aislix-supermarket-border)] bg-[var(--aislix-supermarket-bg)] text-[var(--aislix-primary)]", className)}>
      Human confirmed
    </Badge>
  );
}
