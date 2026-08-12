import { createFileRoute } from "@tanstack/react-router";

/** Same-origin proxy for the Railway planogram row normalizer (see parse-csv). */
export const Route = createFileRoute("/api/planogram/normalize-row")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const backendUrl = process.env["AISLIX_AI_API_URL"];
        if (!backendUrl) {
          return Response.json(
            { detail: "Planogram API URL is not configured. Contact support." },
            { status: 503 },
          );
        }

        const body = await request.text();
        let response: Response;
        try {
          response = await fetch(`${backendUrl.replace(/\/+$/, "")}/planogram/normalize-row`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Could not reach the Aislix server.";
          return Response.json(
            { detail: `Could not reach the Aislix planogram service (${message}).` },
            { status: 502 },
          );
        }

        const text = await response.text();
        return new Response(text, {
          status: response.status,
          headers: { "content-type": response.headers.get("content-type") || "application/json" },
        });
      },
    },
  },
});
