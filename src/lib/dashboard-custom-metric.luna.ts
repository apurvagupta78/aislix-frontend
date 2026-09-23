import OpenAI from "openai";
import type { Response } from "openai/resources/responses/responses";
import { z } from "zod";

const REQUEST_TIMEOUT_MS = Number(process.env.ASK_AISLIX_REQUEST_TIMEOUT_MS ?? 45000);

const LunaMetricSchema = z.object({
  title: z.string().min(1).max(80),
  value: z.string().min(1).max(40),
  context: z.string().max(240).optional(),
});

export type LunaMetricOutput = z.infer<typeof LunaMetricSchema>;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  return new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS });
}

function getModel(): string {
  return process.env.OPENAI_HELP_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
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

const SYSTEM = `You are Luna, Aislix retail intelligence. Given a user question and compact audit evidence JSON, return ONE metric card as JSON only:
{"title":"...","value":"...","context":"..."}
Rules:
- Use only numbers present in the evidence. Never invent KPIs or fake zeros.
- If evidence is insufficient, return title from the question, value "N/A", context "Data unavailable" or "Verification required".
- Value should be short (number, percent, or short label).
- No markdown, no extra keys.`;

export async function generateDashboardCustomMetricWithLuna(input: {
  question: string;
  auditsJson: string;
}): Promise<LunaMetricOutput> {
  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: getModel(),
    instructions: SYSTEM,
    input: [
      {
        role: "user",
        content: `Question: ${input.question}\n\nAudit evidence JSON:\n${input.auditsJson}`,
      },
    ],
    text: { format: { type: "json_object" } },
  });

  const text = extractOutputText(response);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      title: "Custom metric",
      value: "N/A",
      context: "Data unavailable",
    };
  }
  const result = LunaMetricSchema.safeParse(parsed);
  if (!result.success) {
    return {
      title: "Custom metric",
      value: "N/A",
      context: "Data unavailable",
    };
  }
  return result.data;
}
