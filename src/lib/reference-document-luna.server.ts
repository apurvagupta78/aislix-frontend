import { buildDocumentReaderPrompt } from "@/lib/ai-audit/prompts/document-reader.prompt";
import { parseLunaDocument, type ReferenceDocumentState, type ReferenceField } from "@/lib/ai-audit/reference-document";

async function openaiClient() {
  const OpenAI = (await import("openai")).default;
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) throw new Error("Document reading is not configured (OPENAI_API_KEY missing).");
  return new OpenAI({ apiKey, timeout: 120_000 });
}

function documentModel(): string {
  return (
    (process.env.OPENAI_DOC_MODEL ?? "").trim() || (process.env.OPENAI_MODEL ?? "").trim() || "gpt-5.6-luna"
  );
}

/** Luna reads one image or PDF into reference rows with the document-reader prompt. */
export async function lunaReadDocument(input: {
  bytes: Buffer;
  mimeType: string;
  filename: string;
  category?: string | null;
  subCategories?: string[];
}): Promise<ReferenceDocumentState> {
  const client = await openaiClient();
  const prompt = buildDocumentReaderPrompt({ category: input.category, subCategories: input.subCategories });
  const dataUrl = `data:${input.mimeType};base64,${input.bytes.toString("base64")}`;
  const attachment =
    input.mimeType === "application/pdf"
      ? { type: "input_file" as const, filename: input.filename || "document.pdf", file_data: dataUrl }
      : { type: "input_image" as const, image_url: dataUrl, detail: "high" as const };

  const response = await client.responses.create({
    model: documentModel(),
    input: [{ role: "user", content: [{ type: "input_text", text: prompt }, attachment] }],
    text: { format: { type: "json_object" } },
    max_output_tokens: 8192,
  });

  const text = String(response.output_text ?? "").trim();
  if (!text) throw new Error("AI returned an empty reading. Try a clearer photo of the document.");
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("The AI reading was cut off or malformed. Try again or upload fewer pages.");
  }
  return parseLunaDocument(payload, input.filename || null);
}

const MAPPABLE_FIELDS: ReferenceField[] = ["product", "brand", "variant", "pack_size", "qty", "unit", "price", "location"];

/** One small call: which table header holds which reference field. Only returns headers from the list. */
export async function lunaMapColumns(
  headers: string[],
  sample: string[][],
): Promise<Partial<Record<ReferenceField, string>>> {
  const client = await openaiClient();
  const prompt = [
    "Map the columns of a retail invoice / stock list table to these fields:",
    "product (item name or description), brand, variant, pack_size, qty (quantity), unit (UOM),",
    "price (shelf price: MRP when present, otherwise the unit rate; never the line amount or total), location (bin / shelf).",
    "Use each header at most once and only headers from the list. Use null when no column fits.",
    'Return JSON only, e.g. {"product":"Item Description","qty":"Qty","price":"Rate","brand":null}.',
    `Headers: ${JSON.stringify(headers)}`,
    `Sample rows: ${JSON.stringify(sample.slice(0, 8))}`,
  ].join("\n");
  const response = await client.responses.create({
    model: documentModel(),
    input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
    text: { format: { type: "json_object" } },
    max_output_tokens: 400,
  });
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(String(response.output_text ?? "{}")) as Record<string, unknown>;
  } catch {
    return {};
  }
  const used = new Set<string>();
  const out: Partial<Record<ReferenceField, string>> = {};
  for (const field of MAPPABLE_FIELDS) {
    const header = payload[field];
    if (typeof header === "string" && headers.includes(header) && !used.has(header)) {
      out[field] = header;
      used.add(header);
    }
  }
  return out;
}
