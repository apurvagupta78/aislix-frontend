import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy URL — assigned audit tasks now live at /my-audits. */
export const Route = createFileRoute("/my-scans")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/my-audits", search });
  },
  component: () => null,
});
