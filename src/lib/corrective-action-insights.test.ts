import { describe, expect, it } from "vitest";

import {
  actionsBySource,
  actionsByType,
  agingBuckets,
  correctiveActionKpis,
  openActionsByStore,
  pipelineCounts,
  recheckResults,
  weeklyFlow,
  type InsightAction,
} from "@/lib/corrective-action-insights";
import { actionStage, isActionLate } from "@/lib/corrective-action-catalog";

const NOW = new Date("2026-10-05T12:00:00Z").getTime();
const DAY = 864e5;

function action(overrides: Partial<InsightAction> = {}): InsightAction {
  return {
    status: "assigned",
    priority: "medium",
    source: "ai",
    action_type: "availability",
    created_at: new Date(NOW - 2 * DAY).toISOString(),
    closed_at: null,
    verified_at: null,
    due_at: new Date(NOW + 2 * DAY).toISOString(),
    assigned_name: "Asha",
    store_id: "s1",
    store_name: "Bandra",
    escalation_level: 0,
    verification_status: null,
    before_score: null,
    after_score: null,
    code: "CA-1001",
    title: "Refill",
    ...overrides,
  };
}

describe("corrective action stages", () => {
  it("collapses raw statuses into the five stages", () => {
    expect(actionStage("assigned")).toBe("open");
    expect(actionStage("overdue")).toBe("open");
    expect(actionStage("rejected")).toBe("in_progress");
    expect(actionStage("pending_verification")).toBe("submitted");
    expect(actionStage("verified")).toBe("verified");
    expect(actionStage("resolved")).toBe("closed");
  });

  it("is late only while the owner still has work to do", () => {
    const past = new Date(NOW - DAY).toISOString();
    expect(isActionLate({ status: "in_progress", due_at: past }, NOW)).toBe(true);
    expect(isActionLate({ status: "pending_verification", due_at: past }, NOW)).toBe(false);
    expect(isActionLate({ status: "closed", due_at: past }, NOW)).toBe(false);
  });
});

describe("corrective action insights", () => {
  const late = action({ due_at: new Date(NOW - 4 * DAY).toISOString(), store_name: "Andheri", priority: "high" });
  const submitted = action({ status: "pending_verification", source: "digital", action_type: "inventory" });
  const closed = action({
    status: "closed",
    closed_at: new Date(NOW - DAY).toISOString(),
    created_at: new Date(NOW - 3 * DAY).toISOString(),
    verification_status: "passed",
    before_score: 5,
    after_score: 1,
  });
  const failed = action({ status: "in_progress", verification_status: "failed", before_score: 3, after_score: 3 });
  const rows = [action(), late, submitted, closed, failed];

  it("splits overdue out of the pipeline", () => {
    expect(pipelineCounts(rows, NOW)).toEqual({
      overdue: 1,
      open: 1,
      in_progress: 1,
      submitted: 1,
      verified: 0,
      closed: 1,
    });
  });

  it("computes KPIs from persisted fields only", () => {
    const k = correctiveActionKpis(rows, NOW);
    expect(k.open).toBe(3);
    expect(k.overdue).toBe(1);
    expect(k.submitted).toBe(1);
    expect(k.closedLast30).toBe(1);
    expect(k.avgDaysToClose).toBe(2);
    expect(k.criticalHighOpen).toBe(1);
    expect(k.recheckPassRate).toBe(50);
  });

  it("returns null instead of fake zeros when nothing was re-checked or closed", () => {
    const k = correctiveActionKpis([action()], NOW);
    expect(k.avgDaysToClose).toBeNull();
    expect(k.recheckPassRate).toBeNull();
  });

  it("groups by type, store, source and age", () => {
    expect(actionsByType(rows)[0]).toMatchObject({ type: "quantity", label: "Quantity issue", open: 4, done: 1 });
    expect(actionsByType([action({ issue_category: "branding" })])[0]).toMatchObject({ type: "branding", open: 1 });
    expect(openActionsByStore(rows, 8, NOW)).toEqual([
      { store: "Bandra", onTime: 2, overdue: 0 },
      { store: "Andheri", onTime: 0, overdue: 1 },
    ]);
    expect(actionsBySource(rows)).toEqual({ ai: 4, digital: 1 });
    const aging = agingBuckets(rows, NOW);
    expect(aging.find((b) => b.key === "on_time")?.count).toBe(2);
    expect(aging.find((b) => b.key === "late_3")?.count).toBe(1);
  });

  it("tracks opened vs closed per week", () => {
    const flow = weeklyFlow(rows, 2, NOW);
    expect(flow).toHaveLength(2);
    expect(flow.reduce((s, p) => s + p.opened, 0)).toBeGreaterThan(0);
    expect(flow.reduce((s, p) => s + p.closed, 0)).toBe(1);
  });

  it("lists before vs after for AI re-checks", () => {
    expect(recheckResults(rows)).toEqual([
      { code: "CA-1001", title: "Refill", before: 5, after: 1, passed: true },
      { code: "CA-1001", title: "Refill", before: 3, after: 3, passed: false },
    ]);
  });
});
