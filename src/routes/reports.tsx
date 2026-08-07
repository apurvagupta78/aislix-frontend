import { createFileRoute, redirect } from "@tanstack/react-router";

/** Canonical report viewer is /report — keep the plural URL working. */
export const Route = createFileRoute("/reports")({
  beforeLoad: () => {
    throw redirect({ to: "/report" });
  },
});
