import { createFileRoute, redirect } from "@tanstack/react-router";

/** Canonical warehouses UI lives under /operations/warehouses → stores model. */
export const Route = createFileRoute("/warehouses")({
  beforeLoad: () => {
    throw redirect({ to: "/operations/warehouses" });
  },
});
