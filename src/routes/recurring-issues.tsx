import { createFileRoute, redirect } from "@tanstack/react-router";

/** Recurring issues surface under Exceptions until a dedicated route ships. */
export const Route = createFileRoute("/recurring-issues")({
  beforeLoad: () => {
    throw redirect({ to: "/exceptions" });
  },
});
