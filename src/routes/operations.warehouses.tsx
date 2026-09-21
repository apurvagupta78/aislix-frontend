import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/operations/warehouses")({
  beforeLoad: () => {
    throw redirect({ to: "/stores/", search: { model: "warehouse" } });
  },
});
