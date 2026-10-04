/**
 * AI Audit "what should AI analyse?" request (user checks + question) and the persisted
 * Luna answer (`scan_results.metrics.luna_analysis`). Astra counts, Aislix matches the
 * document lines, Luna only explains those numbers against the user's request.
 */

import type { ReferenceRow } from "@/lib/ai-audit/reference-document";

export type AiAnalysisCheck =
  | "presence"
  | "quantity"
  | "price"
  | "location"
  | "facings"
  | "brand_share"
  | "expiry";

export type AiAnalysisCheckOption = {
  value: AiAnalysisCheck;
  label: string;
  hint: string;
  /** Document field the check needs; checks without one also work without a document. */
  needs?: "product" | "qty" | "price" | "location";
};

export const AI_ANALYSIS_CHECKS: AiAnalysisCheckOption[] = [
  { value: "presence", label: "Is every item on the shelf?", hint: "Each document line found or missing", needs: "product" },
  { value: "quantity", label: "Quantity vs expected", hint: "Units counted vs the document quantity", needs: "qty" },
  { value: "price", label: "Price matches", hint: "Visible price vs the document price", needs: "price" },
  { value: "location", label: "Right location", hint: "Shelf / bin vs the document location", needs: "location" },
  { value: "facings", label: "Facings", hint: "How many faces each product has" },
  { value: "brand_share", label: "Brand share", hint: "Which brands own the shelf" },
  { value: "expiry", label: "Expiry / damage", hint: "Only what is readable in the photo" },
];

export const AI_QUESTION_MAX = 500;

export type AiAnalysisRequest = {
  source: "ai_document_audit";
  checks: AiAnalysisCheck[];
  question: string;
};

const CHECK_VALUES = new Set<AiAnalysisCheck>(AI_ANALYSIS_CHECKS.map((c) => c.value));

function hasField(rows: ReferenceRow[], field: "product" | "qty" | "price" | "location"): boolean {
  return rows.some((row) => {
    if (field === "product") return Boolean(row.product.trim() || row.brand.trim());
    const value = row[field];
    return typeof value === "number" ? Number.isFinite(value) : Boolean(String(value ?? "").trim());
  });
}

/** Checks the user can tick: document checks need their column filled on at least one line. */
export function availableAiChecks(rows: ReferenceRow[] | null): Set<AiAnalysisCheck> {
  return new Set(
    AI_ANALYSIS_CHECKS.filter((c) => !c.needs || (rows ? hasField(rows, c.needs) : false)).map((c) => c.value),
  );
}

/** Sensible defaults when a document loads (or the shelf-only path is picked). */
export function defaultAiChecks(rows: ReferenceRow[] | null): AiAnalysisCheck[] {
  const available = availableAiChecks(rows);
  const preferred: AiAnalysisCheck[] = rows ? ["presence", "quantity", "price", "location"] : ["facings", "brand_share"];
  return preferred.filter((c) => available.has(c));
}

export function aiAnalysisReady(request: Pick<AiAnalysisRequest, "checks" | "question">): boolean {
  return request.checks.length > 0 || request.question.trim().length > 0;
}

export function buildAiAnalysisRequest(
  checks: AiAnalysisCheck[],
  question: string,
  rows: ReferenceRow[] | null,
): AiAnalysisRequest {
  const available = availableAiChecks(rows);
  return {
    source: "ai_document_audit",
    checks: checks.filter((c) => available.has(c)),
    question: question.trim().slice(0, AI_QUESTION_MAX),
  };
}

export function parseAiAnalysisRequest(raw: unknown): AiAnalysisRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const checks = Array.isArray(obj.checks)
    ? obj.checks.filter((c): c is AiAnalysisCheck => typeof c === "string" && CHECK_VALUES.has(c as AiAnalysisCheck))
    : [];
  const question = typeof obj.question === "string" ? obj.question.trim().slice(0, AI_QUESTION_MAX) : "";
  if (!checks.length && !question) return null;
  return { source: "ai_document_audit", checks: [...new Set(checks)], question };
}

export function aiAnalysisSummary(request: Pick<AiAnalysisRequest, "checks" | "question">): string {
  const labels = AI_ANALYSIS_CHECKS.filter((c) => request.checks.includes(c.value)).map((c) => c.label);
  const question = request.question.trim();
  return [labels.join(" · "), question ? `“${question}”` : ""].filter(Boolean).join(" — ") || "—";
}

export type LunaFindingStatus = "ok" | "issue" | "needs_review" | "not_available";

export type LunaFinding = {
  check: AiAnalysisCheck | "question";
  status: LunaFindingStatus;
  title: string;
  note: string;
  /** Document line numbers the finding is about. */
  rows: number[];
};

export type LunaAnalysis = {
  status: "completed" | "failed";
  answer: string;
  findings: LunaFinding[];
  needs_review: string[];
  checks: AiAnalysisCheck[];
  question: string;
  model: string | null;
  generated_at: string;
  error?: string;
};

const FINDING_STATUS = new Set<LunaFindingStatus>(["ok", "issue", "needs_review", "not_available"]);

function text(value: unknown, max = 1200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function lineNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ].slice(0, 50);
}

/** Validates Luna's JSON reply (or a persisted block); drops anything malformed. */
export function parseLunaAnalysis(
  payload: unknown,
  request?: Pick<AiAnalysisRequest, "checks" | "question">,
  meta?: { model?: string | null; generatedAt?: string },
): LunaAnalysis | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const allowedChecks = new Set<string>([...CHECK_VALUES, "question"]);
  const findings: LunaFinding[] = (Array.isArray(obj.findings) ? obj.findings : [])
    .filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === "object")
    .map((f) => {
      const status = String(f.status ?? "").toLowerCase() as LunaFindingStatus;
      const check = String(f.check ?? "").toLowerCase();
      return {
        check: (allowedChecks.has(check) ? check : "question") as LunaFinding["check"],
        status: FINDING_STATUS.has(status) ? status : "needs_review",
        title: text(f.title, 160),
        note: text(f.note, 800),
        rows: lineNumbers(f.rows),
      };
    })
    .filter((f) => f.title || f.note)
    .slice(0, 30);
  const answer = text(obj.answer, 2000);
  const failed = obj.status === "failed";
  if (!failed && !answer && !findings.length) return null;
  const checks = request
    ? request.checks
    : (Array.isArray(obj.checks) ? obj.checks : []).filter(
        (c): c is AiAnalysisCheck => typeof c === "string" && CHECK_VALUES.has(c as AiAnalysisCheck),
      );
  return {
    status: failed ? "failed" : "completed",
    answer,
    findings,
    needs_review: (Array.isArray(obj.needs_review) ? obj.needs_review : [])
      .map((n) => text(n, 300))
      .filter(Boolean)
      .slice(0, 10),
    checks,
    question: request ? request.question : text(obj.question, 500),
    model: meta?.model ?? (typeof obj.model === "string" ? obj.model : null),
    generated_at: meta?.generatedAt ?? (typeof obj.generated_at === "string" ? obj.generated_at : new Date().toISOString()),
    ...(failed ? { error: text(obj.error, 300) || "Luna analysis could not be completed." } : {}),
  };
}
