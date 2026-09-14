import type { ActivityEvent } from "@/lib/audit-activity";
import { cn } from "@/lib/utils";

export function ActivityTimeline({
  events,
  className,
  emptyMessage = "Activity will appear as this record moves through the audit lifecycle.",
}: {
  events: ActivityEvent[];
  className?: string;
  emptyMessage?: string;
}) {
  if (!events.length) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{emptyMessage}</p>;
  }

  return (
    <ol className={cn("relative space-y-0", className)}>
      {events.map((ev, index) => (
        <li key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
          {index < events.length - 1 ? (
            <span
              className="absolute left-[7px] top-4 h-[calc(100%-4px)] w-px bg-border"
              aria-hidden
            />
          ) : null}
          <span
            className="relative z-10 mt-1 size-[15px] shrink-0 rounded-full border-2 border-brand bg-card"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{ev.summary}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(ev.created_at).toLocaleString()} · {ev.actor_name}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
