import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { UniversalAuditExecutor } from "@/components/audit-engine/UniversalAuditExecutor";
import { ErrorState } from "@/components/States";

export const Route = createFileRoute("/audit/$assignmentId")({
  validateSearch: (search: Record<string, unknown>): { test?: boolean } =>
    search.test === true || search.test === "true" ? { test: true } : {},
  head: () => ({ meta: [{ title: "Audit — Aislix" }] }),
  component: UniversalAuditRoute,
});

function UniversalAuditRoute() {
  const { assignmentId } = Route.useParams();
  const { test } = Route.useSearch();

  if (!assignmentId) {
    return (
      <AppShell title="Audit">
        <ErrorState description="Missing assignment ID." />
      </AppShell>
    );
  }

  return (
    <AppShell title="Audit execution">
      <UniversalAuditExecutor assignmentId={assignmentId} testMode={test === true} />
    </AppShell>
  );
}
