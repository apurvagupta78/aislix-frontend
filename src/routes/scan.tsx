import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy URL — shelf auditing now lives at /audit. */
export const Route = createFileRoute("/scan")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/audit", search });
  },
  component: () => null,
});
