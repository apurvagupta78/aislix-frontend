import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { AiDigitalDashboardShell } from "@/components/dashboard/AiDigitalDashboardShell";
import { GlobalFilterProvider } from "@/lib/global-filters";

type DashboardSearch = {
  tab?: "overview" | "ai" | "digital";
};

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    tab: search.tab === "digital" || search.tab === "ai" ? search.tab : ("overview" as const),
  }),
  head: () => ({
    meta: [
      { title: "Dashboard — Aislix" },
      { property: "og:title", content: "Dashboard — Aislix" },
      { property: "og:description", content: "Store, city and country audit intelligence, corrective actions and SLA performance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "description",
        content: "AI Audits and Digital Audits operational dashboard with deterministic KPIs.",
      },
    ],
  }),
  component: DashboardPage,
});

/**
 * Nested /dashboard/kpis, /dashboard/audit-execution, … need an Outlet or the overview stays stuck.
 * Child pages read filters before their AppShell mounts, so the provider wraps the Outlet.
 */
function DashboardPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isIndex = pathname === "/dashboard" || pathname === "/dashboard/";
  if (!isIndex) {
    return (
      <GlobalFilterProvider>
        <Outlet />
      </GlobalFilterProvider>
    );
  }

  return (
    <AppShell title="" hidePageHeader>
      <AiDigitalDashboardShell />
    </AppShell>
  );
}
