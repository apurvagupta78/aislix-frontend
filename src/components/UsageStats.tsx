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
    tone === "green" ? "var(--accent-green)" : tone === "warning" ? "var(--warning)" : "var(--brand-glow)";
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full transition-transform duration-300 group-hover:scale-[1.03]"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} ${pct}%, var(--border) 0)`,
      }}
      role="img"
      aria-label={label ? `${label} ${value === null ? "unlimited" : `${pct}%`}` : undefined}
    >
      <div
        className="grid place-items-center rounded-full bg-card text-center"
        style={{ width: size - thickness * 2, height: size - thickness * 2 }}
      >
        <div>
          <p className="text-sm font-semibold tracking-tight">{label ?? `${pct}%`}</p>
          {sublabel && <p className="text-[0.65rem] text-muted-foreground">{sublabel}</p>}
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
    <div className={cn("card-surface card-hover group p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        {icon && (
          <span
            className={cn(
              "grid size-9 place-items-center rounded-xl",
              accent === "green" ? "bg-accent-green/12 text-accent-green" : "bg-brand-soft text-brand",
            )}
          >
            {icon}
          </span>
        )}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
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
    <div className="card-surface card-hover group flex items-center gap-4 p-5">
      <ProgressRing value={ringValue} label={ringLabel} sublabel={ringSublabel} tone={tone} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {footer && <p className="mt-1 text-xs text-muted-foreground">{footer}</p>}
      </div>
    </div>
  );
}
