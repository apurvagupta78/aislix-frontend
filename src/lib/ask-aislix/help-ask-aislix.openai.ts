import OpenAI from "openai";
import type { Response } from "openai/resources/responses/responses";
import { z } from "zod";

import { buildQuestionBuilderPayload } from "@/lib/ask-aislix/help-ask-aislix.payload";
import { HELP_ASK_AISLIX_SYSTEM_PROMPT } from "@/lib/ask-aislix/help-ask-aislix.prompt";
import type { HelpAskIntent } from "@/lib/ask-aislix/help-ask-aislix.types";

const REQUEST_TIMEOUT_MS = Number(process.env.ASK_AISLIX_REQUEST_TIMEOUT_MS ?? 45000);

const QuestionBuilderResponseSchema = z.object({
  generated_question: z.string().min(1),
  intent_summary: z.string(),
  selected_context: z.array(z.string()),
});

export type QuestionBuilderOutput = z.infer<typeof QuestionBuilderResponseSchema>;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  return new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS });
}

function getModel(): string {
  return process.env.OPENAI_HELP_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
}

function extractOutputText(response: Response): string {
  for (const item of response.output) {
    if (item.type === "message") {
      for (const part of item.content) {
        if (part.type === "output_text") return part.text;
      }
    }
  }
  return "";
}

export async function generateHelpAskQuestionWithOpenAI(
  intent: HelpAskIntent,
): Promise<QuestionBuilderOutput> {
  const client = getOpenAIClient();
  const payload = buildQuestionBuilderPayload(intent);

  const response = await client.responses.create({
    model: getModel(),
    instructions: HELP_ASK_AISLIX_SYSTEM_PROMPT,
    input: [
      {
        role: "user",
        content: `Convert this validated wizard payload into the required JSON object (generated_question, intent_summary, selected_context):\n\n${JSON.stringify(payload)}`,
      },
    ],
    text: { format: { type: "json_object" } },
  });

  const raw = extractOutputText(response);
  if (!raw) throw new Error("OpenAI returned an empty question.");
  return QuestionBuilderResponseSchema.parse(JSON.parse(raw));
}
