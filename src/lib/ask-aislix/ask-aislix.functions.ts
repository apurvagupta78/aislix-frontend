import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DashboardFilterState } from "@/lib/dashboard-filters";
import type { AskAislixMessage } from "@/lib/ask-aislix/ask-aislix.types";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(8000),
});

const FiltersSchema = z.object({
  datePreset: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  storeId: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  teamMemberId: z.string().optional(),
  auditAssignment: z.string().optional(),
  skuId: z.string().optional(),
  itemCode: z.string().optional(),
  itemName: z.string().optional(),
});

const AskInputSchema = z.object({
  question: z.string().min(1).max(2000),
  activeOrgId: z.string().uuid(),
  filters: FiltersSchema,
  messages: z.array(MessageSchema).max(10).optional(),
  conversationId: z.string().uuid().optional(),
});

export const askAislix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { askAislixServer } = await import("@/lib/ask-aislix/ask-aislix.server");
    return askAislixServer(context.supabase, context.userId, {
      question: data.question,
      activeOrgId: data.activeOrgId,
      filters: data.filters as DashboardFilterState,
      messages: data.messages as AskAislixMessage[] | undefined,
      conversationId: data.conversationId,
    });
  });
