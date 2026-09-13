import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy URL — platform audits admin now lives at /admin/audits. */
export const Route = createFileRoute("/admin/scans")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/admin/audits", search });
  },
  component: () => null,
});
