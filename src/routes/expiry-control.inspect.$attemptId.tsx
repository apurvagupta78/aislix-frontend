import { Link, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { InspectionWizard } from "@/components/expiry-control/InspectionWizard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/expiry-control/inspect/$attemptId")({
  head: () => ({ meta: [{ title: "Inspect — Expiry Control" }] }),
  component: InspectPage,
});

function InspectPage() {
  const { attemptId } = Route.useParams();

  return (
    <AppShell
      title="Expiry Inspection"
      description="Guided packet inspection with mandatory reconciliation."
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/expiry-control/my-inspections">My inspections</Link>
        </Button>
      }
    >
      <div className="mx-auto max-w-lg pb-24">
        <InspectionWizard attemptId={attemptId} />
      </div>
    </AppShell>
  );
}
