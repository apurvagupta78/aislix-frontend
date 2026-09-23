import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  question: z.string().min(3).max(500),
  audits: z
    .array(
      z.object({
        id: z.string(),
        auditName: z.string().optional(),
        storeName: z.string().optional(),
        scorePct: z.number().nullable().optional(),
        completionStage: z.string().optional(),
        type: z.string().optional(),
        date: z.string().optional(),
      }),
    )
    .min(1)
    .max(10),
});

export const generateDashboardCustomMetric = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const { generateDashboardCustomMetricWithLuna } = await import(
      "@/lib/dashboard-custom-metric.luna"
    );
    return generateDashboardCustomMetricWithLuna({
      question: data.question,
      auditsJson: JSON.stringify(data.audits),
    });
  });
