import { createFileRoute, redirect } from "@tanstack/react-router";

/** Canonical inventory & variance page. */
export const Route = createFileRoute("/inventory")({
  beforeLoad: () => {
    throw redirect({ to: "/intelligence/inventory-variance" });
  },
});
