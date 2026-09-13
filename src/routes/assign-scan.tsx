import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy URL — assign an audit at /assign-audit. */
export const Route = createFileRoute("/assign-scan")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/assign-audit", search });
  },
  component: () => null,
});
