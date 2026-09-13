import { createFileRoute, redirect } from "@tanstack/react-router";

export { formatDate, statusBadge } from "./my-audits";

/** Legacy URL — assigned audit tasks now live at /my-audits. */
export const Route = createFileRoute("/my-scans")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/my-audits", search });
  },
  component: () => null,
});
