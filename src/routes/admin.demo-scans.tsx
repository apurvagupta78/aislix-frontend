import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy URL — demo audit sessions now live at /admin/demo-audits. */
export const Route = createFileRoute("/admin/demo-scans")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/demo-audits" });
  },
  component: () => null,
});
