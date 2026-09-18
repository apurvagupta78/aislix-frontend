import { describe, expect, it } from "vitest";

import {
  ASK_AISLIX_PARSE_ERROR_MESSAGE,
} from "./ask-aislix.response";
import {
  buildFallbackFromToolResults,
  resolveAskAislixResponse,
  type CapturedToolCall,
} from "./ask-aislix.fallback";

describe("buildFallbackFromToolResults", () => {
  it("builds KPI metrics from get_kpi tool results", () => {
    const calls: CapturedToolCall[] = [
      {
        name: "get_kpi",
        args: { kpi_id: "audit_completion" },
        result: {
          available: true,
          data: { label: "Audit Completion", value: "25%", detail: "1 of 4 completed" },
        },
      },
      {
        name: "get_kpi",
        args: { kpi_id: "overdue_actions" },
        result: {
          available: true,
          data: { label: "Overdue Actions", value: "2" },
        },
      },
    ];

    const result = buildFallbackFromToolResults(calls);
    expect(result?.answer).toContain("Audit Completion: 25%");
    expect(result?.metrics).toHaveLength(2);
  });

  it("returns zero-recurring message when get_recurring_issues has no items", () => {
    const calls: CapturedToolCall[] = [
      {
        name: "get_recurring_issues",
        args: {},
        result: { available: true, data: { items: [] } },
      },
    ];

    const result = buildFallbackFromToolResults(calls);
    expect(result?.answer).toContain("No recurring audit failures");
    expect(result?.metrics[0]?.value).toBe("0");
  });

  it("builds table from recurring issues", () => {
    const calls: CapturedToolCall[] = [
      {
        name: "get_recurring_issues",
        args: {},
        result: {
          available: true,
          data: {
            items: [
              { issue: "Inventory variance", count: 3, store_name: "Sec 54 Gurgaon" },
            ],
          },
        },
      },
    ];

    const result = buildFallbackFromToolResults(calls);
    expect(result?.table.rows).toHaveLength(1);
    expect(result?.table.rows[0]?.[0]).toBe("Inventory variance");
  });
});

describe("resolveAskAislixResponse", () => {
  it("uses fallback when finalize returns empty JSON", () => {
    const result = resolveAskAislixResponse({
      raw: "{}",
      loopText: "",
      toolCalls: [
        {
          name: "get_kpi",
          args: {},
          result: {
            available: true,
            data: { label: "Audit Completion", value: "25%" },
          },
        },
      ],
    });

    expect(result.answer).not.toBe(ASK_AISLIX_PARSE_ERROR_MESSAGE);
    expect(result.answer).toContain("25%");
  });

  it("prefers valid parsed JSON over fallback", () => {
    const raw = JSON.stringify({
      answer: "Custom formatted answer.",
      summary: "",
      metrics: [],
      visual: { type: "none", title: "", data: [] },
      table: { columns: [], rows: [] },
      insights: [],
      actions: [],
      source_context: { period: "", locations: [] },
      follow_up_questions: [],
    });

    const result = resolveAskAislixResponse({
      raw,
      loopText: "",
      toolCalls: [
        {
          name: "get_kpi",
          args: {},
          result: { available: true, data: { label: "X", value: "99" } },
        },
      ],
    });

    expect(result.answer).toBe("Custom formatted answer.");
  });

  it("uses loop text when parse and fallback both fail", () => {
    const result = resolveAskAislixResponse({
      raw: "{}",
      loopText: "Plain language summary from the model.",
      toolCalls: [],
    });

    expect(result.answer).toBe("Plain language summary from the model.");
  });
});
