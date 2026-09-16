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
  const trendUp = kpi.trend && kpi.trend.length >= 2 && kpi.trend.at(-1)! > kpi.trend[0]!;
  const Icon = iconFor(kpi.label);
  const isSample = kpi.source?.includes("demo") || kpi.source?.includes("Illustrative");

  return (
    <button
      type="button"
      disabled={!kpi.available}
      onClick={() => kpi.available && onDrill?.(kpi)}
      className={cn(
        "kpi-tile group flex min-h-[178px] flex-col p-6 text-left",
        TONE_TILE[kpi.tone],
        !kpi.available && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-white/10 blur-2xl transition-colors group-hover:bg-white/20"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-1">
          <p className="text-[0.7rem] font-bold uppercase tracking-wide text-white/80">
            {kpi.label}
          </p>
          <span className="text-white/70">
            <KpiInfoPopover kpi={kpi} scopeLabel={scopeLabel} periodLabel={periodLabel} />
          </span>
        </div>
        <span className="glass-badge flex size-10 shrink-0 items-center justify-center">
          <Icon className="size-5 text-white" />
        </span>
      </div>

      <p className="relative mt-4 text-4xl font-extrabold tracking-tight text-white">{kpi.value}</p>

      <p className="relative mt-1 line-clamp-2 text-xs font-medium text-white/75">{kpi.detail}</p>

      {kpi.trendLabel ? (
        <p className="relative mt-3 inline-flex w-fit items-center gap-1 rounded-lg bg-white/20 px-2 py-0.5 text-[0.7rem] font-bold text-white">
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
        <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white"
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
                stroke="#ffffff"
                fill="#ffffff"
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
          <span className="inline-flex items-center text-[0.7rem] font-bold text-white/85 group-hover:text-white">
            Drill down <ArrowRight className="ml-1 size-3" />
          </span>
        ) : (
          <span />
        )}
        {isSample ? (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold uppercase text-white">
            Sample
          </span>
        ) : null}
      </div>
    </button>
  );
}
