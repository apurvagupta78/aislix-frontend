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
        { key: "date", label: "Date" },
        { key: "auditId", label: "Audit ID" },
        { key: "location", label: "Store" },
        { key: "city", label: "City" },
        { key: "template", label: "Audit Name" },
        { key: "assignedTo", label: "Audit Assigned" },
        { key: "stage", label: "Stage" },
      ]}
      rows={data.auditExecutionFull as unknown as Record<string, unknown>[]}
      searchKeys={["auditId", "location", "city", "template", "assignedTo", "stage"]}
      onExportCsv={() => exportAuditExecutionCsv(data, filters)}
      backSearch={backToDashboardSearch(search)}
      ctModel={model}
      demoBanner={false}
    />
  );
}
