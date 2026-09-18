import { describe, expect, it } from "vitest";

import {
  ASK_AISLIX_PARSE_ERROR_MESSAGE,
  NO_AUDIT_FOUND_MESSAGE,
  isNoAuditDataResponse,
  parseAskAislixResponse,
} from "./ask-aislix.response";

describe("parseAskAislixResponse", () => {
  it("returns the short no-audit message for explicit unavailable data answers", () => {
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
  });

  it("coerces loose JSON with invalid metric trends instead of failing", () => {
    const raw = JSON.stringify({
      answer: "3 recurring audit failures this month.",
      summary: "Focus on Mumbai stores first.",
      metrics: [{ label: "Count", value: "3", unit: "", trend: "invalid-trend" }],
      visual: { type: "none", title: "", data: [] },
      table: { columns: [], rows: [] },
      insights: [],
      actions: [],
      source_context: { period: "This month", locations: ["Mumbai"] },
      follow_up_questions: [],
    });

    const result = parseAskAislixResponse(raw);
    expect(result.answer).toBe("3 recurring audit failures this month.");
    expect(result.metrics[0]?.trend).toBe("none");
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

  it("does not treat empty recurring-failure answers as no-audit", () => {
    const raw = JSON.stringify({
      answer: "No recurring audit failures were found in your authorized scope for the last 30 days.",
      summary: "",
      metrics: [],
      visual: { type: "none", title: "", data: [] },
      table: { columns: [], rows: [] },
      insights: [],
      actions: [],
      source_context: { period: "Last 30 days", locations: [] },
      follow_up_questions: [],
    });

    const result = parseAskAislixResponse(raw);
    expect(result.answer).toContain("No recurring audit failures");
    expect(result.answer).not.toBe(NO_AUDIT_FOUND_MESSAGE);
  });

  it("returns parse error message for empty JSON payloads", () => {
    expect(parseAskAislixResponse("{}").answer).toBe(ASK_AISLIX_PARSE_ERROR_MESSAGE);
  });

  it("parses markdown-wrapped JSON and numeric metric values", () => {
    const raw = `\`\`\`json
{
  "answer": "Audit completion is 25% with 2 overdue assignments.",
  "summary": "",
  "metrics": [{ "label": "Completion", "value": 25, "unit": "%", "trend": "flat" }],
  "visual": { "type": "invalid", "title": "", "data": [] },
  "table": { "columns": [], "rows": [] },
  "insights": [],
  "actions": [{ "label": "View Dashboard", "route": "/dashboard" }],
  "source_context": { "period": "", "locations": [] },
  "follow_up_questions": []
}
\`\`\``;

    const result = parseAskAislixResponse(raw);
    expect(result.answer).toContain("25%");
    expect(result.metrics[0]?.value).toBe("25");
    expect(result.visual.type).toBe("none");
    expect(result.actions[0]?.route).toBe("/dashboard");
  });
});

describe("isNoAuditDataResponse", () => {
  it("detects leaked JSON payloads", () => {
    expect(isNoAuditDataResponse({ answer: '{"answer":"test"}', summary: "" })).toBe(true);
  });
});
