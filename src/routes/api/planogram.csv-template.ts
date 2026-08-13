import { createFileRoute } from "@tanstack/react-router";

import { SAMPLE_CSV_TEMPLATE } from "@/lib/planogram-template";

/** Same-origin proxy for the Railway planogram CSV template (see parse-csv). */
export const Route = createFileRoute("/api/planogram/csv-template")({
  server: {
    handlers: {
      GET: async () => {
        const backendUrl = process.env["AISLIX_AI_API_URL"];
        if (backendUrl) {
          try {
            const response = await fetch(
              `${backendUrl.replace(/\/+$/, "")}/planogram/csv-template`,
              { headers: { Accept: "application/json" } },
            );
            if (response.ok) {
              const text = await response.text();
              return new Response(text, {
                status: 200,
                headers: {
                  "content-type": response.headers.get("content-type") || "application/json",
                },
              });
            }
          } catch {
            // fall through to the local template
          }
        }
        return Response.json({ csv_text: SAMPLE_CSV_TEMPLATE });
      },
    },
  },
});
