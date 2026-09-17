import { createFileRoute } from "@tanstack/react-router";

import { ControlTowerDataTable } from "@/components/control-tower/ControlTowerDataTable";
import { EmptyState, Skeleton } from "@/components/States";
import {
  backToDashboardSearch,
  exportOperationalTrendCsv,
  parseControlTowerPageSearch,
  useControlTowerDashboard,
} from "@/lib/control-tower";
import { useGlobalFilters } from "@/lib/global-filters";

export const Route = createFileRoute("/dashboard/operational-trend")({
  validateSearch: parseControlTowerPageSearch,
  head: () => ({ meta: [{ title: "Operational Trend — Control Tower" }] }),
  component: OperationalTrendPage,
});

function OperationalTrendPage() {
  const search = Route.useSearch();
  const { filters } = useGlobalFilters();
  const model = search.ctModel ?? "all";
  const query = useControlTowerDashboard(model, filters);

  if (query.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (query.error || !query.data) {
    return <EmptyState title="Could not load trend" description="Try refreshing the page." />;
  }

  const data = query.data;
  const columns = [
    { key: "date", label: "Date" },
    ...data.operationalTrendMetrics.map((m) => ({ key: m.key, label: m.label })),
  ];

  return (
    <ControlTowerDataTable
      title="Operational Trend"
      description="Daily completed audits vs findings for the selected period."
      columns={columns}
      rows={data.operationalTrend as Record<string, unknown>[]}
      searchKeys={["date"]}
      onExportCsv={() => exportOperationalTrendCsv(data, filters)}
      backSearch={backToDashboardSearch(search)}
      ctModel={model}
      demoBanner={false}
    />
  );
}
