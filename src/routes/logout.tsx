import { createFileRoute, redirect } from "@tanstack/react-router";

/** Sign-out target — session teardown happens here once auth is wired. */
export const Route = createFileRoute("/logout")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
});
