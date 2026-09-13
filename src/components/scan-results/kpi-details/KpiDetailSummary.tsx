import type { KpiMetric } from "@/lib/execution-metrics";
import {
  buildAssortmentRows,
  buildMslRows,
  buildOsaEvidence,
  type KpiDetailsContext,
} from "@/lib/kpi-details-data";
import { kpiHasDrillDown } from "@/lib/kpi-detail-groups";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import { kpiPlainEnglish } from "@/lib/role-audit-ui";
import type { EnrichedKpiMetric } from "@/lib/kpi-results-display";
import { cn } from "@/lib/utils";

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function MiniProgressBar({
  percent,
  target,
  className,
}: {
  percent: number | null;
  target?: number | null;
  className?: string;
}) {
  if (percent == null) return null;
  const pct = clampPct(percent);
  return (
    <div className={cn("relative h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      {target != null ? (
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground/35"
          style={{ left: `${clampPct(target)}%` }}
          title={`Target ${Math.round(target)}%`}
        />
      ) : null}
    </div>
  );
}

function SubMetricLine({ enriched }: { enriched: EnrichedKpiMetric }) {
  const kpiId = enriched.key as AuditKpiId;

  if (kpiId === "osa" && enriched.numerator != null && enriched.denominator != null) {
    return (
      <p className="text-[11px] font-medium tabular-nums text-foreground">
        {enriched.numerator} / {enriched.denominator} available
      </p>
    );
  }

  if (kpiId === "assortment_compliance" || kpiId === "msl_compliance") {
    return null;
  }

  if (enriched.facing_observed != null && enriched.facing_planned != null) {
    return (
      <p className="text-[11px] font-medium tabular-nums text-foreground">
        {enriched.facing_observed} / {enriched.facing_planned} planned
        {enriched.facing_of_planned_label ? (
          <span className="font-normal text-muted-foreground"> · {enriched.facing_of_planned_label}</span>
        ) : null}
      </p>
    );
  }

  return null;
}

export function KpiDetailSummary({
  kpiId,
  ctx,
  metric,
  enriched,
}: {
  kpiId: AuditKpiId;
  ctx: KpiDetailsContext;
  metric?: KpiMetric;
  enriched: EnrichedKpiMetric;
}) {
  const description = kpiPlainEnglish(kpiId);
  const hideMiniVisual = kpiHasDrillDown(kpiId);
  const status = metric?.audit_status ?? enriched.audit_status;
  const notActive =
    status === "not_configured" ||
    status === "not_applicable" ||
    status === "not_assessable";

  let assortmentLine: string | null = null;
  if (kpiId === "assortment_compliance" || kpiId === "msl_compliance") {
    const rows =
      kpiId === "msl_compliance" ? buildMslRows(ctx) : buildAssortmentRows(ctx);
    const present = rows.filter((r) => r.present).length;
    const total = rows.length;
    if (total > 0) assortmentLine = `${present} / ${total} required products present`;
  }

  let osaLine: string | null = null;
  if (kpiId === "osa" && !notActive) {
    const ev = buildOsaEvidence(ctx);
    osaLine = `${ev.available} / ${ev.assessed} available`;
  }

  const showProgress =
    !notActive &&
    enriched.progress_percent != null &&
    (kpiId === "osa" ||
      kpiId === "share_of_shelf" ||
      kpiId === "price_compliance" ||
      kpiId === "promotional_compliance" ||
      kpiId === "assortment_compliance" ||
      kpiId === "msl_compliance" ||
      kpiId === "location_accuracy" ||
      kpiId === "planogram_compliance");

  const targetLine =
    enriched.target_percent != null
      ? `Target ${Math.round(enriched.target_percent)}%`
      : null;

  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
        {enriched.display_value}
      </p>
      {description ? (
        <p className="text-[11px] leading-snug text-muted-foreground">{description}</p>
      ) : null}

      {!hideMiniVisual && showProgress ? (
        <MiniProgressBar
          percent={enriched.progress_percent}
          target={enriched.target_percent}
          className="mt-1"
        />
      ) : null}

      {kpiId === "share_of_shelf" && enriched.numeric != null && !notActive ? (
        <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="bg-brand"
            style={{ width: `${clampPct(enriched.numeric)}%` }}
          />
          <div
            className="bg-brand/20"
            style={{ width: `${clampPct(100 - enriched.numeric)}%` }}
          />
        </div>
      ) : null}

      {osaLine ? (
        <p className="text-[11px] font-medium tabular-nums text-foreground">{osaLine}</p>
      ) : assortmentLine ? (
        <p className="text-[11px] font-medium tabular-nums text-foreground">{assortmentLine}</p>
      ) : (
        <SubMetricLine enriched={enriched} />
      )}

      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
        {enriched.coverage_display ? <span>{enriched.coverage_display}</span> : null}
        {targetLine ? <span>{targetLine}</span> : null}
      </div>
    </div>
  );
}
