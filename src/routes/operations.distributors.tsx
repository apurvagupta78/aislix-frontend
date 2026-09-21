import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/operations/distributors")({
  beforeLoad: () => {
    throw redirect({ to: "/stores/", search: { model: "fmcg_distributor" } });
  },
});
