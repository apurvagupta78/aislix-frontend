import { createFileRoute } from "@tanstack/react-router";

import { ControlTowerDataTable } from "@/components/control-tower/ControlTowerDataTable";
import {
  backToDashboardSearch,
  buildControlTowerDemo,
  exportKpiCsv,
  parseControlTowerPageSearch,
} from "@/lib/control-tower";
import { useGlobalFilters } from "@/lib/global-filters";

export const Route = createFileRoute("/dashboard/kpis")({
  validateSearch: parseControlTowerPageSearch,
  head: () => ({ meta: [{ title: "KPIs — Control Tower" }] }),
  component: KpisPage,
});

function KpisPage() {
  const search = Route.useSearch();
  const { filters } = useGlobalFilters();
  const model = search.ctModel ?? "all";
  const data = buildControlTowerDemo(model);
  const rows =
    search.scope === "contextual"
      ? data.contextualKpis
      : [...data.universalKpis, ...data.contextualKpis];

  return (
    <ControlTowerDataTable
      title="Control Tower KPIs"
      description="Full KPI snapshot for the selected scope."
      columns={[
        { key: "label", label: "KPI" },
        { key: "value", label: "Value" },
        { key: "detail", label: "Interpretation" },
        { key: "tone", label: "Tone" },
        { key: "source", label: "Source" },
      ]}
      rows={rows as unknown as Record<string, unknown>[]}
      searchKeys={["label", "detail"]}
      onExportCsv={() => exportKpiCsv(data, filters)}
      backSearch={backToDashboardSearch(search)}
      ctModel={model}
    />
  );
}
