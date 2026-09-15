import { createFileRoute } from "@tanstack/react-router";

import { ControlTowerDataTable } from "@/components/control-tower/ControlTowerDataTable";
import { Badge } from "@/components/ui/badge";
import {
  backToDashboardSearch,
  buildControlTowerDemo,
  exportRiskLocationsCsv,
  parseControlTowerPageSearch,
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
  const data = buildControlTowerDemo(model);

  return (
    <ControlTowerDataTable
      title="Location Risk Ranking"
      description="All locations ranked by primary risk metric."
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
    />
  );
}
