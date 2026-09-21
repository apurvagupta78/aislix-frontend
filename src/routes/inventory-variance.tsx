import { createFileRoute, redirect } from "@tanstack/react-router";

/** Short alias → canonical Inventory & Variance page. */
export const Route = createFileRoute("/inventory-variance")({
  beforeLoad: () => {
    throw redirect({ to: "/intelligence/inventory-variance" });
  },
});
