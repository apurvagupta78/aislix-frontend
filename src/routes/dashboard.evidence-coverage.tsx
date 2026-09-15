import { createFileRoute } from "@tanstack/react-router";

import { ControlTowerDataTable } from "@/components/control-tower/ControlTowerDataTable";
import {
  backToDashboardSearch,
  buildControlTowerDemo,
  exportEvidenceCoverageCsv,
  parseControlTowerPageSearch,
} from "@/lib/control-tower";
import { useGlobalFilters } from "@/lib/global-filters";

export const Route = createFileRoute("/dashboard/evidence-coverage")({
  validateSearch: parseControlTowerPageSearch,
  head: () => ({ meta: [{ title: "Evidence Coverage — Control Tower" }] }),
  component: EvidenceCoveragePage,
});

function EvidenceCoveragePage() {
  const search = Route.useSearch();
  const { filters } = useGlobalFilters();
  const model = search.ctModel ?? "all";
  const data = buildControlTowerDemo(model);

  return (
    <ControlTowerDataTable
      title="Evidence Coverage"
      description="Required vs verified evidence units across audits."
      columns={[
        { key: "unitId", label: "Unit ID" },
        { key: "auditId", label: "Audit ID" },
        { key: "location", label: "Location" },
        { key: "evidenceType", label: "Evidence Type" },
        { key: "status", label: "Status" },
      ]}
      rows={data.evidenceCoverageFull}
      searchKeys={["unitId", "auditId", "location", "evidenceType", "status"]}
      onExportCsv={() => exportEvidenceCoverageCsv(data, filters)}
      backSearch={backToDashboardSearch(search)}
      ctModel={model}
    />
  );
}
