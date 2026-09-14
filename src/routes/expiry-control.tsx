import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { KpiCard } from "@/components/audit-governance/KpiCard";
import { SeverityBadge } from "@/components/expiry-control/SeverityBadge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { isOrgManager } from "@/lib/assignments";
import { fetchExceptions, fetchOverviewMetrics, seedDemoScenario } from "@/lib/expiry-control";
import { useGlobalFilters } from "@/lib/global-filters";

function useIsManager() {
  return useQuery({ queryKey: ["is-org-manager"], queryFn: () => isOrgManager() });
}

export const Route = createFileRoute("/expiry-control")({
  head: () => ({ meta: [{ title: "Expiry Control — Aislix" }] }),
  component: ExpiryControlPage,
});

function ExpiryControlPage() {
  const { filters } = useGlobalFilters();
  const qc = useQueryClient();
  const metricsQuery = useQuery({
    queryKey: ["expiry-metrics", filters.storeId],
    queryFn: () => fetchOverviewMetrics(filters.storeId || undefined),
    retry: false,
  });
  const exceptionsQuery = useQuery({
    queryKey: ["expiry-exceptions"],
    queryFn: fetchExceptions,
    retry: false,
  });

  const managerQuery = useIsManager();
  const seedMutation = useMutation({
    mutationFn: seedDemoScenario,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expiry-metrics"] });
      qc.invalidateQueries({ queryKey: ["expiry-exceptions"] });
    },
  });

  const m = metricsQuery.data;

  return (
    <AppShell
      title="Expiry Control"
      description="Point-in-time expiry inspections — not a guarantee of store-wide clearance."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => metricsQuery.refetch()}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
          {managerQuery.data ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to="/expiry-control/planner">Create inspection</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                Seed demo
              </Button>
            </>
          ) : (
            <Button size="sm" asChild>
              <Link to="/expiry-control/planner">
                <Plus className="mr-1 h-4 w-4" /> Create inspection
              </Link>
            </Button>
          )}
        </div>
      }
    >
      {metricsQuery.isLoading && <Skeleton className="h-48" />}
      {metricsQuery.isError && (
        <ErrorState description="Run the expiry_control migration, then refresh." />
      )}
      {m && (
        <div className="space-y-6">
          <p className="text-xs text-muted-foreground">
            Last refresh: {new Date(m.refreshed_at).toLocaleString()} · Counts exclude superseded recheck attempts where marked.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <KpiCard label="Units in scope" value={String(m.units_in_scope)} hint="Assigned, not yet verified" />
            <KpiCard label="Units inspected" value={String(m.units_inspected)} />
            <KpiCard label="Expired detected" value={String(m.expired_detected)} className="border-red-100" />
            <KpiCard label="Near expiry" value={String(m.near_expiry)} />
            <KpiCard label="Unresolved dates" value={String(m.unresolved_dates)} />
            <KpiCard label="Awaiting removal verify" value={String(m.awaiting_removal_verification)} />
            <KpiCard label="In quarantine" value={String(m.in_quarantine)} />
            <KpiCard label="Disposition pending" value={String(m.disposition_pending)} />
            <KpiCard label="Overdue inspections" value={String(m.overdue_inspections)} />
            <KpiCard label="Open exceptions" value={String(m.open_exceptions)} />
          </div>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Action required</h2>
            {exceptionsQuery.isLoading && <Skeleton className="h-32" />}
            {exceptionsQuery.data?.length === 0 && (
              <EmptyState title="No open expiry exceptions" description="Partial coverage may still exist elsewhere." />
            )}
            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-3">Severity</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Issue</th>
                    <th className="p-3">Qty</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(exceptionsQuery.data ?? []).map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="p-3">
                        <SeverityBadge severity={row.severity} />
                      </td>
                      <td className="p-3">{row.sku ?? "—"}</td>
                      <td className="p-3">{row.title}</td>
                      <td className="p-3 tabular-nums">{row.quantity}</td>
                      <td className="p-3">
                        <Button size="sm" variant="outline" asChild>
                          <Link
                            to="/expiry-control/review"
                            search={{ attemptId: row.attempt_id ?? undefined }}
                          >
                            Review
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
