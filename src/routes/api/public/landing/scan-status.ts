import { createFileRoute } from "@tanstack/react-router";
import { GENERIC_SCAN, parseApiDetail } from "@/lib/api-errors";
import {
  attachLunaAnalysis,
  parseAiAnalysisText,
  recordLandingSession,
  safeLandingResult,
} from "@/lib/landing-scan-finalize.server";
import {
  hashForBucket,
  requestClientIp,
  tooManyRequests,
  withinRateLimits,
} from "@/lib/rate-limit.server";

const SESSION_TOKEN = /^[a-f0-9]{32}$/;

/** Poll a background demo scan; on completion adds the AI answer and records the session. */
export const Route = createFileRoute("/api/public/landing/scan-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { landing_session_id?: unknown; ai_analysis?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ detail: "Expected a demo audit id." }, { status: 400 });
        }
        const token = typeof body.landing_session_id === "string" ? body.landing_session_id : "";
        if (!SESSION_TOKEN.test(token)) {
          return Response.json({ detail: "Expected a demo audit id." }, { status: 400 });
        }

        const ipHash = await hashForBucket(requestClientIp(request));
        if (!(await withinRateLimits([[`landing_status:ip:${ipHash}`, 900, 3600]]))) {
          return tooManyRequests();
        }

        const backendUrl = process.env["AISLIX_AI_API_URL"];
        if (!backendUrl) {
          return Response.json({ detail: "Shelf analysis is temporarily unavailable." }, { status: 503 });
        }

        let upstream: Response;
        try {
          upstream = await fetch(`${backendUrl.replace(/\/+$/, "")}/landing/scan/${token}/status`);
        } catch {
          return Response.json({ status: "processing" }, { headers: { "Cache-Control": "no-store" } });
        }
        if (upstream.status === 404) {
          return Response.json({ detail: "This demo audit expired. Please run it again." }, { status: 404 });
        }
        if (!upstream.ok) {
          return Response.json({ status: "processing" }, { headers: { "Cache-Control": "no-store" } });
        }

        const job = (await upstream.json().catch(() => null)) as
          | { status?: string; result?: unknown; error?: unknown }
          | null;
        if (job?.status === "failed") {
          const detail = parseApiDetail({ detail: job.error }, GENERIC_SCAN);
          await recordLandingSession(token, { scan_status: "failed", scan_error: detail });
          return Response.json({ detail }, { status: 422, headers: { "Cache-Control": "no-store" } });
        }
        const result =
          job?.status === "completed" && job.result && typeof job.result === "object" && !Array.isArray(job.result)
            ? (job.result as Record<string, unknown>)
            : null;
        if (!result) {
          return Response.json({ status: "processing" }, { headers: { "Cache-Control": "no-store" } });
        }

        const aiRequest = parseAiAnalysisText(
          typeof body.ai_analysis === "string" ? body.ai_analysis : null,
        );
        if (aiRequest) await attachLunaAnalysis(result, aiRequest);
        await recordLandingSession(token, {
          scan_status: "completed",
          scan_error: null,
          scan_id: typeof result.scan_id === "string" ? result.scan_id : null,
          scan_result: safeLandingResult(result),
        });
        result.landing_session_id = token;
        return Response.json(result, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
