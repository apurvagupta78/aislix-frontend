import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PRODUCTION_ORIGIN, serverAppOrigin } from "@/lib/app-origin";
import { hashForBucket, requestClientIp, withinRateLimits } from "@/lib/rate-limit.server";

const BodySchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(200).optional(),
  signup_url: z.string().max(2048),
});

const WINDOW_SECONDS = 60 * 60;
const PER_EMAIL_LIMIT = 3;
const PER_IP_LIMIT = 20;
const GLOBAL_DAILY_LIMIT = 500;

/** Only links back into this app are emailed; anything else becomes the default signup URL. */
function safeSignupUrl(raw: string, email: string, requestOrigin: string): string {
  const allowed = new Set([serverAppOrigin(), PRODUCTION_ORIGIN, requestOrigin]);
  try {
    const url = new URL(raw, requestOrigin);
    if (allowed.has(url.origin)) return url.toString();
  } catch {
    // fall through
  }
  return `${serverAppOrigin()}/signup?email=${encodeURIComponent(email)}`;
}

export const Route = createFileRoute("/api/send-landing-onboarding")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed: z.infer<typeof BodySchema>;
        try {
          parsed = BodySchema.parse(await request.json());
        } catch {
          return Response.json(
            { ok: false, error: "email and signup_url are required" },
            { status: 400 },
          );
        }
        const email = parsed.email.trim().toLowerCase();
        const ipHash = await hashForBucket(requestClientIp(request));
        const emailHash = await hashForBucket(email);
        const allowed = await withinRateLimits([
          [`onboarding:ip:${ipHash}`, PER_IP_LIMIT, WINDOW_SECONDS],
          [`onboarding:email:${emailHash}`, PER_EMAIL_LIMIT, WINDOW_SECONDS],
          ["onboarding:global", GLOBAL_DAILY_LIMIT, 86400],
        ]);
        if (!allowed) {
          return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
        }
        const signupUrl = safeSignupUrl(parsed.signup_url, email, new URL(request.url).origin);

        try {
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          const result = await sendTemplateEmail("landing-onboarding", email, {
            templateData: { name: parsed.name, signupUrl },
          });
          if (!result.sent) {
            // Suppressed recipient — expected outcome, not an error.
            return Response.json({ ok: false, error: "recipient_suppressed" });
          }
          return Response.json({ ok: true });
        } catch (error) {
          console.error("Landing onboarding email failed:", error);
          return Response.json(
            { ok: false, error: "Failed to send onboarding email" },
            { status: 502 },
          );
        }
      },
    },
  },
});
