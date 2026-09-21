import { createFileRoute, redirect } from "@tanstack/react-router";

/** Canonical distributors UI lives under /operations/distributors. */
export const Route = createFileRoute("/distributors")({
  beforeLoad: () => {
    throw redirect({ to: "/operations/distributors" });
  },
});
