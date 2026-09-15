import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { DashboardSubNav } from "@/components/control-tower/DashboardSubNav";
import { ExecutiveView } from "@/components/control-tower/ExecutiveView";
import type { ControlTowerSearch } from "@/lib/control-tower";

function parseControlTowerSearch(search: Record<string, unknown>): ControlTowerSearch {
  const model =
    typeof search.model === "string" &&
    ["all", "local_store", "supermarket", "dark_store", "warehouse", "fmcg_distributor"].includes(
      search.model,
    )
      ? (search.model as ControlTowerSearch["model"])
      : undefined;
  return { model: model ?? "all" };
}

export const Route = createFileRoute("/dashboard/executive")({
  validateSearch: parseControlTowerSearch,
  head: () => ({ meta: [{ title: "Executive View — Aislix" }] }),
  component: ExecutivePage,
});

function ExecutivePage() {
  const search = Route.useSearch();
  return (
    <AppShell
      title="Executive View"
      description="Organization-level summary for senior management — coverage, risk and SLA at a glance."
    >
      <DashboardSubNav />
      <ExecutiveView search={search} />
    </AppShell>
  );
}
