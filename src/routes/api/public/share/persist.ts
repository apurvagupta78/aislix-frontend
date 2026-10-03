import { createFileRoute } from "@tanstack/react-router";
import {
  hashForBucket,
  requestClientIp,
  tooManyRequests,
  withinRateLimits,
} from "@/lib/rate-limit.server";

type PersistBody = {
  sessionToken?: string;
  landing_session_id?: string;
  snapshot?: Record<string, unknown>;
  scanContext?: Record<string, unknown>;
};

const MAX_BODY_BYTES = 1024 * 1024;

/**
 * Return a public /share link for a landing demo audit. The session must have
 * been recorded by the landing scan route; see persistDemoShareSession.
 */
export const Route = createFileRoute("/api/public/share/persist")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
          return Response.json({ detail: "Audit data is too large to share." }, { status: 413 });
        }

        let body: PersistBody;
        try {
          const text = await request.text();
          if (text.length > MAX_BODY_BYTES) {
            return Response.json({ detail: "Audit data is too large to share." }, { status: 413 });
          }
          body = JSON.parse(text) as PersistBody;
        } catch {
          return Response.json({ detail: "Expected JSON body." }, { status: 400 });
        }

        const sessionToken = String(
          body.sessionToken ?? body.landing_session_id ?? "",
        ).trim();
        const scanContext =
          body.scanContext &&
          typeof body.scanContext === "object" &&
          !Array.isArray(body.scanContext)
            ? body.scanContext
            : null;
        if (!sessionToken) {
          return Response.json({ detail: "Missing demo session." }, { status: 400 });
        }

        const ipHash = await hashForBucket(requestClientIp(request));
        if (!(await withinRateLimits([[`share_persist:ip:${ipHash}`, 30, 3600]]))) {
          return tooManyRequests();
        }

        try {
          const { persistDemoShareSession, resolvePublicShare } = await import(
            "@/lib/scan-share.server"
          );
          const accepted = await persistDemoShareSession(sessionToken, scanContext);
          if (!accepted) {
            return Response.json(
              { detail: "Demo session not found — run the audit again to share it." },
              { status: 404 },
            );
          }
          const verified = await resolvePublicShare(sessionToken).catch(() => null);
          if (!verified?.report && !verified?.demoSession) {
            return Response.json(
              { detail: "Share link was saved but could not be verified. Try again." },
              { status: 503 },
            );
          }
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Could not save share link.";
          console.error("Demo share persist failed:", detail);
          const publicDetail =
            detail === "Audit data is too large to share." ? detail : "Could not save share link.";
          return Response.json({ detail: publicDetail }, { status: 503 });
        }

        const origin = new URL(request.url).origin;
        return Response.json(
          { url: `${origin}/share/${sessionToken}`, token: sessionToken },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
