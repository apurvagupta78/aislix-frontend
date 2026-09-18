import { createFileRoute, redirect } from "@tanstack/react-router";

/** Alias route — demo evidence upload lives at /admin/demo-seed. */
export const Route = createFileRoute("/admin/demo-evidence")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/demo-seed" });
  },
});
