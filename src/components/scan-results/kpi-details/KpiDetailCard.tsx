import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/States";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import { AUDIT_STATUS_DISPLAY, kpiPlainEnglish } from "@/lib/role-audit-ui";
import type { KpiMetric } from "@/lib/execution-metrics";
import type { AuditKpiResult } from "@/lib/retail-intelligence";
import { KPI_DISPLAY_LABEL } from "@/lib/kpi-results-display";
import type { KpiDetailsContext } from "@/lib/kpi-details-data";
import type { ScanResult } from "@/lib/scan-results";
import { KpiCalculationPanel } from "@/components/scan-results/kpi-details/KpiCalculationPanel";
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
  wide,
  onDownload,
  children,
  ctx,
}: {
  kpiId: AuditKpiId;
  metric?: KpiMetric;
  raw?: AuditKpiResult;
  result: ScanResult;
  loading?: boolean;
  wide?: boolean;
  onDownload: () => void;
  children: ReactNode;
  ctx?: KpiDetailsContext | null;
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
        <KpiCalculationPanel
          kpiId={kpiId}
          result={result}
          metric={metric}
          raw={raw}
          ctx={ctx}
        />
      ) : null}
    </article>
  );
}

export { formatCoverage, STATUS_BADGE };
