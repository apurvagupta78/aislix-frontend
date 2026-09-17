import { createFileRoute } from "@tanstack/react-router";

import { ControlTowerDataTable } from "@/components/control-tower/ControlTowerDataTable";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Skeleton } from "@/components/States";
import {
  backToDashboardSearch,
  exportRiskLocationsCsv,
  parseControlTowerPageSearch,
  useControlTowerDashboard,
} from "@/lib/control-tower";
import { useGlobalFilters } from "@/lib/global-filters";

export const Route = createFileRoute("/dashboard/risk-locations")({
  validateSearch: parseControlTowerPageSearch,
  head: () => ({ meta: [{ title: "Location Risk — Control Tower" }] }),
  component: RiskLocationsPage,
});

function RiskLocationsPage() {
  const search = Route.useSearch();
  const { filters } = useGlobalFilters();
  const model = search.ctModel ?? "all";
  const query = useControlTowerDashboard(model, filters);

  if (query.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (query.error || !query.data) {
    return <EmptyState title="Could not load location risk" description="Try refreshing the page." />;
  }

  const data = query.data;

  return (
    <ControlTowerDataTable
      title="Location Risk Ranking"
      description="Locations ranked by open high/critical findings."
      columns={[
        { key: "name", label: "Location" },
        { key: "metric", label: "Primary Risk Metric" },
        {
          key: "score",
          label: "Risk Score",
          render: (row) => (
            <Badge variant={row.score >= 80 ? "destructive" : "secondary"}>{String(row.score)}</Badge>
          ),
        },
        { key: "trend", label: "Trend" },
      ]}
      rows={data.riskLocationsFull}
      searchKeys={["name", "metric"]}
      onExportCsv={() => exportRiskLocationsCsv(data, filters)}
      backSearch={backToDashboardSearch(search)}
      ctModel={model}
      demoBanner={false}
    />
  );
}
