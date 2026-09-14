import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  className,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-border bg-card p-4 text-left",
        onClick && "transition-colors hover:border-brand/30 hover:bg-brand-soft/30",
        className,
      )}
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Tag>
  );
}
