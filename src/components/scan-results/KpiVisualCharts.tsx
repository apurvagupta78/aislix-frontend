/**
 * KPI details section — evidence visuals behind each role KPI score.
 */

import { useMemo } from "react";
import { Download } from "lucide-react";
import { Skeleton } from "@/components/States";
import { Button } from "@/components/ui/button";
import { buildRoleKpiMetrics } from "@/lib/execution-metrics";
import { downloadAllKpiCsv, downloadKpiCsv } from "@/lib/kpi-details-csv";
import { buildKpiDetailsContext } from "@/lib/kpi-details-data";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import { primaryKpiIds, type AuditRoleTab } from "@/lib/role-audit-ui";
import type { ScanResult } from "@/lib/scan-results";
import { KpiDetailCard } from "@/components/scan-results/kpi-details/KpiDetailCard";
import { KpiDetailVisualBody } from "@/components/scan-results/kpi-details/KpiDetailVisuals";

const WIDE_KPIS = new Set<AuditKpiId>([
  "location_accuracy",
  "planogram_compliance",
  "share_of_shelf",
  "facing_count",
  "price_compliance",
]);

export function KpiVisualChartsPanel({
  data,
  role,
  loading,
}: {
  data?: ScanResult;
  role: AuditRoleTab;
  loading?: boolean;
}) {
  const kpiIds = primaryKpiIds(role);
  const metrics = useMemo(() => {
    const list = buildRoleKpiMetrics(data, role);
    return Object.fromEntries(list.map((k) => [k.key, k]));
  }, [data, role]);

  const ctx = useMemo(
    () => (data ? buildKpiDetailsContext(data, role) : null),
    [data, role],
  );

  return (
    <section className="rounded-xl border border-border/70 bg-muted/30 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-foreground/70">
            KPI details
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight sm:text-lg">
            See What&apos;s Behind Your Score.
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Explore the products, locations and shelf positions behind each KPI. Download the
            underlying audit data whenever you need it.
          </p>
        </div>
        {data ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-lg text-xs"
            onClick={() => downloadAllKpiCsv(data, role, kpiIds)}
          >
            <Download className="mr-1.5 size-3.5" />
            Download All KPI Data ↓
          </Button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {loading && !data
          ? kpiIds.map((id) => (
              <div key={id} className="rounded-lg border border-border/80 bg-card p-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-4 h-28 w-full" />
              </div>
            ))
          : null}
        {!loading || data
          ? kpiIds.map((id) => {
          const metric = metrics[id];
          const raw = ctx?.raw[id];
          if (!data) return null;
          return (
            <KpiDetailCard
              key={id}
              kpiId={id}
              metric={metric}
              raw={raw}
              result={data}
              loading={loading}
              wide={WIDE_KPIS.has(id)}
              ctx={ctx}
              onDownload={() => downloadKpiCsv(data, role, id)}
            >
              {ctx && metric ? (
                <KpiDetailVisualBody kpiId={id} ctx={ctx} metric={metric} />
              ) : null}
            </KpiDetailCard>
          );
        })
          : null}
      </div>
    </section>
  );
}
