import { createFileRoute } from "@tanstack/react-router";

import { ControlTowerDataTable } from "@/components/control-tower/ControlTowerDataTable";
import { EmptyState, Skeleton } from "@/components/States";
import {
  backToDashboardSearch,
  exportRiskSkusCsv,
  parseControlTowerPageSearch,
  useControlTowerDashboard,
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
  const query = useControlTowerDashboard(model, filters);

  if (query.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (query.error || !query.data) {
    return <EmptyState title="Could not load SKU risk" description="Try refreshing the page." />;
  }

  const data = query.data;

  return (
    <ControlTowerDataTable
      title="SKU Risk Ranking"
      description="SKUs ranked by open findings."
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
      demoBanner={false}
    />
  );
}
