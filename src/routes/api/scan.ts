import { createFileRoute } from "@tanstack/react-router";

/**
 * Proxy endpoint for the Railway FastAPI vision backend.
 *
 * The frontend uploads a shelf image here as multipart/form-data with the
 * field name "file". This handler forwards that file to the Railway backend
 * and returns the raw JSON response unchanged.
 */
export const Route = createFileRoute("/api/scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const backendUrl = process.env["AISLIX_AI_API_URL"];
        if (!backendUrl) {
          return Response.json(
            { error: "AI backend URL is not configured. Set the AISLIX_AI_API_URL secret." },
            { status: 503 },
          );
        }

        let formData: FormData;
        try {
          formData = await request.formData();
        } catch {
          return Response.json({ error: "Expected multipart/form-data request body." }, { status: 400 });
        }

        const file = formData.get("file");
        if (!(file instanceof File)) {
          return Response.json({ error: 'Missing "file" field in multipart body.' }, { status: 400 });
        }

        const forward = new FormData();
        forward.append("file", file);

        let response: Response;
        try {
          response = await fetch(`${backendUrl.replace(/\/+$/, "")}/scan`, {
            method: "POST",
            body: forward,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not reach the AI backend.";
          return Response.json({ error: message }, { status: 502 });
        }

        const contentType = response.headers.get("content-type") || "application/json";
        const body = await response.text();
        return new Response(body, {
          status: response.status,
          headers: { "content-type": contentType },
        });
      },
    },
  },
});
