import { describe, expect, it } from "vitest";

import {
  aiAnalysisReady,
  availableAiChecks,
  buildAiAnalysisRequest,
  defaultAiChecks,
  parseAiAnalysisRequest,
  parseLunaAnalysis,
} from "@/lib/ai-audit/ai-analysis";
import { emptyReferenceRow, type ReferenceRow } from "@/lib/ai-audit/reference-document";

function row(patch: Partial<ReferenceRow>, index = 1): ReferenceRow {
  return { ...emptyReferenceRow(index), ...patch };
}

describe("availableAiChecks", () => {
  it("only offers document checks whose column is filled", () => {
    const rows = [row({ product: "Colgate MaxFresh", qty: 6 }), row({ product: "Odol" }, 2)];
    const available = availableAiChecks(rows);
    expect(available.has("presence")).toBe(true);
    expect(available.has("quantity")).toBe(true);
    expect(available.has("price")).toBe(false);
    expect(available.has("location")).toBe(false);
    expect(available.has("facings")).toBe(true);
  });

  it("shelf-only path offers no document checks", () => {
    const available = availableAiChecks(null);
    expect(available.has("presence")).toBe(false);
    expect(available.has("brand_share")).toBe(true);
  });
});

describe("defaultAiChecks", () => {
  it("defaults to document checks when a document is loaded", () => {
    const rows = [row({ product: "A", qty: 2, price: 3.5, location: "S1" })];
    expect(defaultAiChecks(rows)).toEqual(["presence", "quantity", "price", "location"]);
  });

  it("defaults to facings + brand share without a document", () => {
    expect(defaultAiChecks(null)).toEqual(["facings", "brand_share"]);
  });
});

describe("buildAiAnalysisRequest / parseAiAnalysisRequest", () => {
  it("drops checks the document cannot support and trims the question", () => {
    const req = buildAiAnalysisRequest(["presence", "price"], "  what is short?  ", [row({ product: "A" })]);
    expect(req).toEqual({ source: "ai_document_audit", checks: ["presence"], question: "what is short?" });
  });

  it("round-trips through a persisted snapshot and rejects junk", () => {
    expect(parseAiAnalysisRequest({ checks: ["presence", "bogus", "presence"], question: "" })).toEqual({
      source: "ai_document_audit",
      checks: ["presence"],
      question: "",
    });
    expect(parseAiAnalysisRequest({ checks: [], question: "  " })).toBeNull();
    expect(parseAiAnalysisRequest("nope")).toBeNull();
  });

  it("is ready with a tick or a question", () => {
    expect(aiAnalysisReady({ checks: [], question: "" })).toBe(false);
    expect(aiAnalysisReady({ checks: [], question: "Any gaps?" })).toBe(true);
    expect(aiAnalysisReady({ checks: ["price"], question: "" })).toBe(true);
  });
});

describe("parseLunaAnalysis", () => {
  const request = { checks: ["presence" as const], question: "What is missing?" };

  it("normalises findings and caps line numbers", () => {
    const parsed = parseLunaAnalysis(
      {
        answer: "2 of 10 lines are missing.",
        findings: [
          { check: "presence", status: "issue", title: "Missing", note: "Lines 3 and 7", rows: [3, "7", -1, 3, 1.5] },
          { check: "weird", status: "unknown", title: "Odd", note: "" },
          { title: "", note: "" },
        ],
        needs_review: ["Line 9 label unreadable"],
      },
      request,
      { model: "luna", generatedAt: "2026-10-04T00:00:00Z" },
    );
    expect(parsed?.status).toBe("completed");
    expect(parsed?.findings).toHaveLength(2);
    expect(parsed?.findings[0]?.rows).toEqual([3, 7]);
    expect(parsed?.findings[1]).toMatchObject({ check: "question", status: "needs_review" });
    expect(parsed?.checks).toEqual(["presence"]);
    expect(parsed?.question).toBe("What is missing?");
    expect(parsed?.model).toBe("luna");
  });

  it("returns null for an empty reply but keeps failed blocks", () => {
    expect(parseLunaAnalysis({ answer: "", findings: [] }, request)).toBeNull();
    const failed = parseLunaAnalysis({ status: "failed", error: "timeout" }, request);
    expect(failed?.status).toBe("failed");
    expect(failed?.error).toBe("timeout");
  });
});
