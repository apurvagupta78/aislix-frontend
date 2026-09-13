import { createFileRoute } from "@tanstack/react-router";

/**
 * Public share resolver — always runs on the server (same pattern as landing scan).
 * Workspace share tokens and demo landing session tokens both resolve here.
 */
export const Route = createFileRoute("/api/public/share/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String(params.token ?? "").trim();
        if (!token) {
          return Response.json({ detail: "Missing share token." }, { status: 400 });
        }

        try {
          const { resolvePublicShare } = await import("@/lib/scan-share.server");
          const payload = await resolvePublicShare(token);
          return Response.json(payload, {
            headers: { "Cache-Control": "no-store" },
          });
        } catch {
          const backendUrl =
            process.env["AISLIX_AI_API_URL"] ||
            process.env["VITE_AISLIX_API_URL"] ||
            "https://aislix-backend-production.up.railway.app";
          try {
            const res = await fetch(
              `${backendUrl.replace(/\/+$/, "")}/landing/session/${encodeURIComponent(token)}`,
              { headers: { Accept: "application/json" } },
            );
            if (res.ok) {
              const demoSession = await res.json();
              if (demoSession?.status === "completed") {
                return Response.json(
                  { report: null, demoSession },
                  { headers: { "Cache-Control": "no-store" } },
                );
              }
            }
          } catch {
            /* fall through */
          }
          return Response.json({ detail: "Share link not found." }, { status: 404 });
        }
      },
    },
  },
});
