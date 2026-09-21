import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  CircleSlash,
  Clock,
  Loader2,
  PencilLine,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AssignmentStatus } from "@/lib/assignments";
import type { TemplateStatus } from "@/lib/audit-templates";

type ScanStatus = "completed" | "processing" | "failed";

type Meta = { label: string; className: string; Icon: LucideIcon };

const GOOD = "bg-status-good-soft text-status-good-strong";
const WARN = "bg-status-warn-soft text-status-warn-strong";
const DANGER = "bg-status-danger-soft text-status-danger-strong";
const INFO = "bg-status-info-soft text-status-info-strong";
const NEUTRAL = "bg-muted text-muted-foreground";

const assignmentMeta: Record<AssignmentStatus | "overdue" | "submitted" | "pending_review" | "approved", Meta> = {
  pending: { label: "Not Started", className: WARN, Icon: Clock },
  in_progress: { label: "In Progress", className: INFO, Icon: Loader2 },
  needs_correction: { label: "Re-audit Requested", className: WARN, Icon: Wrench },
  completed: { label: "Approved", className: GOOD, Icon: CheckCircle2 },
  cancelled: { label: "Cancelled", className: NEUTRAL, Icon: CircleSlash },
  overdue: { label: "Overdue", className: DANGER, Icon: AlertTriangle },
  submitted: { label: "Submitted", className: INFO, Icon: CheckCircle2 },
  pending_review: { label: "Pending Review", className: WARN, Icon: Clock },
  approved: { label: "Approved", className: GOOD, Icon: CheckCircle2 },
};

const scanMeta: Record<ScanStatus, Meta> = {
  completed: { label: "Approved", className: GOOD, Icon: CheckCircle2 },
  processing: { label: "In Progress", className: INFO, Icon: Loader2 },
  failed: { label: "Failed", className: DANGER, Icon: AlertTriangle },
};

const templateMeta: Record<TemplateStatus, Meta> = {
  draft: { label: "Draft", className: NEUTRAL, Icon: PencilLine },
  published: { label: "Live", className: GOOD, Icon: CheckCircle2 },
  archived: { label: "Archived", className: NEUTRAL, Icon: Archive },
};

type Props = {
  className?: string;
} & (
  | {
      kind: "assignment";
      status:
        | AssignmentStatus
        | "overdue"
        | "submitted"
        | "pending_review"
        | "approved";
    }
  | { kind: "scan"; status: ScanStatus }
  | { kind: "template"; status: TemplateStatus; published?: boolean }
);

function Pill({ meta, className }: { meta: Meta; className?: string }) {
  const { Icon } = meta;
  return (
    <Badge
      role="status"
      variant="secondary"
      className={cn(
        "gap-1.5 rounded-full border-0 px-2.5 py-1 text-xs font-semibold",
        meta.className,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {meta.label}
    </Badge>
  );
}

/** Unified visual status pill — icon + plain word + colour, never colour alone. */
export function StatusBadge(props: Props) {
  const { className } = props;

  if (props.kind === "assignment") {
    return <Pill meta={assignmentMeta[props.status] ?? assignmentMeta.pending} className={className} />;
  }

  if (props.kind === "scan") {
    return <Pill meta={scanMeta[props.status]} className={className} />;
  }

  const status =
    props.status === "archived"
      ? "archived"
      : props.status === "published" || props.published
        ? "published"
        : "draft";
  return <Pill meta={templateMeta[status]} className={className} />;
}
