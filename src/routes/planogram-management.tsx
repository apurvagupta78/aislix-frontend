import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/planogram-management")({
  beforeLoad: () => {
    throw redirect({ to: "/store-master" });
  },
});
