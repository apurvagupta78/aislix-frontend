import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/States";
import type { EnrichedKpiMetric } from "@/lib/kpi-results-display";
import { AUDIT_STATUS_DISPLAY } from "@/lib/role-audit-ui";
import { cn } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  complete: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
  partial: "bg-amber-500/12 text-amber-900 dark:text-amber-200",
  not_assessable: "bg-muted text-muted-foreground",
  not_applicable: "bg-muted text-muted-foreground",
  not_configured: "bg-muted text-muted-foreground",
};

const PROGRESS_BAR: Record<string, string> = {
  complete: "bg-brand",
  partial: "bg-amber-500",
  not_assessable: "bg-muted-foreground/40",
  not_applicable: "bg-muted-foreground/30",
  not_configured: "bg-muted-foreground/30",
};

function ShareOfShelfVisual({
  brandLabel,
  brandPercent,
  plannedPercent,
}: {
  brandLabel: string;
  brandPercent: number;
  plannedPercent?: number | null;
}) {
  const brand = Math.max(0, Math.min(100, brandPercent));
  const other = Math.max(0, 100 - brand);
  return (
    <div className="mt-2 space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-brand transition-all" style={{ width: `${brand}%` }} />
        <div className="bg-brand/20 transition-all" style={{ width: `${other}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{brandLabel}</span> {Math.round(brand)}%
        </span>
        <span>Other brands {Math.round(other)}%</span>
      </div>
      {plannedPercent != null ? (
        <div className="space-y-1">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-muted/80">
            <div
              className="rounded-full bg-brand/50"
              style={{ width: `${clampPercent(plannedPercent)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Planned shelf share {Math.round(plannedPercent)}%
          </p>
        </div>
      ) : null}
    </div>
  );
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function KpiResultCard({
  kpi,
  loading,
  brandLabel,
  onClick,
}: {
  kpi: EnrichedKpiMetric;
  loading?: boolean;
  brandLabel?: string;
  onClick?: () => void;
}) {
  const status = kpi.audit_status;
  const statusLabel = status ? AUDIT_STATUS_DISPLAY[status] ?? status : null;
  const showProgress =
    kpi.progress_percent != null &&
    status !== "not_configured" &&
    status !== "not_applicable" &&
    status !== "not_assessable";
  const isSos = kpi.key === "share_of_shelf" && kpi.numeric != null;

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-foreground/80">
          {kpi.display_label}
        </p>
        {statusLabel ? (
          <Badge
            variant="secondary"
            className={cn("shrink-0 text-[0.6rem] font-medium", status ? STATUS_BADGE[status] : "")}
          >
            {statusLabel}
          </Badge>
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="mt-3 h-7 w-20" />
      ) : (
        <>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {kpi.display_value}
          </p>
          {kpi.plain_english ? (
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{kpi.plain_english}</p>
          ) : null}

          {isSos ? (
            <>
              <ShareOfShelfVisual
                brandLabel={brandLabel ?? "Your brand"}
                brandPercent={kpi.numeric ?? 0}
                plannedPercent={kpi.target_percent}
              />
              <p className="mt-2 text-[10px] text-muted-foreground">{kpi.target_line}</p>
            </>
          ) : showProgress ? (
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  status ? PROGRESS_BAR[status] : "bg-brand",
                )}
                style={{ width: `${kpi.progress_percent}%` }}
              />
            </div>
          ) : null}

          {kpi.key === "facing_count" && kpi.facing_observed != null && kpi.facing_planned != null ? (
            <div className="mt-2 space-y-0.5 text-[10px] text-muted-foreground">
              <p>Observed: {kpi.facing_observed}</p>
              <p>Planned: {kpi.facing_planned}</p>
              {kpi.facing_of_planned_label ? (
                <p className="font-medium text-foreground/80">{kpi.facing_of_planned_label}</p>
              ) : null}
            </div>
          ) : kpi.unit === "percent" ? (
            <p className="mt-2 text-[10px] text-muted-foreground">{kpi.target_line}</p>
          ) : null}

          {kpi.coverage_display ? (
            <p className="mt-1.5 text-[10px] text-muted-foreground">{kpi.coverage_display}</p>
          ) : null}
        </>
      )}
    </>
  );

  const className = cn(
    "rounded-lg border border-border/80 border-l-[3px] bg-card px-3.5 py-3 shadow-sm transition-shadow",
    kpi.accent_border,
    onClick && "cursor-pointer hover:border-brand/30 hover:shadow-md",
  );

  if (onClick) {
    return (
      <button type="button" className={cn(className, "text-left w-full")} onClick={onClick} title={kpi.detail}>
        {body}
      </button>
    );
  }

  return (
    <div className={className} title={kpi.detail}>
      {body}
    </div>
  );
}
