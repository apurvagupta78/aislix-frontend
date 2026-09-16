import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AssignmentStatus } from "@/lib/assignments";
import type { TemplateStatus } from "@/lib/audit-templates";

type ScanStatus = "completed" | "processing" | "failed";

const assignmentMeta: Record<
  AssignmentStatus | "overdue",
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-amber-50 text-amber-900" },
  in_progress: { label: "In progress", className: "bg-brand-soft text-brand" },
  needs_correction: { label: "Needs correction", className: "bg-amber-50 text-amber-900" },
  completed: { label: "Completed", className: "bg-emerald-50 text-emerald-800" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-600" },
  overdue: { label: "Overdue", className: "bg-red-50 text-red-800" },
};

const scanMeta: Record<ScanStatus, { label: string; className: string }> = {
  completed: { label: "Completed", className: "bg-emerald-50 text-emerald-800" },
  processing: { label: "Processing", className: "bg-brand-soft text-brand" },
  failed: { label: "Failed", className: "bg-red-50 text-red-800" },
};

const templateMeta: Record<TemplateStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  published: { label: "Published", className: "bg-emerald-50 text-emerald-800" },
  archived: { label: "Archived", className: "bg-slate-100 text-slate-500" },
};

type Props = {
  className?: string;
} & (
  | { kind: "assignment"; status: AssignmentStatus | "overdue" }
  | { kind: "scan"; status: ScanStatus }
  | { kind: "template"; status: TemplateStatus; published?: boolean }
);

/** Unified visual status pill — assignments, scans, templates. */
export function StatusBadge(props: Props) {
  const { className } = props;

  if (props.kind === "assignment") {
    const meta = assignmentMeta[props.status] ?? assignmentMeta.pending;
    return (
      <Badge variant="secondary" className={cn("rounded-full border-0 font-medium", meta.className, className)}>
        {meta.label}
      </Badge>
    );
  }

  if (props.kind === "scan") {
    const meta = scanMeta[props.status];
    return (
      <Badge variant="secondary" className={cn("rounded-full border-0 font-medium", meta.className, className)}>
        {meta.label}
      </Badge>
    );
  }

  const status =
    props.status === "archived"
      ? "archived"
      : props.status === "published" || props.published
        ? "published"
        : "draft";
  const meta = templateMeta[status];
  return (
    <Badge variant="secondary" className={cn("rounded-full border-0 font-medium", meta.className, className)}>
      {meta.label}
    </Badge>
  );
}
