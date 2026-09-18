import {
  AskAislixResponseSchema,
  type AskAislixResponse,
} from "@/lib/ask-aislix/ask-aislix.types";

export const NO_AUDIT_FOUND_MESSAGE =
  "No audit found. Please create an audit to generate the answer";

export const ASK_AISLIX_PARSE_ERROR_MESSAGE =
  "Ask Aislix could not format the response. Please try again.";

const EMPTY_RESPONSE: AskAislixResponse = {
  answer: NO_AUDIT_FOUND_MESSAGE,
  summary: "",
  metrics: [],
  visual: { type: "none", title: "", data: [] },
  table: { columns: [], rows: [] },
  insights: [],
  actions: [],
  source_context: { period: "", locations: [] },
  follow_up_questions: [],
};

const VALID_TRENDS = new Set(["up", "down", "flat", "none"]);

/** Only normalize when the model explicitly signals unavailable scoped data. */
const UNAVAILABLE_ANSWER_PATTERNS = [
  /^data unavailable/i,
  /^no data is available/i,
  /^no matching audit/i,
  /^no shelf-audit/i,
  /^no evidence/i,
  /^not accessible under/i,
];

function emptyAskResponse(answer: string): AskAislixResponse {
  return { ...EMPTY_RESPONSE, answer };
}

function sanitizeMetrics(raw: unknown): AskAislixResponse["metrics"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const metric = item as Record<string, unknown>;
      const trend = String(metric.trend ?? "none");
      return {
        label: String(metric.label ?? ""),
        value: String(metric.value ?? ""),
        unit: String(metric.unit ?? ""),
        trend: VALID_TRENDS.has(trend) ? (trend as "up" | "down" | "flat" | "none") : "none",
      };
    })
    .filter((m): m is NonNullable<typeof m> => Boolean(m?.label));
}

function coerceLooseResponse(value: unknown): AskAislixResponse | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.answer !== "string" || !obj.answer.trim()) return null;

  const candidate = {
    answer: obj.answer.trim(),
    summary: typeof obj.summary === "string" ? obj.summary : "",
    metrics: sanitizeMetrics(obj.metrics),
    visual:
      obj.visual && typeof obj.visual === "object"
        ? obj.visual
        : { type: "none", title: "", data: [] },
    table:
      obj.table && typeof obj.table === "object"
        ? obj.table
        : { columns: [], rows: [] },
    insights: Array.isArray(obj.insights) ? obj.insights.filter((i) => typeof i === "string") : [],
    actions: Array.isArray(obj.actions) ? obj.actions : [],
    source_context:
      obj.source_context && typeof obj.source_context === "object"
        ? obj.source_context
        : { period: "", locations: [] },
    follow_up_questions: Array.isArray(obj.follow_up_questions)
      ? obj.follow_up_questions.filter((q) => typeof q === "string")
      : [],
  };

  const parsed = AskAislixResponseSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function isNoAuditDataResponse(response: Pick<AskAislixResponse, "answer" | "summary">): boolean {
  const answer = response.answer.trim();
  if (answer.startsWith("{")) return true;
  return UNAVAILABLE_ANSWER_PATTERNS.some((pattern) => pattern.test(answer));
}

export function normalizeAskAislixResponse(response: AskAislixResponse): AskAislixResponse {
  if (isNoAuditDataResponse(response)) {
    return emptyAskResponse(NO_AUDIT_FOUND_MESSAGE);
  }
  return response;
}

export function parseAskAislixResponse(raw: string): AskAislixResponse {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "{}") {
    return emptyAskResponse(ASK_AISLIX_PARSE_ERROR_MESSAGE);
  }

  try {
    const json = JSON.parse(trimmed) as unknown;
    const strict = AskAislixResponseSchema.safeParse(json);
    if (strict.success) {
      return normalizeAskAislixResponse(strict.data);
    }

    const loose = coerceLooseResponse(json);
    if (loose) return normalizeAskAislixResponse(loose);
  } catch {
    // fall through — not JSON
  }

  if (!trimmed.startsWith("{") && trimmed.length > 0) {
    return emptyAskResponse(trimmed.slice(0, 4000));
  }

  return emptyAskResponse(ASK_AISLIX_PARSE_ERROR_MESSAGE);
}
