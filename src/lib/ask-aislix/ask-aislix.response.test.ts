import { describe, expect, it } from "vitest";

import {
  NO_AUDIT_FOUND_MESSAGE,
  isNoAuditDataResponse,
  parseAskAislixResponse,
} from "./ask-aislix.response";

describe("parseAskAislixResponse", () => {
  it("returns the short no-audit message for unavailable data answers", () => {
    const raw = JSON.stringify({
      answer: "Data unavailable: shelf-audit images for Lakme were not accessible.",
      summary: "The requested share-of-shelf analysis could not be completed.",
      metrics: [],
      visual: { type: "none", title: "", data: [] },
      table: { columns: [], rows: [] },
      insights: ["Try a narrower date range."],
      actions: [],
      source_context: { period: "Last 30 days", locations: [] },
      follow_up_questions: [],
    });

    const result = parseAskAislixResponse(raw);
    expect(result.answer).toBe(NO_AUDIT_FOUND_MESSAGE);
    expect(result.summary).toBe("");
    expect(result.insights).toEqual([]);
  });

  it("returns the short no-audit message when raw JSON cannot be schema-validated", () => {
    const raw = JSON.stringify({
      answer: "Data unavailable: shelf-audit images were not accessible.",
      summary: "Could not complete analysis.",
      metrics: [{ label: "Count", value: 0, trend: "invalid-trend" }],
    });

    const result = parseAskAislixResponse(raw);
    expect(result.answer).toBe(NO_AUDIT_FOUND_MESSAGE);
  });

  it("keeps valid successful answers unchanged", () => {
    const raw = JSON.stringify({
      answer: "3 audits are overdue this week.",
      summary: "Focus on Mumbai stores first.",
      metrics: [{ label: "Overdue", value: "3", unit: "", trend: "up" }],
      visual: { type: "none", title: "", data: [] },
      table: { columns: [], rows: [] },
      insights: [],
      actions: [],
      source_context: { period: "This week", locations: ["Mumbai"] },
      follow_up_questions: [],
    });

    const result = parseAskAislixResponse(raw);
    expect(result.answer).toBe("3 audits are overdue this week.");
  });
});

describe("isNoAuditDataResponse", () => {
  it("detects leaked JSON payloads", () => {
    expect(isNoAuditDataResponse({ answer: '{"answer":"test"}', summary: "" })).toBe(true);
  });
});
