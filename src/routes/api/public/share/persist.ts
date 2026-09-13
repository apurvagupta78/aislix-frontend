import { createFileRoute } from "@tanstack/react-router";

type PersistBody = {
  sessionToken?: string;
  landing_session_id?: string;
  snapshot?: Record<string, unknown>;
};

/**
 * Persist a demo audit snapshot before copying a public /share link.
 * Writes to Supabase and mirrors to Railway so either store can serve the link.
 */
export const Route = createFileRoute("/api/public/share/persist")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: PersistBody;
        try {
          body = (await request.json()) as PersistBody;
        } catch {
          return Response.json({ detail: "Expected JSON body." }, { status: 400 });
        }

        const sessionToken = String(
          body.sessionToken ?? body.landing_session_id ?? "",
        ).trim();
        const snapshot =
          body.snapshot && typeof body.snapshot === "object" && !Array.isArray(body.snapshot)
            ? body.snapshot
            : null;
        if (!sessionToken) {
          return Response.json({ detail: "Missing demo session." }, { status: 400 });
        }
        if (!snapshot) {
          return Response.json({ detail: "Missing audit snapshot." }, { status: 400 });
        }

        const origin = new URL(request.url).origin;
        const url = `${origin}/share/${sessionToken}`;
        let saved = false;
        let lastError: string | null = null;

        try {
          const { persistDemoShareSession } = await import("@/lib/scan-share.server");
          await persistDemoShareSession(sessionToken, snapshot);
          saved = true;
        } catch (error) {
          lastError = error instanceof Error ? error.message : "Supabase persist failed.";
          console.error("Demo share Supabase persist failed:", lastError);
        }

        const backendUrl =
          process.env["AISLIX_AI_API_URL"] ||
          process.env["VITE_AISLIX_API_URL"] ||
          "https://aislix-backend-production.up.railway.app";
        try {
          const res = await fetch(`${backendUrl.replace(/\/+$/, "")}/landing/share/persist`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              session_token: sessionToken,
              landing_session_id: sessionToken,
              snapshot,
            }),
          });
          if (res.ok) {
            saved = true;
            const payload = (await res.json().catch(() => ({}))) as { url?: string };
            return Response.json(
              { url: payload.url ?? url, token: sessionToken },
              { headers: { "Cache-Control": "no-store" } },
            );
          }
          const detail = await res.text();
          lastError = detail.slice(0, 300) || `Backend returned ${res.status}`;
          console.error("Demo share backend persist failed:", lastError);
        } catch (error) {
          lastError = error instanceof Error ? error.message : "Backend persist failed.";
          console.error("Demo share backend persist failed:", lastError);
        }

        if (saved) {
          try {
            const { resolvePublicShare } = await import("@/lib/scan-share.server");
            const verified = await resolvePublicShare(sessionToken);
            if (!verified.report && !verified.demoSession) {
              return Response.json(
                { detail: "Share link was saved but could not be verified. Try again." },
                { status: 503 },
              );
            }
          } catch {
            return Response.json(
              { detail: "Share link was saved but could not be verified. Try again." },
              { status: 503 },
            );
          }
          return Response.json(
            { url, token: sessionToken },
            { headers: { "Cache-Control": "no-store" } },
          );
        }
        return Response.json(
          { detail: lastError ?? "Could not save share link." },
          { status: 503 },
        );
      },
    },
  },
});
