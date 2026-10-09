import { createFileRoute } from "@tanstack/react-router";

function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Called every few minutes by the Aislix backend timer. The bearer token must match the
 * `report_cron` service secret, which only the service role can read.
 */
export const Route = createFileRoute("/api/cron/report-schedules")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });

        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
        if (!token) return json({ error: "unauthorized" }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: secret } = await supabaseAdmin
          .from("service_secrets" as never)
          .select("value")
          .eq("name", "report_cron")
          .maybeSingle();
        const expected = (secret as { value?: string } | null)?.value ?? "";
        if (!expected || !sameToken(token, expected)) return json({ error: "unauthorized" }, 401);

        let sla: unknown = null;
        try {
          const { data, error } = await supabaseAdmin.rpc("process_sla_alerts" as never, { p_org_id: null } as never);
          if (error) console.error("[report-schedules] SLA alerts failed", error.message);
          sla = data ?? null;
        } catch (err) {
          console.error("[report-schedules] SLA alerts failed", err);
        }

        const { serverAppOrigin } = await import("@/lib/app-origin");
        const { runDueReportSchedules } = await import("@/lib/reports/report-schedule-runner.server");
        try {
          const results = await runDueReportSchedules(supabaseAdmin as never, serverAppOrigin());
          return json({ processed: results.length, results, sla });
        } catch (err) {
          console.error("[report-schedules] run failed", err);
          return json({ error: "run_failed" }, 500);
        }
      },
    },
  },
});
