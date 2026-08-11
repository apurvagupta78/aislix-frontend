import { createFileRoute, redirect } from "@tanstack/react-router";

/** Canonical scan history lives at /history — keep this URL working. */
export const Route = createFileRoute("/scan-history")({
  beforeLoad: () => {
    throw redirect({ to: "/history" });
  },
});
