import { Link, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/design-system/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/States";
import { getTerminology } from "@/lib/audit-engine/operating-model-catalog";

export const Route = createFileRoute("/operations/distributors")({
  head: () => ({ meta: [{ title: "Distributors — Aislix" }] }),
  component: DistributorsPage,
});

function DistributorsPage() {
  const terms = getTerminology("fmcg_distributor");
  return (
    <AppShell title="" hidePageHeader>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Operations"
          title="Distributors"
          description={`FMCG hierarchy: Region → Territory → Distributor → Sales Rep → Beat → ${terms.location}.`}
        />
        <EmptyState
          title="Distributor operations shell"
          description="Distributor coverage and execution scores wire in Phase 2. FMCG templates are seeded in Audit Templates."
          action={
            <Button asChild variant="brand">
              <Link to="/audit-templates">Browse FMCG templates</Link>
            </Button>
          }
        />
      </div>
    </AppShell>
  );
}
