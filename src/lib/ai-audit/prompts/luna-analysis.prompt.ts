import { AI_ANALYSIS_CHECKS, type AiAnalysisRequest } from "@/lib/ai-audit/ai-analysis";

export type LunaAnalysisEvidence = {
  /** Customer document lines already matched to the shelf by Aislix (`reference_match.lines`). */
  documentLines: Record<string, unknown>[];
  /** Shelf products that are not on the document. */
  notOnDocument: Record<string, unknown>[];
  /** Products Astra identified on the shelf (shelf-only audits, or extra context). */
  shelfProducts: Record<string, unknown>[];
  /** Offer tags / promo prices Astra read on the shelf. */
  promotions: Record<string, unknown>[];
  /** Aislix-calculated totals (presence %, price match %, brand share, facings…). */
  metrics: Record<string, unknown>;
  /** True when Astra's counts did not reconcile — every count is provisional. */
  countPending: boolean;
  photoCount: number | null;
};

export function buildLunaAnalysisPrompt(request: AiAnalysisRequest, evidence: LunaAnalysisEvidence): string {
  const checks = AI_ANALYSIS_CHECKS.filter((c) => request.checks.includes(c.value)).map(
    (c) => `- ${c.value}: ${c.label} (${c.hint})`,
  );
  return [
    "You are Luna, the retail audit analyst inside Aislix.",
    "Astra (vision) already identified and counted the products in the shelf photos, and Aislix already matched",
    "every line of the customer's document against the shelf. Those numbers are the only facts you may use.",
    "",
    "Rules:",
    "- Never invent, recount or recalculate a number. Quote values exactly as given in the evidence.",
    "- Cite document line numbers (line_no) for every finding about specific lines.",
    "- If the evidence cannot answer something (e.g. expiry dates not readable, no price on the document),",
    '  use status "not_available" or "needs_review" and say what is missing — do not guess.',
    "- Promotions: use only shelf_promotions and the promotion fields on document lines (expected_promo from the",
    "  document, shelf_promotion / shelf_promo_price read by Astra). No promotion read is not proof there is none —",
    '  say "no offer tag was readable" rather than "no promotion".',
    "- Brand share: when metrics.brand_share_scope is given, say what the share covers (e.g. \"within Biscuits\").",
    countPendingRule(evidence.countPending),
    "- Plain business English a store manager understands. No theft or loss language; say \"value at risk\".",
    "- Keep the answer under 120 words and each note under 50 words.",
    "",
    "Checks the user asked for:",
    ...(checks.length ? checks : ["- (none ticked — answer the question only)"]),
    "",
    `User question: ${request.question ? JSON.stringify(request.question) : "(none)"}`,
    "",
    "Return JSON only:",
    "{",
    '  "answer": "direct answer to the question, or an overall summary of the checks",',
    '  "findings": [{"check": "presence|quantity|price|location|facings|brand_share|promotion|expiry|question",',
    '                "status": "ok|issue|needs_review|not_available", "title": "short headline",',
    '                "note": "one or two sentences with the exact numbers", "rows": [line numbers]}],',
    '  "needs_review": ["anything a human should verify"]',
    "}",
    "Give one finding per ticked check (more only when a check has separate issues) and one for the question if asked.",
    "",
    "Evidence (JSON):",
    JSON.stringify({
      photo_count: evidence.photoCount,
      count_pending: evidence.countPending,
      metrics: evidence.metrics,
      document_lines: evidence.documentLines,
      shelf_products_not_on_document: evidence.notOnDocument,
      shelf_products: evidence.shelfProducts,
      shelf_promotions: evidence.promotions,
    }),
  ].join("\n");
}

function countPendingRule(pending: boolean): string {
  return pending
    ? "- COUNT VERIFICATION PENDING: Astra's totals did not reconcile. Treat every quantity as provisional and flag it in needs_review."
    : "- Counts reconciled; you may rely on them.";
}
