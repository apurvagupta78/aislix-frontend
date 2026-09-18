import {
  AskAislixResponseSchema,
  type AskAislixResponse,
} from "@/lib/ask-aislix/ask-aislix.types";

export const NO_AUDIT_FOUND_MESSAGE =
  "No audit found. Please create an audit to generate the answer";

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

const NO_DATA_PATTERNS =
  /data unavailable|cannot be calculated|not accessible|no audit|no audits|no matching audit|could not be completed|no shelf-audit|no evidence|not found under the current authorization/i;

function emptyAskResponse(answer: string): AskAislixResponse {
  return { ...EMPTY_RESPONSE, answer };
}

function coerceLooseResponse(value: unknown): AskAislixResponse | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.answer !== "string" || !obj.answer.trim()) return null;

  const candidate = {
    answer: obj.answer,
    summary: typeof obj.summary === "string" ? obj.summary : "",
    metrics: Array.isArray(obj.metrics) ? obj.metrics : [],
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
  return NO_DATA_PATTERNS.test(`${response.answer} ${response.summary ?? ""}`);
}

export function normalizeAskAislixResponse(response: AskAislixResponse): AskAislixResponse {
  if (isNoAuditDataResponse(response)) {
    return emptyAskResponse(NO_AUDIT_FOUND_MESSAGE);
  }
  return response;
}

export function parseAskAislixResponse(raw: string): AskAislixResponse {
  const trimmed = raw.trim();
  if (!trimmed) {
    return emptyAskResponse(NO_AUDIT_FOUND_MESSAGE);
  }

  try {
    const parsed = AskAislixResponseSchema.parse(JSON.parse(trimmed));
    return normalizeAskAislixResponse(parsed);
  } catch {
    try {
      const loose = coerceLooseResponse(JSON.parse(trimmed));
      if (loose) return normalizeAskAislixResponse(loose);
    } catch {
      // fall through
    }

    if (trimmed.startsWith("{")) {
      return emptyAskResponse(NO_AUDIT_FOUND_MESSAGE);
    }

    return emptyAskResponse(NO_AUDIT_FOUND_MESSAGE);
  }
}
