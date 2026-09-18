import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";

import type { Database } from "@/integrations/supabase/types";
import { buildAskAccessScope } from "@/lib/ask-aislix/context";
import { checkAskRateLimit } from "@/lib/ask-aislix/rate-limit";
import { HELP_ASK_AISLIX_SYSTEM_PROMPT } from "@/lib/ask-aislix/help-ask-aislix.prompt";
import { validateHelpAskIntent } from "@/lib/ask-aislix/help-ask-aislix.validate";
import type {
  HelpAskAuthorizedOptions,
  HelpAskIntent,
  HelpAskQuestionResult,
} from "@/lib/ask-aislix/help-ask-aislix.types";

const REQUEST_TIMEOUT_MS = Number(process.env.ASK_AISLIX_REQUEST_TIMEOUT_MS ?? 45000);

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

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export async function getHelpAskAislixOptionsServer(
  supabase: SupabaseClient<Database>,
  userId: string,
  orgId: string,
): Promise<HelpAskAuthorizedOptions> {
  const scope = await buildAskAccessScope(supabase, userId, orgId);
  const allowed = new Set(scope.allowedStoreIds);

  const { data: storeRows, error } = await supabase
    .from("stores")
    .select("id, name, city, country")
    .eq("org_id", orgId)
    .eq("status", "active")
    .order("name");

  if (error) throw new Error("Could not load authorized locations.");

  const stores = (storeRows ?? [])
    .filter((s) => allowed.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      country: s.country,
    }));

  const categories: string[] = [];
  if (allowed.size > 0) {
    const { data: scanRows } = await supabase
      .from("shelf_scans")
      .select("category")
      .eq("org_id", orgId)
      .in("store_id", [...allowed])
      .not("category", "is", null)
      .limit(500);
    for (const row of scanRows ?? []) {
      const cat = String(row.category ?? "").trim();
      if (cat) categories.push(cat);
    }
  }

  return {
    stores,
    countries: uniqueStrings(stores.map((s) => s.country ?? "")),
    cities: uniqueStrings(stores.map((s) => s.city ?? "")),
    categories: uniqueStrings(categories).sort((a, b) => a.localeCompare(b)),
    canViewAllLocations: stores.length > 1 || scope.isOrgAdmin,
  };
}

async function generateQuestionFromIntent(intent: HelpAskIntent): Promise<string> {
  const client = getOpenAIClient();
  const primary = getModel();
  const payload = JSON.stringify(intent, null, 2);

  const call = async (model: string) => {
    const response = await client.responses.create({
      model,
      instructions: HELP_ASK_AISLIX_SYSTEM_PROMPT,
      input: [
        {
          role: "user",
          content: `Convert this validated Aislix analysis intent into one natural-language question. Return JSON with a single key "question".\n\n${payload}`,
        },
      ],
      text: { format: { type: "json_object" } },
    });
    const raw = response.output_text || "{}";
    const parsed = JSON.parse(raw) as { question?: string };
    const question = parsed.question?.trim();
    if (!question) throw new Error("OpenAI did not return a question.");
    return question.slice(0, 2000);
  };

  try {
    return await call(primary);
  } catch (primaryError) {
    const fallback = getFallbackModel();
    if (fallback === primary) throw primaryError;
    return call(fallback);
  }
}

export async function buildHelpAskQuestionServer(
  supabase: SupabaseClient<Database>,
  userId: string,
  orgId: string,
  rawIntent: unknown,
): Promise<HelpAskQuestionResult> {
  const rate = checkAskRateLimit(userId, orgId);
  if (!rate.ok) {
    return { ok: false, question: "", error: "Too many requests. Please try again later." };
  }

  try {
    const scope = await buildAskAccessScope(supabase, userId, orgId);
    const options = await getHelpAskAislixOptionsServer(supabase, userId, orgId);
    const validated = validateHelpAskIntent(rawIntent, scope, options);
    if (!validated.ok) {
      return { ok: false, question: "", error: validated.error };
    }

    const question = await generateQuestionFromIntent(validated.intent);
    return { ok: true, question, validatedIntent: validated.intent };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not build question.";
    return { ok: false, question: "", error: message.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 500) };
  }
}
