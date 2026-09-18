import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";

import type { Database } from "@/integrations/supabase/types";
import {
  AskAislixResponseSchema,
  OUT_OF_SCOPE_MESSAGE,
  type AskAislixMessage,
  type AskAislixRequest,
  type AskAislixResponse,
  type ImageGalleryItem,
} from "@/lib/ask-aislix/ask-aislix.types";
import { ASK_AISLIX_SYSTEM_PROMPT } from "@/lib/ask-aislix/ask-aislix.prompt";
import { buildAskAccessScope, clampFiltersToScope } from "@/lib/ask-aislix/context";
import { checkAskRateLimit } from "@/lib/ask-aislix/rate-limit";
import { sanitizeActions } from "@/lib/ask-aislix/actions";
import {
  TOOL_DEFINITIONS,
  compactToolResultForModel,
  executeTool,
  type ToolContext,
} from "@/lib/ask-aislix/tools";

const MAX_TOOL_ROUNDS = Number(process.env.ASK_AISLIX_MAX_TOOL_ROUNDS ?? 5);
const MAX_MESSAGES = Number(process.env.ASK_AISLIX_MAX_MESSAGES ?? 10);
const REQUEST_TIMEOUT_MS = Number(process.env.ASK_AISLIX_REQUEST_TIMEOUT_MS ?? 45000);

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  return new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS });
}

function getModel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

function getFallbackModel(): string {
  return process.env.OPENAI_FALLBACK_MODEL ?? "gpt-4o-mini";
}

async function signImageGalleryItems(
  supabase: SupabaseClient<Database>,
  items: ImageGalleryItem[],
): Promise<ImageGalleryItem[]> {
  const signed: ImageGalleryItem[] = [];
  for (const item of items) {
    const { data } = await supabase.storage
      .from(item.storageBucket)
      .createSignedUrl(item.storagePath, 3600);
    signed.push({ ...item, url: data?.signedUrl ?? undefined });
  }
  return signed;
}

async function logRequest(
  supabase: SupabaseClient<Database>,
  input: {
    orgId: string;
    userId: string;
    conversationId?: string;
    question: string;
    tools: string[];
    status: "success" | "error" | "rate_limited";
    latencyMs: number;
    tokenUsage?: unknown;
    errorCode?: string;
  },
) {
  try {
    await (supabase as SupabaseClient).from("ask_aislix_logs" as "profiles").insert({
      org_id: input.orgId,
      user_id: input.userId,
      conversation_id: input.conversationId ?? null,
      question: input.question.slice(0, 2000),
      tools_invoked: input.tools,
      status: input.status,
      latency_ms: input.latencyMs,
      token_usage: input.tokenUsage ?? null,
      error_code: input.errorCode ?? null,
    } as never);
  } catch {
    // logging must not break the user flow
  }
}

function buildFilterContext(request: AskAislixRequest, scope: Awaited<ReturnType<typeof buildAskAccessScope>>) {
  const filters = clampFiltersToScope(request.filters, scope);
  return JSON.stringify({
    period: filters.datePreset,
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    store_id: filters.storeId,
    city: filters.city,
    country: filters.country,
    authorized_store_count: scope.allowedStoreIds.length,
    authorized_cities: scope.allowedCities.slice(0, 20),
  });
}

export async function askAislixServer(
  supabase: SupabaseClient<Database>,
  userId: string,
  request: AskAislixRequest,
): Promise<{ response: AskAislixResponse; conversationId: string }> {
  const started = Date.now();
  const conversationId = request.conversationId ?? crypto.randomUUID();
  const toolsInvoked: string[] = [];
  let pendingImages: ImageGalleryItem[] = [];

  const rate = checkAskRateLimit(userId, request.activeOrgId);
  if (!rate.ok) {
    await logRequest(supabase, {
      orgId: request.activeOrgId,
      userId,
      conversationId,
      question: request.question,
      tools: [],
      status: "rate_limited",
      latencyMs: Date.now() - started,
      errorCode: rate.reason,
    });
    throw new Error("Too many Ask Aislix requests. Please try again later.");
  }

  const scope = await buildAskAccessScope(supabase, userId, request.activeOrgId);
  const toolCtx: ToolContext = {
    supabase,
    scope,
    filters: clampFiltersToScope(request.filters, scope),
  };

  const history = (request.messages ?? []).slice(-MAX_MESSAGES);
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `${ASK_AISLIX_SYSTEM_PROMPT}\n\nFilter context: ${buildFilterContext(request, scope)}`,
    },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: request.question },
  ];

  const client = getOpenAIClient();
  let model = getModel();

  async function runWithModel(activeModel: string) {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await client.chat.completions.create({
        model: activeModel,
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
      });

      const choice = completion.choices[0];
      if (!choice?.message) break;

      if (choice.message.tool_calls?.length) {
        messages.push(choice.message);
        for (const call of choice.message.tool_calls) {
          const name = call.function.name;
          toolsInvoked.push(name);
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
          } catch {
            args = {};
          }
          const result = await executeTool(name, toolCtx, args);
          if (result.pendingImages?.length) {
            pendingImages = [...pendingImages, ...result.pendingImages];
          }
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(compactToolResultForModel(result)),
          });
        }
        continue;
      }

      messages.push(choice.message);
      break;
    }

    messages.push({
      role: "user",
      content:
        "Using the tool results above, return the final AskAislixResponse as a single JSON object with keys: answer, summary, metrics, visual, table, insights, actions, source_context, follow_up_questions.",
    });

    const finalCompletion = await client.chat.completions.create({
      model: activeModel,
      messages,
      response_format: { type: "json_object" },
    });

    return finalCompletion;
  }

  try {
    let completion;
    try {
      completion = await runWithModel(model);
    } catch (primaryError) {
      const fallback = getFallbackModel();
      if (fallback === model) throw primaryError;
      completion = await runWithModel(fallback);
    }

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: AskAislixResponse;
    try {
      parsed = AskAislixResponseSchema.parse(JSON.parse(raw));
    } catch {
      parsed = {
        answer: raw.slice(0, 4000),
        summary: "",
        metrics: [],
        visual: { type: "none", title: "", data: [] },
        table: { columns: [], rows: [] },
        insights: [],
        actions: [],
        source_context: { period: "", locations: [] },
        follow_up_questions: [],
      };
    }

    parsed.actions = sanitizeActions(parsed.actions ?? []);

    if ((parsed.visual?.type === "image_gallery" || pendingImages.length) && pendingImages.length) {
      parsed.visual = { type: "image_gallery", title: parsed.visual?.title ?? "Audit evidence", data: [] };
      const signed = await signImageGalleryItems(supabase, pendingImages.slice(0, 20));
      parsed.visual.data = signed.map((img) => ({
        url: img.url,
        caption: img.caption,
        captured_at: img.capturedAt,
        store_name: img.storeName,
        scan_id: img.scanId,
        assignment_id: img.assignmentId,
      }));
    }

    await logRequest(supabase, {
      orgId: scope.orgId,
      userId,
      conversationId,
      question: request.question,
      tools: toolsInvoked,
      status: "success",
      latencyMs: Date.now() - started,
      tokenUsage: completion.usage,
    });

    return { response: parsed, conversationId };
  } catch (error) {
    await logRequest(supabase, {
      orgId: request.activeOrgId,
      userId,
      conversationId,
      question: request.question,
      tools: toolsInvoked,
      status: "error",
      latencyMs: Date.now() - started,
      errorCode: error instanceof Error ? error.message : "unknown",
    });

    if (error instanceof Error && error.message.includes("rate")) throw error;

    return {
      response: {
        answer: OUT_OF_SCOPE_MESSAGE,
        summary: "Something went wrong while analyzing your data.",
        metrics: [],
        visual: { type: "none", title: "", data: [] },
        table: { columns: [], rows: [] },
        insights: [],
        actions: [],
        source_context: { period: "", locations: [] },
        follow_up_questions: ["What needs attention today?", "Show overdue actions"],
      },
      conversationId,
    };
  }
}
