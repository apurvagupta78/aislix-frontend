import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type KpiTone = "neutral" | "good" | "warn" | "danger" | "info";

const TONE: Record<KpiTone, { surface: string; icon: string; value: string }> = {
  neutral: {
    surface: "border-border bg-card",
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
  },
  good: {
    surface: "border-status-good/25 bg-status-good-soft",
    icon: "bg-status-good/15 text-status-good-strong",
    value: "text-status-good-strong",
  },
  warn: {
    surface: "border-status-warn/25 bg-status-warn-soft",
    icon: "bg-status-warn/15 text-status-warn-strong",
    value: "text-status-warn-strong",
  },
  danger: {
    surface: "border-status-danger/25 bg-status-danger-soft",
    icon: "bg-status-danger/15 text-status-danger-strong",
    value: "text-status-danger-strong",
  },
  info: {
    surface: "border-status-info/25 bg-status-info-soft",
    icon: "bg-status-info/15 text-status-info-strong",
    value: "text-status-info-strong",
  },
};

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  className,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Icon reinforces the label so it reads at a glance. */
  icon?: LucideIcon;
  /** Colour meaning: good / needs attention / urgent. */
  tone?: KpiTone;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  const t = TONE[tone];
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-left shadow-soft",
        t.surface,
        onClick && "transition-colors hover:border-brand-glow hover:shadow-card",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        {Icon ? (
          <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl", t.icon)}>
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          <p className={cn("mt-1 text-2xl font-semibold tabular-nums", t.value)}>{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
    </Tag>
  );
}
