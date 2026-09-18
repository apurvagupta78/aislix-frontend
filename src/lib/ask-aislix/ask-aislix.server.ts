import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import type {
  Response,
  ResponseFunctionToolCall,
  ResponseInput,
  ResponseInputItem,
} from "openai/resources/responses/responses";

import type { Database } from "@/integrations/supabase/types";
import {
  AskAislixResponseSchema,
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
  RESPONSE_TOOLS,
  compactToolResultForModel,
  executeTool,
  type ToolContext,
} from "@/lib/ask-aislix/tools";

const MAX_TOOL_ROUNDS = Number(process.env.ASK_AISLIX_MAX_TOOL_ROUNDS ?? 5);
const MAX_MESSAGES = Number(process.env.ASK_AISLIX_MAX_MESSAGES ?? 10);
const REQUEST_TIMEOUT_MS = Number(process.env.ASK_AISLIX_REQUEST_TIMEOUT_MS ?? 45000);

export type AskAislixServerResult = {
  response: AskAislixResponse;
  conversationId: string;
  ok: boolean;
};

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  return new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS });
}

function getModel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
}

function getFallbackModel(): string {
  return process.env.OPENAI_FALLBACK_MODEL ?? "gpt-5.6-terra";
}

function sanitizeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown error";
  return error.message.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 500);
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

function buildInitialInput(request: AskAislixRequest, history: AskAislixMessage[]): ResponseInput {
  const items: ResponseInputItem[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  items.push({ role: "user", content: request.question });
  return items;
}

function extractFunctionCalls(response: Response): ResponseFunctionToolCall[] {
  return response.output.filter((item): item is ResponseFunctionToolCall => item.type === "function_call");
}

async function runToolLoop(
  client: OpenAI,
  model: string,
  instructions: string,
  initialInput: ResponseInput,
  toolCtx: ToolContext,
  toolsInvoked: string[],
  pendingImages: ImageGalleryItem[],
): Promise<Response> {
  let input: ResponseInput = [...initialInput];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.responses.create({
      model,
      instructions,
      input,
      tools: RESPONSE_TOOLS,
      parallel_tool_calls: true,
    });

    const calls = extractFunctionCalls(response);
    if (!calls.length) return response;

    input = [...input, ...response.output];
    for (const call of calls) {
      toolsInvoked.push(call.name);
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }
      const result = await executeTool(call.name, toolCtx, args);
      if (result.pendingImages?.length) pendingImages.push(...result.pendingImages);
      input.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(compactToolResultForModel(result)),
      });
    }
  }

  return client.responses.create({
    model,
    instructions,
    input,
    tools: RESPONSE_TOOLS,
  });
}

async function finalizeStructuredResponse(
  client: OpenAI,
  model: string,
  instructions: string,
  input: ResponseInput,
): Promise<Response> {
  return client.responses.create({
    model,
    instructions: `${instructions}\n\nReturn one JSON object matching AskAislixResponse with keys: answer, summary, metrics, visual, table, insights, actions, source_context, follow_up_questions.`,
    input: [
      ...input,
      {
        role: "user",
        content:
          "Using the tool results above, return the final AskAislixResponse JSON object only.",
      },
    ],
    text: { format: { type: "json_object" } },
  });
}

function parseResponse(raw: string): AskAislixResponse {
  try {
    return AskAislixResponseSchema.parse(JSON.parse(raw));
  } catch {
    return {
      answer: raw.slice(0, 4000) || "I could not format the response.",
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
}

async function runPipeline(
  client: OpenAI,
  model: string,
  instructions: string,
  initialInput: ResponseInput,
  toolCtx: ToolContext,
  toolsInvoked: string[],
  pendingImages: ImageGalleryItem[],
): Promise<{ response: Response; usage?: Response["usage"] }> {
  const loopResponse = await runToolLoop(client, model, instructions, initialInput, toolCtx, toolsInvoked, pendingImages);
  const finalInput: ResponseInput = [...initialInput, ...loopResponse.output];
  const finalResponse = await finalizeStructuredResponse(client, model, instructions, finalInput);
  return { response: finalResponse, usage: finalResponse.usage };
}

export async function askAislixServer(
  supabase: SupabaseClient<Database>,
  userId: string,
  request: AskAislixRequest,
): Promise<AskAislixServerResult> {
  const started = Date.now();
  const conversationId = request.conversationId ?? crypto.randomUUID();
  const toolsInvoked: string[] = [];
  const pendingImages: ImageGalleryItem[] = [];

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

  const instructions = `${ASK_AISLIX_SYSTEM_PROMPT}\n\nFilter context: ${buildFilterContext(request, scope)}`;
  const initialInput = buildInitialInput(request, (request.messages ?? []).slice(-MAX_MESSAGES));
  const client = getOpenAIClient();
  const primaryModel = getModel();

  try {
    let result;
    try {
      result = await runPipeline(client, primaryModel, instructions, initialInput, toolCtx, toolsInvoked, pendingImages);
    } catch (primaryError) {
      const fallback = getFallbackModel();
      if (fallback === primaryModel) throw primaryError;
      result = await runPipeline(client, fallback, instructions, initialInput, toolCtx, toolsInvoked, pendingImages);
    }

    const raw = result.response.output_text || "{}";
    const parsed = parseResponse(raw);
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
      tokenUsage: result.usage,
    });

    return { response: parsed, conversationId, ok: true };
  } catch (error) {
    const message = sanitizeErrorMessage(error);
    await logRequest(supabase, {
      orgId: request.activeOrgId,
      userId,
      conversationId,
      question: request.question,
      tools: toolsInvoked,
      status: "error",
      latencyMs: Date.now() - started,
      errorCode: message,
    });

    if (message.includes("rate")) throw new Error(message);

    return {
      ok: false,
      conversationId,
      response: {
        answer: "Ask Aislix could not complete your request.",
        summary: message,
        metrics: [],
        visual: { type: "none", title: "", data: [] },
        table: { columns: [], rows: [] },
        insights: [],
        actions: [],
        source_context: { period: "", locations: [] },
        follow_up_questions: ["What needs attention today?", "Show overdue actions"],
      },
    };
  }
}
