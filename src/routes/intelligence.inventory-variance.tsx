import { Link, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/States";

export const Route = createFileRoute("/intelligence/inventory-variance")({
  head: () => ({ meta: [{ title: "Inventory & Variance — Aislix" }] }),
  component: InventoryVariancePage,
});

function InventoryVariancePage() {
  return (
    <AppShell
      title="Inventory & Variance"
      description="Expected vs actual variance intelligence — shares KPI definitions with Control Tower."
    >
      <EmptyState
        title="Phase 1E — intelligence shell"
        description="Live variance analytics wire in Phase 2. Use SKU Intelligence and audit history for current operational data."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="brand">
              <Link to="/sku-intelligence">SKU Intelligence</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/dashboard">Control Tower</Link>
            </Button>
          </div>
        }
      />
    </AppShell>
  );
}
