import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy URL — team assignments now live at /assigned-audits. */
export const Route = createFileRoute("/assigned-scans")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/assigned-audits", search });
  },
  component: () => null,
});
