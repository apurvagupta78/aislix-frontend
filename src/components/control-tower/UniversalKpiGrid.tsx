import { cn } from "@/lib/utils";
import { AISLIX } from "@/lib/aislix-theme";
import type { ControlTowerDemoPayload, ControlTowerKpi } from "@/lib/control-tower";
import { KpiInfoPopover } from "./KpiInfoPopover";
import { DemoDataBadge } from "./DemoDataBadge";

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

/** One distinct Magic Patterns surface per KPI card. */
const KPI_SURFACE: Record<
  (typeof DASHBOARD_KPI_IDS)[number],
  { bg: string; border: string; inverted?: boolean }
> = {
  audit_completion: { bg: AISLIX.accentBg, border: AISLIX.accentBorder },
  evidence_coverage: { bg: AISLIX.localBg, border: AISLIX.localBorder },
  audit_pass: { bg: AISLIX.supermarketBg, border: AISLIX.supermarketBorder },
  open_findings: { bg: AISLIX.warehouseBg, border: AISLIX.warehouseBorder },
  critical_findings: { bg: AISLIX.darkstoreBg, border: AISLIX.darkstoreBorder },
  overdue_actions: { bg: AISLIX.customBg, border: AISLIX.customBorder },
  sla_compliance: { bg: AISLIX.surface, border: AISLIX.border },
  value_variance: { bg: AISLIX.fmcgBg, border: AISLIX.fmcgBorder },
};

function findKpi(kpis: ControlTowerKpi[], id: string): ControlTowerKpi | undefined {
  return kpis.find((k) => k.id === id);
}

function valueClass(kpi: ControlTowerKpi, inverted?: boolean) {
  if (!kpi.available) return inverted ? "text-white/80" : "text-mp-muted";
  if (inverted) return "text-white";
  if (kpi.tone === "bad") return "text-[var(--aislix-primary)]";
  if (kpi.tone === "warn") return "text-[var(--aislix-primary)]";
  return "text-[var(--aislix-primary)]";
}

export function UniversalKpiGrid({
  data,
  demoBadgePreviewMode,
  onDrill,
}: {
  data: ControlTowerDemoPayload;
  demoBadgePreviewMode?: boolean;
  onDrill?: (kpi: ControlTowerKpi) => void;
}) {
  const previewMode = demoBadgePreviewMode ?? data.previewDemo;
  return (
    <div className="space-y-3">
      {data.labeledDemo ? <DemoDataBadge previewMode={previewMode} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {DASHBOARD_KPI_IDS.map((id) => {
        const kpi = findKpi(data.universalKpis, id);
        if (!kpi) return null;
        const surface = KPI_SURFACE[id];
        const unavailable = !kpi.available;

        return (
          <button
            key={id}
            type="button"
            disabled={unavailable}
            onClick={() => kpi.available && onDrill?.(kpi)}
            className={cn(
              "kpi-tile rounded-xl p-4 text-left transition hover:-translate-y-px",
              unavailable && "cursor-default opacity-90",
            )}
            style={{
              backgroundColor: surface.bg,
              borderColor: surface.border,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <p
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide",
                  surface.inverted ? "text-white/75" : "text-mp-muted",
                )}
              >
                {kpi.label}
              </p>
              <span className={surface.inverted ? "text-white/80" : "text-mp-muted"}>
                <KpiInfoPopover kpi={kpi} />
              </span>
            </div>
            <p className={cn("mt-3 font-display text-2xl font-semibold", valueClass(kpi, surface.inverted))}>
              {unavailable ? "Data unavailable" : kpi.value}
            </p>
            <p className={cn("mt-2 text-xs", surface.inverted ? "text-white/70" : "text-mp-muted")}>
              {kpi.detail}
            </p>
          </button>
        );
      })}
      </div>
    </div>
  );
}
