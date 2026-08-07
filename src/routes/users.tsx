import { createFileRoute, redirect } from "@tanstack/react-router";

/** Canonical URL for team & user management is /team — keep /users working. */
export const Route = createFileRoute("/users")({
  beforeLoad: () => {
    throw redirect({ to: "/team" });
  },
});
