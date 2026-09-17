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

const TONE_ACCENT: Record<KpiTone, string> = {
  brand: "border-l-[var(--aislix-primary)]",
  good: "border-l-[var(--aislix-supermarket-border)]",
  warn: "border-l-[var(--aislix-darkstore-border)]",
  bad: "border-l-[var(--aislix-darkstore-border)]",
  neutral: "border-l-[var(--aislix-warehouse-border)]",
};

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

  return (
    <button
      type="button"
      disabled={!kpi.available}
      onClick={() => kpi.available && onDrill?.(kpi)}
      className={cn(
        "kpi-tile group flex min-h-[178px] flex-col border-l-4 bg-white p-5 text-left",
        TONE_ACCENT[kpi.tone],
        !kpi.available && "cursor-not-allowed opacity-60",
      )}
    >
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-1">
          <p className="text-[0.7rem] font-bold uppercase tracking-wide text-[var(--aislix-secondary)]">
            {kpi.label}
          </p>
          <span className="text-[var(--aislix-secondary)]">
            <KpiInfoPopover kpi={kpi} scopeLabel={scopeLabel} periodLabel={periodLabel} />
          </span>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--aislix-border)] bg-[var(--aislix-surface)]">
          <Icon className="size-5 text-[var(--aislix-primary)]" />
        </span>
      </div>

      <p className="relative mt-4 text-4xl font-extrabold tracking-tight text-[var(--aislix-primary)]">{kpi.value}</p>
      <p className="relative mt-1 line-clamp-2 text-xs font-medium text-[var(--aislix-secondary)]">{kpi.detail}</p>

      {kpi.trendLabel ? (
        <p className="relative mt-3 inline-flex w-fit items-center gap-1 rounded-lg bg-[var(--aislix-surface)] px-2 py-0.5 text-[0.7rem] font-bold text-[var(--aislix-primary)]">
          {kpi.trend ? trendUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" /> : null}
          {kpi.trendLabel}
        </p>
      ) : null}

      {kpi.progressPct != null ? (
        <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--aislix-surface)]">
          <div
            className="h-full rounded-full bg-[var(--aislix-primary)]"
            style={{ width: `${Math.max(0, Math.min(100, kpi.progressPct))}%` }}
          />
        </div>
      ) : null}

      {sparkData.length > 1 ? (
        <div className="relative mt-auto h-10 w-full pt-3 text-[var(--aislix-primary)]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <Area
                type="monotone"
                dataKey="v"
                stroke="currentColor"
                fill="currentColor"
                fillOpacity={0.18}
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      <div className="relative mt-3 flex items-center justify-between gap-2">
        {kpi.available ? (
          <span className="inline-flex items-center text-[0.7rem] font-bold text-[var(--aislix-secondary)] group-hover:text-[var(--aislix-primary)]">
            Drill down <ArrowRight className="ml-1 size-3" />
          </span>
        ) : (
          <span />
        )}
        {isSample ? (
          <span className="rounded-full bg-[var(--aislix-custom-bg)] px-2 py-0.5 text-[9px] font-bold uppercase text-[var(--aislix-secondary)]">
            Sample
          </span>
        ) : null}
      </div>
    </button>
  );
}
