import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Reusable circular progress ring built on conic-gradient (no extra deps). */
export function ProgressRing({
  value,
  size = 92,
  thickness = 9,
  label,
  sublabel,
  tone = "brand",
}: {
  value: number | null;
  size?: number;
  thickness?: number;
  label?: string | undefined;
  sublabel?: string | undefined;
  tone?: "brand" | "green" | "warning" | undefined;
}) {
  const pct = value === null ? 100 : Math.max(0, Math.min(100, value));
  const color =
    tone === "green"
      ? "var(--market-line)"
      : tone === "warning"
        ? "var(--dark-line)"
        : "var(--local-line)";
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full transition-transform duration-300 group-hover:scale-[1.03]"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} ${pct}%, var(--line) 0)`,
      }}
      role="img"
      aria-label={label ? `${label} ${value === null ? "unlimited" : `${pct}%`}` : undefined}
    >
      <div
        className="grid place-items-center rounded-full bg-white text-center"
        style={{ width: size - thickness * 2, height: size - thickness * 2 }}
      >
        <div>
          <p className="font-display text-sm font-semibold tracking-tight text-navy">{label ?? `${pct}%`}</p>
          {sublabel && <p className="text-[0.65rem] text-mp-muted">{sublabel}</p>}
        </div>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
  className = "",
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  icon?: ReactNode | undefined;
  accent?: "brand" | "green" | undefined;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-card group", className)}>
      <div className="flex items-center justify-between gap-3">
        {icon && (
          <span
            className={cn(
              "grid size-9 place-items-center rounded-xl",
              accent === "green" ? "bg-market-bg text-navy" : "bg-local-bg text-navy",
            )}
          >
            {icon}
          </span>
        )}
        {hint && <span className="text-[11px] text-mp-muted">{hint}</span>}
      </div>
      <p className="mt-4 font-display text-2xl font-semibold tracking-tight text-navy">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.06em] text-mp-muted">{label}</p>
    </div>
  );
}

export function RingCard({
  label,
  ringValue,
  ringLabel,
  ringSublabel,
  tone = "brand",
  footer,
}: {
  label: string;
  ringValue: number | null;
  ringLabel: string;
  ringSublabel?: string | undefined;
  tone?: "brand" | "green" | "warning" | undefined;
  footer?: string | undefined;
}) {
  return (
    <div className="group flex items-center gap-4 overflow-hidden rounded-xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-card">
      <ProgressRing value={ringValue} label={ringLabel} sublabel={ringSublabel} tone={tone} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-navy">{label}</p>
        {footer && <p className="mt-1 text-xs text-mp-muted">{footer}</p>}
      </div>
    </div>
  );
}
