import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CreditCard, FileBarChart, LayoutGrid, Settings, Store, Users } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceLinkCard } from "@/components/workspace/WorkspaceLinkCard";

type ManageTab = "stores" | "skus" | "templates" | "team" | "settings";

export const Route = createFileRoute("/manage")({
  validateSearch: (search: Record<string, unknown>): { tab: ManageTab } => ({
    tab: ["stores", "skus", "templates", "team", "settings"].includes(String(search.tab))
      ? (search.tab as ManageTab)
      : "stores",
  }),
  head: () => ({ meta: [{ title: "Manage — Aislix" }] }),
  component: ManageWorkspace,
});

function ManageWorkspace() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <AppShell title="Manage" description="Stores, SKUs, templates, people and workspace settings.">
      <Tabs
        value={tab}
        onValueChange={(value) => void navigate({ search: { tab: value as ManageTab } })}
      >
        <TabsList className="mb-5 h-auto flex-wrap justify-start">
          <TabsTrigger value="stores">Stores & Locations</TabsTrigger>
          <TabsTrigger value="skus">SKUs & Planograms</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tab === "stores" ? (
          <WorkspaceLinkCard
            title="Store network"
            description="Country, city, store ID, manager, GPS, performance and locations."
            to="/stores"
            icon={<Store className="size-4" />}
          />
        ) : null}
        {tab === "skus" ? (
          <>
            <WorkspaceLinkCard
              title="SKUs & planograms"
              description="Expected shelf data, store planograms and CSV library."
              to="/store-master"
              icon={<LayoutGrid className="size-4" />}
            />
            <WorkspaceLinkCard
              title="SKU intelligence"
              description="Last 5/10 audits, variance trends, RCA and evidence."
              to="/sku-intelligence"
              icon={<LayoutGrid className="size-4" />}
            />
          </>
        ) : null}
        {tab === "templates" ? (
          <WorkspaceLinkCard
            title="Template library"
            description="Predefined FNV, Expiry and Planogram templates plus custom builder."
            to="/audit-templates"
            icon={<FileBarChart className="size-4" />}
          />
        ) : null}
        {tab === "team" ? (
          <WorkspaceLinkCard
            title="Team & permissions"
            description="Members, roles, store access and audit responsibility."
            to="/team"
            icon={<Users className="size-4" />}
          />
        ) : null}
        {tab === "settings" ? (
          <>
            <WorkspaceLinkCard
              title="Workspace settings"
              description="Organization, notifications and operational defaults."
              to="/settings"
              icon={<Settings className="size-4" />}
            />
            <WorkspaceLinkCard
              title="Billing & usage"
              description="Subscription, seats and audit usage."
              to="/billing"
              icon={<CreditCard className="size-4" />}
            />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
