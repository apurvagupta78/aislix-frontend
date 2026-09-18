import { cn } from "@/lib/utils";
import type { ControlTowerDemoPayload, ControlTowerKpi } from "@/lib/control-tower";
import { KpiInfoPopover } from "./KpiInfoPopover";

const DASHBOARD_KPI_IDS = [
  "audit_completion",
  "evidence_coverage",
  "audit_pass",
  "open_findings",
  "critical_findings",
  "overdue_actions",
  "sla_compliance",
  "value_variance",
] as const;

function findKpi(kpis: ControlTowerKpi[], id: string): ControlTowerKpi | undefined {
  return kpis.find((k) => k.id === id);
}

function toneClass(tone?: ControlTowerKpi["tone"]) {
  if (tone === "bad") return "text-destructive";
  if (tone === "warn") return "text-amber-700";
  if (tone === "good") return "text-emerald-700";
  return "text-navy";
}

export function UniversalKpiGrid({
  data,
  onDrill,
}: {
  data: ControlTowerDemoPayload;
  onDrill?: (kpi: ControlTowerKpi) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {DASHBOARD_KPI_IDS.map((id) => {
        const kpi = findKpi(data.universalKpis, id);
        if (!kpi) return null;
        const unavailable = !kpi.available;
        return (
          <button
            key={id}
            type="button"
            disabled={unavailable}
            onClick={() => kpi.available && onDrill?.(kpi)}
            className={cn(
              "rounded-xl border border-line bg-white p-4 text-left shadow-card transition hover:border-primary/30",
              unavailable && "cursor-default opacity-90",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-mp-muted">{kpi.label}</p>
              <KpiInfoPopover kpi={kpi} />
            </div>
            <p className={cn("mt-3 font-display text-2xl font-semibold", toneClass(kpi.tone))}>
              {unavailable ? "Data unavailable" : kpi.value}
            </p>
            <p className="mt-2 text-xs text-mp-muted">{kpi.detail}</p>
          </button>
        );
      })}
    </div>
  );
}
