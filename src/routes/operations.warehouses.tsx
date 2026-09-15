import { Link, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/States";
import { getTerminology } from "@/lib/audit-engine/operating-model-catalog";

export const Route = createFileRoute("/operations/warehouses")({
  head: () => ({ meta: [{ title: "Warehouses — Aislix" }] }),
  component: WarehousesPage,
});

function WarehousesPage() {
  const terms = getTerminology("warehouse");
  return (
    <AppShell
      title="Warehouses"
      description={`${terms.locationPlural} use the universal hierarchy engine — Zone → Aisle → Rack → Bin → SKU.`}
    >
      <EmptyState
        title="Warehouse operations shell"
        description="Warehouse master data and health scores connect in Phase 2. Warehouse audit templates are available in Audit Templates."
        action={
          <Button asChild variant="brand">
            <Link to="/audit-templates">Browse warehouse templates</Link>
          </Button>
        }
      />
    </AppShell>
  );
}
