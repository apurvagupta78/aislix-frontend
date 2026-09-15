import { Link, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { ControlTowerShell } from "@/components/control-tower/ControlTowerShell";
import { DashboardSubNav } from "@/components/control-tower/DashboardSubNav";
import { Button } from "@/components/ui/button";
import type { ControlTowerSearch } from "@/lib/control-tower";

function parseControlTowerSearch(search: Record<string, unknown>): ControlTowerSearch {
  const model =
    typeof search.model === "string" &&
    ["all", "local_store", "supermarket", "dark_store", "warehouse", "fmcg_distributor"].includes(
      search.model,
    )
      ? (search.model as ControlTowerSearch["model"])
      : undefined;

  return {
    model: model ?? "all",
    drill: typeof search.drill === "string" ? (search.drill as ControlTowerSearch["drill"]) : undefined,
    kpi: typeof search.kpi === "string" ? search.kpi : undefined,
    location: typeof search.location === "string" ? search.location : undefined,
    category: typeof search.category === "string" ? search.category : undefined,
    sku: typeof search.sku === "string" ? search.sku : undefined,
    audit: typeof search.audit === "string" ? search.audit : undefined,
    finding: typeof search.finding === "string" ? search.finding : undefined,
    action: typeof search.action === "string" ? search.action : undefined,
  };
}

export const Route = createFileRoute("/dashboard")({
  validateSearch: parseControlTowerSearch,
  head: () => ({
    meta: [
      { title: "Control Tower — Aislix" },
      {
        name: "description",
        content:
          "Operational command center — audit execution, KPIs, findings, corrective actions and risk across your retail operation.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const search = Route.useSearch();

  return (
    <AppShell
      title="Control Tower"
      description="Executive and operational command center for audit execution, exceptions and retail intelligence."
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/new-audit">New audit</Link>
          </Button>
          <Button asChild variant="brand" size="sm">
            <Link to="/audit-templates">Template library</Link>
          </Button>
        </div>
      }
    >
      <DashboardSubNav />
      <ControlTowerShell search={search} routePath="/dashboard" />
    </AppShell>
  );
}
