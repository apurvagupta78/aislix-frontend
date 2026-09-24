import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { AiDigitalDashboardShell } from "@/components/dashboard/AiDigitalDashboardShell";

type DashboardSearch = {
  tab?: "ai" | "digital";
};

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    tab: search.tab === "digital" ? ("digital" as const) : ("ai" as const),
  }),
  head: () => ({
    meta: [
      { title: "Dashboard — Aislix" },
      {
        name: "description",
        content: "AI Audits and Digital Audits operational dashboard with deterministic KPIs.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <AppShell title="" hidePageHeader>
      <AiDigitalDashboardShell />
    </AppShell>
  );
}
