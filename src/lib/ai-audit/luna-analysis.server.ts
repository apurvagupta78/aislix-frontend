import { parseLunaAnalysis, type AiAnalysisRequest, type LunaAnalysis } from "@/lib/ai-audit/ai-analysis";
import { buildLunaAnalysisPrompt, type LunaAnalysisEvidence } from "@/lib/ai-audit/prompts/luna-analysis.prompt";

const LUNA_TIMEOUT_MS = 60_000;
const MAX_LINES = 150;
const MAX_PRODUCTS = 120;

function analysisModel(): string {
  return (
    (process.env.OPENAI_LUNA_MODEL ?? "").trim() ||
    (process.env.OPENAI_DOC_MODEL ?? "").trim() ||
    (process.env.OPENAI_MODEL ?? "").trim() ||
    "gpt-5.6-luna"
  );
}

function failed(request: AiAnalysisRequest, error: string): LunaAnalysis {
  return {
    status: "failed",
    answer: "",
    findings: [],
    needs_review: [],
    checks: request.checks,
    question: request.question,
    model: null,
    generated_at: new Date().toISOString(),
    error,
  };
}

/**
 * Luna explains Astra's counts + Aislix's document match against the user's checks and question.
 * Never throws: a failure is returned as `status: "failed"` so the scan still completes.
 */
export async function runLunaAnalysis(
  request: AiAnalysisRequest,
  evidence: LunaAnalysisEvidence,
): Promise<LunaAnalysis> {
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) return failed(request, "it is not set up yet.");
  try {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey, timeout: LUNA_TIMEOUT_MS, maxRetries: 1 });
    const model = analysisModel();
    const prompt = buildLunaAnalysisPrompt(request, {
      ...evidence,
      documentLines: evidence.documentLines.slice(0, MAX_LINES),
      notOnDocument: evidence.notOnDocument.slice(0, MAX_PRODUCTS),
      shelfProducts: evidence.shelfProducts.slice(0, MAX_PRODUCTS),
      promotions: evidence.promotions.slice(0, MAX_PRODUCTS),
    });
    const response = await client.responses.create({
      model,
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      text: { format: { type: "json_object" } },
      max_output_tokens: 4096,
    });
    const raw = String(response.output_text ?? "").trim();
    if (!raw) return failed(request, "the AI returned an empty answer.");
    const parsed = parseLunaAnalysis(JSON.parse(raw), request, { model, generatedAt: new Date().toISOString() });
    return parsed ?? failed(request, "the AI answer could not be read.");
  } catch (error) {
    console.error("[luna-analysis] failed:", error);
    return failed(request, "it could not be completed.");
  }
}
