/**
 * KPI details section — compact grouped grid with collapsible drill-down visuals.
 */

import { useMemo } from "react";
import { Download } from "lucide-react";
import { Skeleton } from "@/components/States";
import { Button } from "@/components/ui/button";
import { buildRoleKpiMetrics } from "@/lib/execution-metrics";
import { downloadAllKpiCsv, downloadKpiCsv } from "@/lib/kpi-details-csv";
import { buildKpiDetailsContext } from "@/lib/kpi-details-data";
import { kpiDetailGroupsForRole } from "@/lib/kpi-detail-groups";
import { primaryKpiIds, type AuditRoleTab } from "@/lib/role-audit-ui";
import type { ScanResult } from "@/lib/scan-results";
import { KpiDetailCard } from "@/components/scan-results/kpi-details/KpiDetailCard";

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
  const groups = kpiDetailGroupsForRole(role);

  const metrics = useMemo(() => {
    const list = buildRoleKpiMetrics(data, role);
    return Object.fromEntries(list.map((k) => [k.key, k]));
  }, [data, role]);

  const ctx = useMemo(
    () => (data ? buildKpiDetailsContext(data, role) : null),
    [data, role],
  );

  return (
    <section className="rounded-xl border border-border/70 bg-muted/30 p-4 sm:p-5">
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

      <div className="mt-4 space-y-5">
        {loading && !data
          ? groups.map((group) => (
              <div key={group.label}>
                <Skeleton className="mb-2 h-3 w-36" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.kpi_ids.map((id) => (
                    <div key={id} className="rounded-lg border border-border/80 bg-card p-3">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="mt-3 h-14 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            ))
          : null}

        {!loading || data
          ? groups.map((group) => (
              <div key={group.label}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {group.kpi_ids.map((id) => {
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
                        ctx={ctx}
                        onDownload={() => downloadKpiCsv(data, role, id)}
                      />
                    );
                  })}
                </div>
              </div>
            ))
          : null}
      </div>
    </section>
  );
}
