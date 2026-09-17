import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type KpiTone = "neutral" | "good" | "warn" | "danger" | "info";

const TONE: Record<KpiTone, { surface: string; icon: string; value: string }> = {
  neutral: {
    surface: "border-neutral-line bg-neutral-bg",
    icon: "bg-white text-mp-muted",
    value: "text-navy",
  },
  good: {
    surface: "border-market-line bg-market-bg",
    icon: "bg-white text-navy",
    value: "text-navy",
  },
  warn: {
    surface: "border-warehouse-line bg-warehouse-bg",
    icon: "bg-white text-navy",
    value: "text-navy",
  },
  danger: {
    surface: "border-dark-line bg-dark-bg",
    icon: "bg-white text-navy",
    value: "text-navy",
  },
  info: {
    surface: "border-local-line bg-local-bg",
    icon: "bg-white text-navy",
    value: "text-navy",
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
        "rounded-lg border p-4 text-left shadow-card",
        t.surface,
        onClick && "transition-colors hover:shadow-card",
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
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-mp-muted">{label}</p>
          <p className={cn("mt-1 font-display text-[15px] font-semibold tabular-nums leading-none", t.value)}>
            {value}
          </p>
          {hint ? <p className="mt-1 text-[10px] text-mp-muted">{hint}</p> : null}
        </div>
      </div>
    </Tag>
  );
}
