import { createFileRoute, redirect } from "@tanstack/react-router";

/** Canonical supermarket org list uses stores model filter. */
export const Route = createFileRoute("/supermarkets")({
  beforeLoad: () => {
    throw redirect({ to: "/stores/", search: { model: "supermarket" } });
  },
});
