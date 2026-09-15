import { createFileRoute } from "@tanstack/react-router";

import { ControlTowerDataTable } from "@/components/control-tower/ControlTowerDataTable";
import {
  backToDashboardSearch,
  buildControlTowerDemo,
  exportRiskSkusCsv,
  parseControlTowerPageSearch,
} from "@/lib/control-tower";
import { useGlobalFilters } from "@/lib/global-filters";

export const Route = createFileRoute("/dashboard/risk-skus")({
  validateSearch: parseControlTowerPageSearch,
  head: () => ({ meta: [{ title: "SKU Risk — Control Tower" }] }),
  component: RiskSkusPage,
});

function RiskSkusPage() {
  const search = Route.useSearch();
  const { filters } = useGlobalFilters();
  const model = search.ctModel ?? "all";
  const data = buildControlTowerDemo(model);

  return (
    <ControlTowerDataTable
      title="SKU Risk Ranking"
      description="All SKUs ranked by risk impact."
      columns={[
        { key: "sku", label: "SKU" },
        { key: "product", label: "Product" },
        { key: "location", label: "Location" },
        { key: "metric", label: "Risk Metric" },
        { key: "score", label: "Risk Score" },
      ]}
      rows={data.riskSkusFull}
      searchKeys={["sku", "product", "location", "metric"]}
      onExportCsv={() => exportRiskSkusCsv(data, filters)}
      backSearch={backToDashboardSearch(search)}
      ctModel={model}
    />
  );
}
