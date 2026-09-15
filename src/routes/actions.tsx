import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Clock, PackageSearch, Wrench } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceLinkCard } from "@/components/workspace/WorkspaceLinkCard";

type ActionTab = "findings" | "corrective" | "expiry" | "sla";

export const Route = createFileRoute("/actions")({
  validateSearch: (search: Record<string, unknown>): { tab: ActionTab } => ({
    tab: ["findings", "corrective", "expiry", "sla"].includes(String(search.tab))
      ? (search.tab as ActionTab)
      : "findings",
  }),
  head: () => ({ meta: [{ title: "Actions — Aislix" }] }),
  component: ActionsWorkspace,
});

function ActionsWorkspace() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <AppShell
      title="Actions"
      description="Findings, corrective actions, expiry control and SLA in one workspace."
    >
      <Tabs
        value={tab}
        onValueChange={(value) => void navigate({ search: { tab: value as ActionTab } })}
      >
        <TabsList className="mb-5 h-auto flex-wrap justify-start">
          <TabsTrigger value="findings">Findings</TabsTrigger>
          <TabsTrigger value="corrective">Corrective Actions</TabsTrigger>
          <TabsTrigger value="expiry">Expiry & Quarantine</TabsTrigger>
          <TabsTrigger value="sla">SLA & Escalation</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tab === "findings" ? (
          <>
            <WorkspaceLinkCard
              title="Findings"
              description="Open, assigned, verified and historical audit findings."
              to="/findings"
              icon={<AlertTriangle className="size-4" />}
            />
            <WorkspaceLinkCard
              title="Exception queue"
              description="Prioritized operational exceptions requiring manager action."
              to="/exceptions"
              icon={<AlertTriangle className="size-4" />}
              badge="Manager"
            />
          </>
        ) : null}
        {tab === "corrective" ? (
          <WorkspaceLinkCard
            title="Corrective actions"
            description="Ownership, before/after evidence, verification and closure."
            to="/corrective-actions"
            icon={<Wrench className="size-4" />}
          />
        ) : null}
        {tab === "expiry" ? (
          <>
            <WorkspaceLinkCard
              title="Expiry Control"
              description="Expiry overview, inspections and action-required queue."
              to="/expiry-control"
              icon={<PackageSearch className="size-4" />}
            />
            <WorkspaceLinkCard
              title="Quarantine & disposition"
              description="Receipt, quantity matching, return and disposal verification."
              to="/expiry-control/quarantine"
              icon={<PackageSearch className="size-4" />}
            />
          </>
        ) : null}
        {tab === "sla" ? (
          <WorkspaceLinkCard
            title="SLA & escalation"
            description="Due dates, escalation recipients and overdue controls."
            to="/escalation-settings"
            icon={<Clock className="size-4" />}
            badge="Manager"
          />
        ) : null}
      </div>
    </AppShell>
  );
}
