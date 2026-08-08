import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/upload")({
  beforeLoad: () => {
    throw redirect({ to: "/scan" });
  },
});
