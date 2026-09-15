import { createFileRoute } from "@tanstack/react-router";

import { ControlTowerDataTable } from "@/components/control-tower/ControlTowerDataTable";
import {
  backToDashboardSearch,
  buildControlTowerDemo,
  exportOperationalTrendCsv,
  parseControlTowerPageSearch,
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
  const data = buildControlTowerDemo(model);

  const columns = [
    { key: "date", label: "Date" },
    ...data.operationalTrendMetrics.map((m) => ({ key: m.key, label: m.label })),
  ];

  return (
    <ControlTowerDataTable
      title="Operational Trend"
      description="Daily operational metrics for the selected operating model."
      columns={columns}
      rows={data.operationalTrend as Record<string, unknown>[]}
      searchKeys={["date"]}
      onExportCsv={() => exportOperationalTrendCsv(data, filters)}
      backSearch={backToDashboardSearch(search)}
      ctModel={model}
    />
  );
}
