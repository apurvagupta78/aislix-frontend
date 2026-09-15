import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { UniversalAuditExecutor } from "@/components/audit-engine/UniversalAuditExecutor";
import { ErrorState } from "@/components/States";

export const Route = createFileRoute("/audit/$assignmentId")({
  head: () => ({ meta: [{ title: "Audit — Aislix" }] }),
  component: UniversalAuditRoute,
});

function UniversalAuditRoute() {
  const { assignmentId } = Route.useParams();

  if (!assignmentId) {
    return (
      <AppShell title="Audit">
        <ErrorState description="Missing assignment ID." />
      </AppShell>
    );
  }

  return (
    <AppShell title="Audit Execution">
      <UniversalAuditExecutor assignmentId={assignmentId} />
    </AppShell>
  );
}
