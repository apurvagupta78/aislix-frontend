import { createFileRoute } from "@tanstack/react-router";

import { ControlTowerDataTable } from "@/components/control-tower/ControlTowerDataTable";
import { EmptyState, Skeleton } from "@/components/States";
import {
  backToDashboardSearch,
  exportAuditExecutionCsv,
  parseControlTowerPageSearch,
  useControlTowerDashboard,
} from "@/lib/control-tower";
import { useGlobalFilters } from "@/lib/global-filters";

export const Route = createFileRoute("/dashboard/audit-execution")({
  validateSearch: parseControlTowerPageSearch,
  head: () => ({ meta: [{ title: "Audit Execution — Control Tower" }] }),
  component: AuditExecutionPage,
});

function AuditExecutionPage() {
  const search = Route.useSearch();
  const { filters } = useGlobalFilters();
  const model = search.ctModel ?? "all";
  const query = useControlTowerDashboard(model, filters);

  if (query.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (query.error || !query.data) {
    return <EmptyState title="Could not load audit execution" description="Try refreshing the page." />;
  }

  const data = query.data;

  return (
    <ControlTowerDataTable
      title="Audit Execution"
      description="Full assignment and audit status for the selected Control Tower scope."
      columns={[
        { key: "auditId", label: "Audit ID" },
        { key: "status", label: "Status" },
        { key: "location", label: "Location" },
        { key: "template", label: "Template" },
        { key: "assignedTo", label: "Assigned To" },
        { key: "dueDate", label: "Due Date" },
      ]}
      rows={data.auditExecutionFull}
      searchKeys={["auditId", "location", "template", "assignedTo", "status"]}
      onExportCsv={() => exportAuditExecutionCsv(data, filters)}
      backSearch={backToDashboardSearch(search)}
      ctModel={model}
      demoBanner={false}
    />
  );
}
