import type { AskAislixResponse } from "@/lib/ask-aislix/ask-aislix.types";
import { parseAskAislixResponse, ASK_AISLIX_PARSE_ERROR_MESSAGE } from "./ask-aislix.response";

export type CapturedToolCall = {
  name: string;
  args: Record<string, unknown>;
  result: {
    available?: boolean;
    reason?: string;
    data?: unknown;
  };
};

const EMPTY_VISUAL: AskAislixResponse["visual"] = { type: "none", title: "", data: [] };
const EMPTY_TABLE: AskAislixResponse["table"] = { columns: [], rows: [] };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function buildFromKpiTools(calls: CapturedToolCall[]): AskAislixResponse | null {
  const kpiCalls = calls.filter((c) => c.name === "get_kpi" && c.result.available !== false);
  if (!kpiCalls.length) return null;

  const metrics = kpiCalls
    .map((call) => {
      const data = asRecord(call.result.data);
      if (!data) return null;
      const value = data.value == null ? "" : String(data.value);
      const label = String(data.label ?? data.id ?? "KPI");
      const detail = typeof data.detail === "string" ? data.detail : "";
      return {
        label,
        value,
        unit: "",
        trend: "none" as const,
        detail,
      };
    })
    .filter(Boolean) as Array<{ label: string; value: string; unit: string; trend: "none"; detail?: string }>;

  if (!metrics.length) return null;

  const parts = metrics.map((m) => {
    const detail = m.detail ? ` (${m.detail})` : "";
    return `${m.label}: ${m.value}${detail}`;
  });

  return {
    answer: parts.join(". ") + ".",
    summary: "",
    metrics: metrics.map(({ label, value, unit, trend }) => ({ label, value, unit, trend })),
    visual: EMPTY_VISUAL,
    table: EMPTY_TABLE,
    insights: [],
    actions: [],
    source_context: { period: "", locations: [] },
    follow_up_questions: [],
  };
}

function buildFromRecurringIssues(calls: CapturedToolCall[]): AskAislixResponse | null {
  const call = calls.find((c) => c.name === "get_recurring_issues");
  if (!call) return null;

  const data = asRecord(call.result.data);
  const items = Array.isArray(data?.items) ? data!.items : [];

  if (!items.length) {
    return {
      answer: "No recurring audit failures were found in your authorized locations for the selected period.",
      summary: "There are no RCA patterns that repeat more than once in this period.",
      metrics: [{ label: "Recurring issues", value: "0", unit: "", trend: "none" }],
      visual: EMPTY_VISUAL,
      table: EMPTY_TABLE,
      insights: [],
      actions: [],
      source_context: { period: "", locations: [] },
      follow_up_questions: ["Show me open findings", "Which stores have the most overdue assignments?"],
    };
  }

  const rows = items.slice(0, 10).map((item) => {
    const row = asRecord(item);
    if (!row) return null;
    return [
      String(row.issue ?? row.finding_type ?? row.rca_code ?? "Issue"),
      String(row.count ?? row.occurrences ?? "—"),
      String(row.store ?? row.location ?? row.store_name ?? "—"),
    ];
  }).filter(Boolean) as string[][];

  return {
    answer: `Found ${items.length} recurring issue pattern${items.length === 1 ? "" : "s"} in your authorized scope.`,
    summary: "These RCA codes or finding types appeared more than once in the selected period.",
    metrics: [{ label: "Recurring patterns", value: String(items.length), unit: "", trend: "none" }],
    visual: { type: "table", title: "Recurring issues", data: [] },
    table: {
      columns: ["Issue", "Count", "Location"],
      rows,
    },
    insights: [],
    actions: [],
    source_context: { period: "", locations: [] },
    follow_up_questions: ["Which stores have the highest inventory variance?", "Show critical findings"],
  };
}

function buildFromAuditSummary(calls: CapturedToolCall[]): AskAislixResponse | null {
  const call = calls.find((c) => c.name === "get_audit_summary" && c.result.available !== false);
  if (!call) return null;

  const data = asRecord(call.result.data);
  if (!data) return null;

  const total = Number(data.total ?? 0);
  const completed = Number(data.completed ?? 0);
  const completionPct = Number(data.completion_pct ?? 0);
  const overdueCall = calls.find((c) => c.name === "get_overdue_audits");
  const overdueData = overdueCall ? asRecord(overdueCall.result.data) : null;
  const overdueCount = overdueData ? Number(overdueData.count ?? overdueData.total ?? 0) : null;

  let answer = `Audit completion is ${completionPct}% (${completed} of ${total} assignments).`;
  if (overdueCount != null) {
    answer += ` ${overdueCount} assignment${overdueCount === 1 ? "" : "s"} ${overdueCount === 1 ? "is" : "are"} overdue.`;
  }

  const metrics: AskAislixResponse["metrics"] = [
    { label: "Audit Completion", value: `${completionPct}%`, unit: "", trend: "none" },
    { label: "Completed", value: String(completed), unit: `of ${total}`, trend: "none" },
  ];
  if (overdueCount != null) {
    metrics.push({ label: "Overdue assignments", value: String(overdueCount), unit: "", trend: overdueCount > 0 ? "up" : "none" });
  }

  return {
    answer,
    summary: "",
    metrics,
    visual: EMPTY_VISUAL,
    table: EMPTY_TABLE,
    insights: [],
    actions: [],
    source_context: { period: "", locations: [] },
    follow_up_questions: ["Show me the latest audit evidence images", "Which stores are at risk?"],
  };
}

/** Build a structured response from captured tool outputs when JSON finalize fails. */
export function buildFallbackFromToolResults(calls: CapturedToolCall[]): AskAislixResponse | null {
  if (!calls.length) return null;

  return (
    buildFromKpiTools(calls) ??
    buildFromRecurringIssues(calls) ??
    buildFromAuditSummary(calls)
  );
}

/** Parse model output; if parse fails, try tool-backed fallback or plain-text loop answer. */
export function resolveAskAislixResponse(input: {
  raw: string;
  loopText: string;
  toolCalls: CapturedToolCall[];
}): AskAislixResponse {
  const parsed = parseAskAislixResponse(input.raw);
  if (parsed.answer !== ASK_AISLIX_PARSE_ERROR_MESSAGE) {
    return parsed;
  }

  const fallback = buildFallbackFromToolResults(input.toolCalls);
  if (fallback) return fallback;

  const loopTrimmed = input.loopText.trim();
  if (loopTrimmed && loopTrimmed !== "{}" && !loopTrimmed.startsWith("{")) {
    return parseAskAislixResponse(JSON.stringify({
      answer: loopTrimmed.slice(0, 4000),
      summary: "",
      metrics: [],
      visual: EMPTY_VISUAL,
      table: EMPTY_TABLE,
      insights: [],
      actions: [],
      source_context: { period: "", locations: [] },
      follow_up_questions: [],
    }));
  }

  return parsed;
}
