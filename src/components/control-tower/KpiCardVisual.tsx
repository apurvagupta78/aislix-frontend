import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  IndianRupee,
  PackageSearch,
  TrendingDown,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";
import type { ControlTowerKpi, KpiTone } from "@/lib/control-tower";
import { KpiInfoPopover } from "./KpiInfoPopover";

const TONE_TILE: Record<KpiTone, string> = {
  brand: "kpi-tile-brand",
  good: "kpi-tile-good",
  warn: "kpi-tile-warn",
  bad: "kpi-tile-bad",
  neutral: "kpi-tile-neutral",
};

/** Icon chosen from the metric name so every tile reads at a glance. */
function iconFor(label: string) {
  const l = label.toLowerCase();
  if (l.includes("evidence") || l.includes("photo") || l.includes("image")) return ImageIcon;
  if (l.includes("sla") || l.includes("overdue") || l.includes("ageing") || l.includes("time"))
    return Clock;
  if (l.includes("critical") || l.includes("risk") || l.includes("expiry")) return AlertTriangle;
  if (l.includes("action") || l.includes("fix")) return Wrench;
  if (l.includes("finding") || l.includes("issue")) return AlertTriangle;
  if (l.includes("value") || l.includes("variance") || l.includes("revenue")) return IndianRupee;
  if (l.includes("inventory") || l.includes("stock") || l.includes("oos")) return PackageSearch;
  if (l.includes("pass") || l.includes("compliance")) return BadgeCheck;
  if (l.includes("completion") || l.includes("complete")) return CheckCircle2;
  return BarChart3;
}

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
  const sparkData = kpi.trend?.map((v, i) => ({ i, v })) ?? [];
  const firstTrend = kpi.trend?.[0];
  const lastTrend = kpi.trend?.at(-1);
  const trendUp = firstTrend !== undefined && lastTrend !== undefined && lastTrend > firstTrend;
  const Icon = iconFor(kpi.label);
  const isSample = kpi.source?.includes("demo") || kpi.source?.includes("Illustrative");
  const isDarkTile = kpi.tone === "brand";

  return (
    <button
      type="button"
      disabled={!kpi.available}
      onClick={() => kpi.available && onDrill?.(kpi)}
      className={cn(
          "kpi-tile group flex min-h-[178px] flex-col p-5 text-left",
        TONE_TILE[kpi.tone],
        !kpi.available && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-0 top-0 h-1 w-20 transition-colors",
          isDarkTile ? "bg-brand-glow" : "bg-brand/15 group-hover:bg-brand/25",
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-1">
          <p className={cn("text-[0.7rem] font-bold uppercase tracking-wide", isDarkTile ? "text-white/80" : "text-foreground/70")}>
            {kpi.label}
          </p>
          <span className={isDarkTile ? "text-white/70" : "text-foreground/60"}>
            <KpiInfoPopover kpi={kpi} scopeLabel={scopeLabel} periodLabel={periodLabel} />
          </span>
        </div>
        <span className={cn("glass-badge flex size-10 shrink-0 items-center justify-center", !isDarkTile && "bg-white/70")}>
          <Icon className={cn("size-5", isDarkTile ? "text-white" : "text-foreground")} />
        </span>
      </div>

      <p className={cn("relative mt-4 text-4xl font-extrabold tracking-tight", isDarkTile ? "text-white" : "text-foreground")}>{kpi.value}</p>

      <p className={cn("relative mt-1 line-clamp-2 text-xs font-medium", isDarkTile ? "text-white/75" : "text-foreground/65")}>{kpi.detail}</p>

      {kpi.trendLabel ? (
        <p className={cn("relative mt-3 inline-flex w-fit items-center gap-1 rounded-lg px-2 py-0.5 text-[0.7rem] font-bold", isDarkTile ? "bg-white/20 text-white" : "bg-white/70 text-foreground")}>
          {kpi.trend ? (
            trendUp ? (
              <TrendingUp className="size-3" />
            ) : (
              <TrendingDown className="size-3" />
            )
          ) : null}
          {kpi.trendLabel}
        </p>
      ) : null}

      {kpi.progressPct != null ? (
        <div className={cn("relative mt-3 h-2 w-full overflow-hidden rounded-full", isDarkTile ? "bg-white/25" : "bg-foreground/10")}>
          <div
            className={cn("h-full rounded-full", isDarkTile ? "bg-white" : "bg-foreground")}
            style={{ width: `${Math.max(0, Math.min(100, kpi.progressPct))}%` }}
          />
        </div>
      ) : null}

      {sparkData.length > 1 ? (
        <div className="relative mt-auto h-10 w-full pt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <Area
                type="monotone"
                dataKey="v"
                stroke="currentColor"
                fill="currentColor"
                fillOpacity={0.25}
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      <div className="relative mt-3 flex items-center justify-between gap-2">
        {kpi.available ? (
          <span className={cn("inline-flex items-center text-[0.7rem] font-bold", isDarkTile ? "text-white/85 group-hover:text-white" : "text-foreground/70 group-hover:text-foreground")}>
            Drill down <ArrowRight className="ml-1 size-3" />
          </span>
        ) : (
          <span />
        )}
        {isSample ? (
          <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase", isDarkTile ? "bg-white/20 text-white" : "bg-white/70 text-foreground")}>
            Sample
          </span>
        ) : null}
      </div>
    </button>
  );
}
