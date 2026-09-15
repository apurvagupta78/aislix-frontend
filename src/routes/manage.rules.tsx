import { Link, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/States";

export const Route = createFileRoute("/manage/rules")({
  head: () => ({ meta: [{ title: "Audit Rules — Aislix" }] }),
  component: ManageRulesPage,
});

function ManageRulesPage() {
  return (
    <AppShell
      title="Rules"
      description="Reusable audit rules are configured through the Universal Template / Rule Engine."
    >
      <EmptyState
        title="Template rule engine"
        description="Rules live on audit templates (variance → RCA, expiry → finding, etc.). Edit templates to configure rules org-wide."
        action={
          <Button asChild variant="brand">
            <Link to="/audit-templates">Audit Templates</Link>
          </Button>
        }
      />
    </AppShell>
  );
}
