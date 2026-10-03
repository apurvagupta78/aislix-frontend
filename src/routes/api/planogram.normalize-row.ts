import { createFileRoute } from "@tanstack/react-router";
import { proxyPlanogramRequest } from "@/lib/planogram-proxy.server";

export const Route = createFileRoute("/api/planogram/normalize-row")({
  server: {
    handlers: {
      POST: async ({ request }) => proxyPlanogramRequest(request, "/planogram/normalize-row"),
    },
  },
});
