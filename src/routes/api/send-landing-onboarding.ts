import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const BodySchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(200).optional(),
  signup_url: z.string().max(2048),
});

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
        const { email, name, signup_url } = parsed;

        try {
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          const result = await sendTemplateEmail("landing-onboarding", email, {
            templateData: { name, signupUrl: signup_url },
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
