import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy URL — campaign demo audits now live under the platform admin console. */
export const Route = createFileRoute("/demo-scans")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/demo-scans" });
  },
  component: () => null,
});
