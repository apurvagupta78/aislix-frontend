import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type SLATone = "overdue" | "due_today" | "on_track" | "completed";

const meta: Record<
  SLATone,
  { label: string; className: string; Icon: typeof AlertTriangle }
> = {
  overdue: { label: "Overdue", className: "text-red-700 bg-red-50", Icon: AlertTriangle },
  due_today: { label: "Due today", className: "text-amber-900 bg-amber-50", Icon: CalendarClock },
  on_track: { label: "On track", className: "text-emerald-800 bg-emerald-50", Icon: CheckCircle2 },
  completed: { label: "Done", className: "text-slate-600 bg-slate-100", Icon: CheckCircle2 },
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
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        item.className,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
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
