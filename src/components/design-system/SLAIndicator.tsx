import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type SLATone = "overdue" | "due_today" | "on_track" | "completed";

const meta: Record<SLATone, { label: string; className: string; Icon: typeof AlertTriangle }> = {
  overdue: {
    label: "Overdue",
    className: "bg-status-danger-soft text-status-danger-strong",
    Icon: AlertTriangle,
  },
  due_today: {
    label: "Due today",
    className: "bg-status-warn-soft text-status-warn-strong",
    Icon: CalendarClock,
  },
  on_track: {
    label: "On time",
    className: "bg-status-good-soft text-status-good-strong",
    Icon: CheckCircle2,
  },
  completed: { label: "Done", className: "bg-muted text-muted-foreground", Icon: CheckCircle2 },
};

type Props = {
  tone: SLATone;
  className?: string;
  compact?: boolean;
};

export function SLAIndicator({ tone, className, compact }: Props) {
  const item = meta[tone];
  const Icon = item.Icon;
  return (
    <span
      role="status"
      aria-label={item.label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        item.className,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {!compact ? item.label : null}
    </span>
  );
}

export function slaToneFromDueDate(
  dueAt: string | null,
  status: string,
): SLATone | null {
  if (status === "completed" || status === "cancelled") return "completed";
  if (!dueAt) return "on_track";
  const due = new Date(dueAt);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const dueDay = due.toISOString().slice(0, 10);
  if (due < now && status !== "completed") return "overdue";
  if (dueDay === today) return "due_today";
  return "on_track";
}
