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

        const lovableKey = process.env["LOVABLE_API_KEY"];
        const resendKey = process.env["RESEND_API_KEY"];
        if (!lovableKey || !resendKey) {
          return Response.json(
            { ok: false, error: "Resend connection is not configured" },
            { status: 500 },
          );
        }

        const fromEmail = process.env["INVITE_FROM_EMAIL"] ?? "onboarding@resend.dev";
        const fromName = process.env["INVITE_FROM_NAME"] ?? "Aislix";
        const greeting = name ? `Hi ${name},` : "Hi,";

        const html = `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
            <p>${greeting}</p>
            <p>Thanks for trying Aislix shelf intelligence. You're one step away from your free workspace with 3 shelf scans.</p>
            <p style="margin:28px 0">
              <a href="${signup_url}" style="background:#09283e;color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Create your free Aislix account &rarr;</a>
            </p>
            <p style="font-size:13px;color:#64748b">Or copy this link: <a href="${signup_url}" style="color:#09283e">${signup_url}</a></p>
            <p style="margin-top:32px;color:#64748b">&mdash; Aislix</p>
          </div>`;

        const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": resendKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: [email],
            subject: "Your Aislix free workspace — complete signup",
            html,
          }),
        });

        const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
        if (!res.ok) {
          console.error(`Resend error [${res.status}]:`, body);
          return Response.json(
            { ok: false, error: body.message ?? "Failed to send onboarding email" },
            { status: 502 },
          );
        }

        return Response.json({ ok: true, resendId: body.id });
      },
    },
  },
});
