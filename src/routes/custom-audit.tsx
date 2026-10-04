import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { ErrorState } from "@/components/States";

/** Old link target — every template audit now runs on /audit/$assignmentId, which enforces the evidence policy. */
export const Route = createFileRoute("/custom-audit")({
  validateSearch: (search: Record<string, unknown>) => ({
    assignmentId: typeof search.assignmentId === "string" ? search.assignmentId : undefined,
    test: search.test === true || search.test === "true",
  }),
  beforeLoad: ({ search }) => {
    if (search.assignmentId) {
      throw redirect({
        to: "/audit/$assignmentId",
        params: { assignmentId: search.assignmentId },
        search: search.test ? { test: true } : {},
      });
    }
  },
  head: () => ({ meta: [{ title: "Custom Audit — Aislix" }] }),
  component: () => (
    <AppShell title="Custom Audit">
      <ErrorState description="Open this page from My Work with a custom template assignment." />
    </AppShell>
  ),
});
