import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildExpiryReadPrompt } from "@/lib/ai-audit/prompts/expiry-read.prompt";
import type { ExpiryReading } from "@/lib/audit-engine/expiry-evidence";
import { parseExpiryReadPayload } from "@/lib/audit-engine/expiry-read-parse";

const MAX_IMAGE_CHARS = 6_000_000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ReadExpiryInput = {
  imageBase64: string;
  mimeType: string;
  /** Store-local date (YYYY-MM-DD) so the AI can resolve shelf-life wording. */
  today: string;
  productHint?: string | null;
};

export const readExpiryDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ReadExpiryInput) => {
    if (!input?.imageBase64 || typeof input.imageBase64 !== "string") throw new Error("Missing photo.");
    if (input.imageBase64.length > MAX_IMAGE_CHARS) throw new Error("Photo is too large.");
    if (!IMAGE_TYPES.has(input.mimeType)) throw new Error("Use a JPEG, PNG or WebP photo.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.today ?? "")) throw new Error("Missing date.");
    return {
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      today: input.today,
      productHint: typeof input.productHint === "string" ? input.productHint.slice(0, 160) : null,
    };
  })
  .handler(async ({ data, context }): Promise<ExpiryReading> => {
    const { withinRateLimits } = await import("@/lib/rate-limit.server");
    if (!(await withinRateLimits([[`expiry-read:${context.userId}`, 1500, 3600]]))) {
      throw new Error("Too many date reads in the last hour. Type the date instead.");
    }
    const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
    if (!apiKey) throw new Error("Date reading is not available right now. Type the date instead.");
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey, timeout: 45_000 });
    const model =
      (process.env.OPENAI_VISION_MODEL ?? "").trim() || (process.env.OPENAI_MODEL ?? "").trim() || "gpt-5.6-luna";
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: buildExpiryReadPrompt({ today: data.today, productHint: data.productHint }) },
            { type: "input_image", image_url: `data:${data.mimeType};base64,${data.imageBase64}`, detail: "high" },
          ],
        },
      ],
      text: { format: { type: "json_object" } },
      max_output_tokens: 400,
    });
    const text = String(response.output_text ?? "").trim();
    let payload: unknown = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = {};
    }
    return parseExpiryReadPayload(payload);
  });
