import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";
import type { ControlTowerKpi, KpiTone } from "@/lib/control-tower";
import { Progress } from "@/components/ui/progress";
import { KpiInfoPopover } from "./KpiInfoPopover";

const TONE_STYLES: Record<
  KpiTone,
  { border: string; bg: string; value: string; spark: string; badge?: string }
> = {
  brand: {
    border: "border-brand/20",
    bg: "bg-brand-soft/40",
    value: "text-brand",
    spark: "var(--brand)",
  },
  good: {
    border: "border-status-good/25",
    bg: "bg-status-good-soft",
    value: "text-status-good-strong",
    spark: "var(--status-good)",
  },
  warn: {
    border: "border-status-warn/30",
    bg: "bg-status-warn-soft",
    value: "text-status-warn-strong",
    spark: "var(--status-warn)",
  },
  bad: {
    border: "border-status-danger/25",
    bg: "bg-status-danger-soft",
    value: "text-status-danger-strong",
    spark: "var(--status-danger)",
  },
  neutral: {
    border: "border-border",
    bg: "bg-card",
    value: "text-foreground",
    spark: "var(--muted-foreground)",
  },
};

export function KpiCardVisual({
  kpi,
  onDrill,
  scopeLabel,
  periodLabel,
}: {
  kpi: ControlTowerKpi;
  onDrill?: (kpi: ControlTowerKpi) => void;
  scopeLabel?: string;
  periodLabel?: string;
}) {
  const tone = TONE_STYLES[kpi.tone];
  const sparkData = kpi.trend?.map((v, i) => ({ i, v })) ?? [];
  const trendUp = kpi.trend && kpi.trend.length >= 2 && kpi.trend.at(-1)! > kpi.trend[0]!;

  return (
    <button
      type="button"
      disabled={!kpi.available}
      onClick={() => kpi.available && onDrill?.(kpi)}
      className={cn(
        "group relative flex min-h-[148px] flex-col overflow-hidden rounded-2xl border p-4 text-left transition-all",
        tone.border,
        tone.bg,
        kpi.available
          ? "hover:-translate-y-0.5 hover:shadow-md hover:shadow-brand/5"
          : "cursor-not-allowed opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {kpi.label}
          </p>
          <KpiInfoPopover kpi={kpi} scopeLabel={scopeLabel} periodLabel={periodLabel} />
        </div>
        {kpi.source?.includes("demo") || kpi.source?.includes("Illustrative") ? (
          <span className="rounded-full bg-status-warn-soft px-1.5 py-0.5 text-[9px] font-semibold text-status-warn-strong">
            Sample
          </span>
        ) : null}
      </div>

      <p className={cn("mt-1 text-3xl font-semibold tracking-tight", tone.value)}>{kpi.value}</p>

      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{kpi.detail}</p>

      {kpi.trendLabel ? (
        <p className="mt-1 flex items-center gap-1 text-[0.65rem] text-muted-foreground">
          {kpi.trend ? (
            trendUp ? (
              <TrendingUp className="size-3 text-success" />
            ) : (
              <TrendingDown className="size-3 text-warning" />
            )
          ) : null}
          {kpi.trendLabel}
        </p>
      ) : null}

      {kpi.progressPct != null ? (
        <Progress value={kpi.progressPct} className="mt-2 h-1.5" />
      ) : null}

      {sparkData.length > 1 ? (
        <div className="mt-auto h-8 w-full pt-2 opacity-70">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <Area
                type="monotone"
                dataKey="v"
                stroke={tone.spark}
                fill={tone.spark}
                fillOpacity={0.15}
                strokeWidth={1.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {kpi.available ? (
        <span className="mt-2 inline-flex items-center text-[0.65rem] font-medium text-brand opacity-80 group-hover:opacity-100">
          Drill down <ArrowRight className="ml-0.5 size-3" />
        </span>
      ) : null}
    </button>
  );
}
