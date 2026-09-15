import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { DashboardSubNav } from "@/components/control-tower/DashboardSubNav";
import { MyPerformanceView } from "@/components/control-tower/MyPerformanceView";
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

export const Route = createFileRoute("/dashboard/my-performance")({
  validateSearch: parseControlTowerSearch,
  head: () => ({ meta: [{ title: "My Performance — Aislix" }] }),
  component: MyPerformancePage,
});

function MyPerformancePage() {
  const search = Route.useSearch();
  return (
    <AppShell
      title="My Performance"
      description="Role-scoped audit completion, evidence and finding metrics for your authorized scope."
    >
      <DashboardSubNav />
      <MyPerformanceView search={search} />
    </AppShell>
  );
}
