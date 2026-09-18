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

const AttachmentSchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  dataBase64: z.string().min(1).max(15_000_000),
  size: z.number().int().positive().max(10 * 1024 * 1024),
});

const AskInputSchema = z.object({
  question: z.string().min(1).max(2000),
  activeOrgId: z.string().uuid(),
  filters: FiltersSchema,
  messages: z.array(MessageSchema).max(10).optional(),
  conversationId: z.string().uuid().optional(),
  attachments: z.array(AttachmentSchema).max(5).optional(),
  previewDemo: z.boolean().optional(),
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
      attachments: data.attachments,
      previewDemo: data.previewDemo,
    });
  });

const HelpAskOrgSchema = z.object({
  activeOrgId: z.string().uuid(),
});

const HelpAskBuildSchema = z.object({
  activeOrgId: z.string().uuid(),
  intent: z.record(z.string(), z.unknown()),
});

export const getHelpAskAislixOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => HelpAskOrgSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { getHelpAskAislixOptionsServer } = await import("@/lib/ask-aislix/help-ask-aislix.server");
    return getHelpAskAislixOptionsServer(context.supabase, context.userId, data.activeOrgId);
  });

export const buildHelpAskQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => HelpAskBuildSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { buildHelpAskQuestionServer } = await import("@/lib/ask-aislix/help-ask-aislix.server");
    return buildHelpAskQuestionServer(
      context.supabase,
      context.userId,
      data.activeOrgId,
      data.intent,
    );
  });
