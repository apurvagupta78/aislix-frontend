import { useMemo, useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/States";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import { AUDIT_STATUS_DISPLAY, kpiPlainEnglish } from "@/lib/role-audit-ui";
import type { KpiMetric } from "@/lib/execution-metrics";
import type { AuditKpiResult } from "@/lib/retail-intelligence";
import {
  enrichKpiMetric,
  KPI_DISPLAY_LABEL,
  scoringFromResult,
} from "@/lib/kpi-results-display";
import type { KpiDetailsContext } from "@/lib/kpi-details-data";
import type { ScanResult } from "@/lib/scan-results";
import {
  KPI_DRILL_DOWN_LABEL,
  kpiHasDrillDown,
} from "@/lib/kpi-detail-groups";
import { KpiCalculationPanel } from "@/components/scan-results/kpi-details/KpiCalculationPanel";
import { KpiDetailSummary } from "@/components/scan-results/kpi-details/KpiDetailSummary";
import {
  KpiDetailExpandedVisual,
  NotApplicableVisual,
  NotConfiguredVisual,
} from "@/components/scan-results/kpi-details/KpiDetailVisuals";
import { cn } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  complete: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
  partial: "bg-amber-500/12 text-amber-900 dark:text-amber-200",
  not_assessable: "bg-muted text-muted-foreground",
  not_applicable: "bg-muted text-muted-foreground",
  not_configured: "bg-muted text-muted-foreground",
};

const ACCENT: Partial<Record<AuditKpiId, string>> = {
  osa: "border-l-brand",
  location_accuracy: "border-l-brand/80",
  planogram_compliance: "border-l-brand/70",
  assortment_compliance: "border-l-brand/60",
  facing_count: "border-l-brand/50",
  share_of_shelf: "border-l-brand",
  price_compliance: "border-l-brand/70",
  promotional_compliance: "border-l-brand/60",
  msl_compliance: "border-l-brand/70",
};

function formatCoverage(metric?: KpiMetric): string | null {
  if (metric?.coverage_percent == null || !Number.isFinite(metric.coverage_percent)) return null;
  return `Coverage ${Math.round(metric.coverage_percent)}%`;
}

export function KpiDetailCard({
  kpiId,
  metric,
  raw,
  result,
  loading,
  onDownload,
  ctx,
}: {
  kpiId: AuditKpiId;
  metric?: KpiMetric;
  raw?: AuditKpiResult;
  result: ScanResult;
  loading?: boolean;
  onDownload: () => void;
  ctx?: KpiDetailsContext | null;
}) {
  const [visualExpanded, setVisualExpanded] = useState(false);

  const enriched = useMemo(() => {
    if (!metric) return null;
    return enrichKpiMetric(metric, scoringFromResult(result), kpiPlainEnglish(kpiId));
  }, [metric, result, kpiId]);

  const status = metric?.audit_status ?? raw?.status;
  const statusLabel = status ? AUDIT_STATUS_DISPLAY[status] ?? status : null;
  const title = KPI_DISPLAY_LABEL[kpiId] ?? metric?.label ?? kpiId;
  const drillDownLabel = KPI_DRILL_DOWN_LABEL[kpiId];
  const hasDrillDown = kpiHasDrillDown(kpiId);

  const notConfigured =
    metric &&
    (metric.state === "not_configured" || metric.audit_status === "not_configured") &&
    metric.numeric == null &&
    metric.value !== "Not applicable";
  const notApplicable =
    metric?.audit_status === "not_applicable" || metric?.value === "Not applicable";

  return (
    <article
      id={`kpi-evidence-${kpiId}`}
      className={cn(
        "scroll-mt-24 rounded-lg border border-border/80 border-l-[3px] bg-card px-3.5 py-3 shadow-sm",
        ACCENT[kpiId] ?? "border-l-brand/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground/85">
              {title}
            </h3>
            {statusLabel ? (
              <Badge
                variant="secondary"
                className={cn("text-[0.55rem] font-medium", status ? STATUS_BADGE[status] : "")}
              >
                {statusLabel}
              </Badge>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md border border-border p-1 text-muted-foreground transition-colors hover:border-brand/30 hover:bg-muted/50 hover:text-brand"
          title="Download KPI data"
          aria-label="Download KPI data"
          onClick={onDownload}
        >
          <Download className="size-3" />
        </button>
      </div>

      {loading ? (
        <Skeleton className="mt-2 h-16 w-full" />
      ) : notConfigured ? (
        <div className="mt-2">
          <NotConfiguredVisual label={metric!.label} />
        </div>
      ) : notApplicable ? (
        <div className="mt-2">
          <NotApplicableVisual label={metric!.label} />
        </div>
      ) : enriched && ctx ? (
        <KpiDetailSummary kpiId={kpiId} ctx={ctx} metric={metric} enriched={enriched} />
      ) : enriched ? (
        <div className="mt-2 space-y-1">
          <p className="text-xl font-semibold tabular-nums">{enriched.display_value}</p>
          {enriched.coverage_display ? (
            <p className="text-[10px] text-muted-foreground">{enriched.coverage_display}</p>
          ) : null}
        </div>
      ) : null}

      {!loading && hasDrillDown && ctx && metric && !notConfigured && !notApplicable ? (
        <div className="mt-2">
          <button
            type="button"
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-brand hover:underline"
            onClick={() => setVisualExpanded((v) => !v)}
            aria-expanded={visualExpanded}
          >
            {visualExpanded ? "Hide details" : drillDownLabel}
            <ChevronDown
              className={cn("size-3 transition-transform", visualExpanded && "rotate-180")}
            />
          </button>
          {visualExpanded ? (
            <div className="mt-2 rounded-md border border-border/50 bg-muted/15 p-2.5">
              <KpiDetailExpandedVisual kpiId={kpiId} ctx={ctx} metric={metric} />
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && metric ? (
        <KpiCalculationPanel
          kpiId={kpiId}
          result={result}
          metric={metric}
          raw={raw}
          ctx={ctx}
          className="mt-2.5 group"
        />
      ) : null}
    </article>
  );
}

export { formatCoverage, STATUS_BADGE };
