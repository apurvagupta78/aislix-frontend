import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { slaRemainingLabel } from "@/lib/corrective-action-lifecycle";

export type SlaHealth = "on_track" | "due_soon" | "overdue" | "breached" | "complete" | "none";

export function slaHealth(dueAt: string | null, status: string): SlaHealth {
  if (!dueAt) return "none";
  if (["resolved", "closed"].includes(status)) return "complete";
  const ms = new Date(dueAt).getTime() - Date.now();
  if (ms < 0) return status === "overdue" ? "breached" : "overdue";
  if (ms < 4 * 36e5) return "due_soon";
  return "on_track";
}

const HEALTH_STYLES: Record<SlaHealth, { label: string; className: string }> = {
  on_track: { label: "On track", className: "text-accent-green bg-accent-green/10" },
  due_soon: { label: "Due soon", className: "text-warning bg-warning/10" },
  overdue: { label: "Overdue", className: "text-destructive bg-destructive/10" },
  breached: { label: "SLA breached", className: "text-destructive bg-destructive/15 font-semibold" },
  complete: { label: "Complete", className: "text-muted-foreground bg-muted" },
  none: { label: "No SLA", className: "text-muted-foreground bg-muted" },
};

export function SLAIndicator({
  dueAt,
  status,
  showRemaining = true,
  className,
}: {
  dueAt: string | null;
  status: string;
  showRemaining?: boolean;
  className?: string;
}) {
  const health = slaHealth(dueAt, status);
  const style = HEALTH_STYLES[health];
  const remaining = showRemaining ? slaRemainingLabel(dueAt, status) : null;

  return (
    <div className={cn("inline-flex flex-col gap-0.5", className)}>
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs",
          style.className,
        )}
      >
        {health === "breached" || health === "overdue" ? (
          <AlertTriangle className="size-3" aria-hidden />
        ) : (
          <Clock className="size-3" aria-hidden />
        )}
        {style.label}
      </span>
      {remaining && health !== "complete" && health !== "none" ? (
        <span className="text-xs text-muted-foreground tabular-nums">{remaining}</span>
      ) : null}
    </div>
  );
}
