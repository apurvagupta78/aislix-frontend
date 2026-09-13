import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/States";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import { AUDIT_STATUS_DISPLAY, kpiPlainEnglish } from "@/lib/role-audit-ui";
import type { KpiMetric } from "@/lib/execution-metrics";
import type { AuditKpiResult } from "@/lib/retail-intelligence";
import { KPI_DISPLAY_LABEL } from "@/lib/kpi-results-display";
import { scoringFromResult } from "@/lib/kpi-results-display";
import type { ScoringTargets } from "@/lib/planogram-audit-package";
import type { ScanResult } from "@/lib/scan-results";
import { cn } from "@/lib/utils";

const KPI_TARGET_KEY: Partial<Record<AuditKpiId, keyof ScoringTargets>> = {
  osa: "osa_target",
  planogram_compliance: "planogram_target",
  assortment_compliance: "assortment_target",
  price_compliance: "price_target",
  promotional_compliance: "promotional_target",
  msl_compliance: "msl_target",
  share_of_shelf: "share_of_shelf_target",
};

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

function MethodologyPanel({
  metric,
  raw,
  result,
  kpiId,
}: {
  metric?: KpiMetric;
  raw?: AuditKpiResult;
  result: ScanResult;
  kpiId: AuditKpiId;
}) {
  const scoring = scoringFromResult(result);
  const targetKey = KPI_TARGET_KEY[kpiId];
  const target = targetKey ? scoring[targetKey] : undefined;
  const resultVal =
    metric?.unit === "percent" && metric.numeric != null
      ? `${Math.round(metric.numeric)}%`
      : metric?.value ?? "—";
  const num = raw?.numerator ?? metric?.numerator;
  const den = raw?.denominator ?? metric?.denominator;
  const formula =
    num != null && den != null && den > 0
      ? `${num} ÷ ${den} × 100`
      : raw?.formula ?? metric?.formula ?? "—";

  return (
    <details className="mt-3 group">
      <summary className="cursor-pointer text-[11px] font-medium text-brand hover:underline">
        How is this calculated?
      </summary>
      <dl className="mt-2 space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>Result</dt>
          <dd className="font-medium text-foreground">{resultVal}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Formula</dt>
          <dd className="text-right">{formula}</dd>
        </div>
        {raw?.coverage_denominator != null ? (
          <div className="flex justify-between gap-2">
            <dt>Coverage</dt>
            <dd>
              {raw.coverage_numerator ?? den ?? "—"} / {raw.coverage_denominator} assessed
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <dt>Target</dt>
          <dd>{target != null ? `${target}%` : "Not configured"}</dd>
        </div>
        {raw?.excluded_count ? (
          <div className="flex justify-between gap-2">
            <dt>Exclusions</dt>
            <dd>{raw.excluded_count} not assessable</dd>
          </div>
        ) : null}
        {raw?.tooltip ? (
          <div>
            <dt className="mb-0.5">Notes</dt>
            <dd>{raw.tooltip}</dd>
          </div>
        ) : null}
        <p className="pt-1 text-[9px] italic opacity-80">
          Values from deterministic audit formulas, not AI estimates.
        </p>
      </dl>
    </details>
  );
}

export function KpiDetailCard({
  kpiId,
  metric,
  raw,
  result,
  loading,
  wide,
  onDownload,
  children,
}: {
  kpiId: AuditKpiId;
  metric?: KpiMetric;
  raw?: AuditKpiResult;
  result: ScanResult;
  loading?: boolean;
  wide?: boolean;
  onDownload: () => void;
  children: ReactNode;
}) {
  const status = metric?.audit_status ?? raw?.status;
  const statusLabel = status ? AUDIT_STATUS_DISPLAY[status] ?? status : null;
  const title = KPI_DISPLAY_LABEL[kpiId] ?? metric?.label ?? kpiId;
  const description = kpiPlainEnglish(kpiId);

  return (
    <article
      id={`kpi-evidence-${kpiId}`}
      className={cn(
        "scroll-mt-24 rounded-lg border border-border/80 border-l-[3px] bg-card px-4 py-4 shadow-sm",
        ACCENT[kpiId] ?? "border-l-brand/40",
        wide && "sm:col-span-2",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
            {statusLabel ? (
              <Badge
                variant="secondary"
                className={cn("text-[0.6rem] font-medium", status ? STATUS_BADGE[status] : "")}
              >
                {statusLabel}
              </Badge>
            ) : null}
          </div>
          {description ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:border-brand/30 hover:bg-muted/50 hover:text-brand"
          title="Download KPI data"
          aria-label="Download KPI data"
          onClick={onDownload}
        >
          <Download className="size-3.5" />
        </button>
      </div>

      <div className="mt-3">
        {loading ? <Skeleton className="h-28 w-full" /> : children}
      </div>

      {!loading && metric ? (
        <MethodologyPanel metric={metric} raw={raw} result={result} kpiId={kpiId} />
      ) : null}
    </article>
  );
}

export { formatCoverage, STATUS_BADGE };
