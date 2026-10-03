import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PRODUCTION_ORIGIN, serverAppOrigin } from "@/lib/app-origin";

const BodySchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(200).optional(),
  signup_url: z.string().max(2048),
});

const WINDOW_MS = 60 * 60 * 1000;
const PER_EMAIL_LIMIT = 3;
const PER_IP_LIMIT = 20;
const hits = new Map<string, number[]>();

function allow(key: string, limit: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, list] of hits) {
      if (!list.some((t) => now - t < WINDOW_MS)) hits.delete(k);
    }
  }
  return true;
}

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
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ??
          "unknown";
        if (!allow(`ip:${ip}`, PER_IP_LIMIT) || !allow(`email:${email}`, PER_EMAIL_LIMIT)) {
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
