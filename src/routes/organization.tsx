import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/organization")({
  beforeLoad: () => {
    throw redirect({ to: "/stores", search: { page: 1, page_size: 12 } });
  },
});
